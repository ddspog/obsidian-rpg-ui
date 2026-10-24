#!/usr/bin/env node
/**
 * Builds simulators: each is one HTML file holding the plugin code it exercises, the plugin's
 * styles and a copy of the vault's notes, which runs in any browser (a phone included).
 *
 *   node simulators/build.mjs [id ...] [--watch] [--vault <dir>]      → simulators/dist/<id>.html
 *
 * With no id, every simulator is built. The vault is `--vault`, else $RPG_VAULT_ROOT. Run
 * `npm run build` first so the plugin's styles.css is current.
 */
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { picks } from "./glob.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(here, "dist");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const vaultFlag = args.indexOf("--vault");
const vaultRoot = path.resolve(
  vaultFlag >= 0 ? args[vaultFlag + 1] : (process.env.RPG_VAULT_ROOT ?? path.join(root, "../.."))
);
const wanted = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--vault");

/** The simulators on disk: a folder with a `simulator.json`. Folders starting `_` are templates. */
export function listSimulators() {
  return fs
    .readdirSync(here, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && !d.name.startsWith("_") && fs.existsSync(path.join(here, d.name, "simulator.json"))
    )
    .map((d) => ({ dir: d.name, ...JSON.parse(fs.readFileSync(path.join(here, d.name, "simulator.json"), "utf8")) }));
}

/** The vault's notes the simulator asked for, by path (Obsidian's own folder and git are left out). */
function readVault(dir, manifest, rel = "", into = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) readVault(full, manifest, r, into);
    else if (e.name.endsWith(".md") && picks(r, manifest.vault?.include, manifest.vault?.exclude)) {
      into[r] = fs.readFileSync(full, "utf8");
    }
  }
  return into;
}

const esc = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");

async function buildOne(sim) {
  const notes = readVault(vaultRoot, sim);
  const css = [
    path.join(here, "core", "base.css"),
    path.join(here, sim.dir, "style.css"),
    path.join(root, "styles.css"),
  ]
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  const meta = { id: sim.id, title: sim.title, about: sim.about };
  const entry = path.basename(sim.entry ?? "index.ts").replace(/\.tsx?$/, "");

  const assemble = (code) => {
    const html = `<title>${esc(sim.title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<style>${esc(css)}</style>
<script id="vault-data" type="application/json">${esc(JSON.stringify(notes))}</script>
<script>${esc(code)}</script>
`;
    fs.mkdirSync(dist, { recursive: true });
    const file = path.join(dist, `${sim.id}.html`);
    fs.writeFileSync(file, html);
    console.log(
      `${sim.id}: ${Object.keys(notes).length} notes, ${(html.length / 1e6).toFixed(1)} MB → ${path.relative(root, file)}`
    );
  };

  const options = {
    stdin: {
      contents: `import sim from "./${sim.dir}/${entry}"; import { boot } from "./core/boot"; boot(sim, ${JSON.stringify(meta)});`,
      resolveDir: here,
      sourcefile: `${sim.id}-entry.ts`,
      loader: "ts",
    },
    bundle: true,
    write: false,
    minify: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"),
    alias: { obsidian: path.join(here, "core", "obsidian-stub.ts") },
    define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
    logLevel: "warning",
    plugins: [
      {
        // The system loader compiles a vault's TypeScript with esbuild: left out of the page.
        name: "no-system-compiler",
        setup(b) {
          b.onResolve({ filter: /(^|\/)ts-loader$/ }, () => ({ path: path.join(here, "core", "ts-loader-stub.ts") }));
          b.onEnd((result) => {
            if (result.errors.length === 0 && result.outputFiles?.[0]) assemble(result.outputFiles[0].text);
          });
        },
      },
    ],
  };

  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    return ctx;
  }
  const result = await esbuild.build(options);
  if (result.errors.length) process.exit(1);
}

const all = listSimulators();
const chosen = wanted.length ? all.filter((s) => wanted.includes(s.id) || wanted.includes(s.dir)) : all;
if (chosen.length === 0) {
  console.error(
    `No simulator matches ${wanted.join(", ") || "(none found)"}. Known: ${all.map((s) => s.id).join(", ")}`
  );
  process.exit(1);
}
for (const sim of chosen) await buildOne(sim);
if (watch) console.log("Watching; Ctrl-C to stop.");
