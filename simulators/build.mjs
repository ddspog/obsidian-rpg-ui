#!/usr/bin/env node
/**
 * Builds simulators: each is one HTML file holding the plugin code it exercises, the plugin's
 * styles and a copy of the vault's notes, which runs in any browser (a phone included).
 *
 *   node simulators/build.mjs [id ...] [--watch] [--vault <dir>]      → simulators/dist/<id>.html
 *
 * With no id, every simulator is built. The vault is `--vault`, else $RPG_VAULT_ROOT, else the testing-vault checkout beside this repo. Run
 * `npm run build` first so the plugin's styles.css is current.
 */
import esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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
  vaultFlag >= 0 ? args[vaultFlag + 1] : (process.env.RPG_VAULT_ROOT ?? path.join(root, "../testing-vault"))
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

/**
 * Obsidian's app.css, which the plugin's styles lean on (buttons, icons, tabs, markdown). It is not
 * ours to keep in the repo: it is read from the Obsidian the screenshot harness caches, else from
 * $OBSIDIAN_APP_CSS. Run `node scripts/cloud-obsidian.mjs prepare` once to fetch it.
 */
function obsidianCss() {
  if (process.env.OBSIDIAN_APP_CSS) return fs.readFileSync(process.env.OBSIDIAN_APP_CSS, "utf8");
  const cache = path.join(os.homedir(), ".cache", "rpg-obsidian");
  const out = path.join(cache, "app.css");
  if (fs.existsSync(out)) return fs.readFileSync(out, "utf8");
  const asar = fs
    .readdirSync(cache, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("obsidian-"))
    .map((d) => path.join(cache, d.name, "squashfs-root", "resources", "obsidian.asar"))
    .find((f) => fs.existsSync(f));
  if (!asar) {
    console.warn(
      "No Obsidian app.css found: the simulator will not look like Obsidian. Run `node scripts/cloud-obsidian.mjs prepare`, or set OBSIDIAN_APP_CSS."
    );
    return "";
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sim-asar-"));
  execFileSync("npx", ["--yes", "@electron/asar", "extract-file", asar, "app.css"], { cwd: tmp, stdio: "ignore" });
  fs.copyFileSync(path.join(tmp, "app.css"), out);
  return fs.readFileSync(out, "utf8");
}

/** The theme's CSS: $THEME_DIR (a checkout with a built theme.css), as the harness uses. */
function themeCss() {
  const f = process.env.THEME_DIR && path.join(process.env.THEME_DIR, "theme.css");
  if (!f || !fs.existsSync(f)) return "";
  return fs.readFileSync(f, "utf8");
}

/** CSS without the font faces that load a file beside the stylesheet: the page has no such file. */
const withoutFileFonts = (css) => css.replace(/@font-face\s*\{[^}]*url\(\s*["']?(?!data:|https?:)[^}]*\}/g, "");

const esc = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");

/**
 * The vault's systems (`<folder>/config/index.ts`), bundled as the plugin bundles them in Obsidian
 * (an IIFE that sets `__system_module`, everything that is not a relative import left to the
 * plugin's `require`), so a page can run character sheets without carrying a compiler.
 */
async function systemBundles() {
  const out = {};
  for (const e of fs.readdirSync(vaultRoot, { withFileTypes: true })) {
    const entry = path.join(vaultRoot, e.name, "config", "index.ts");
    if (!e.isDirectory() || e.name.startsWith(".") || !fs.existsSync(entry)) continue;
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "__system_module",
      platform: "browser",
      target: "es2018",
      logLevel: "warning",
      plugins: [
        {
          name: "relative-only",
          setup(b) {
            b.onResolve({ filter: /^[^.]/ }, (a) => (a.kind === "entry-point" ? undefined : { external: true }));
          },
        },
      ],
    });
    out[`${e.name}/config`] = result.outputFiles[0].text;
  }
  return out;
}

async function buildOne(sim) {
  const notes = readVault(vaultRoot, sim);
  const file = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
  const css = [
    withoutFileFonts(obsidianCss()),
    withoutFileFonts(themeCss()),
    file(path.join(here, "core", "base.css")),
    file(path.join(here, sim.dir, "style.css")),
    file(path.join(root, "styles.css")),
  ].join("\n");
  const systems = sim.system ? await systemBundles() : {};
  const meta = { id: sim.id, title: sim.title, about: sim.about };
  const entry = path.basename(sim.entry ?? "index.ts").replace(/\.tsx?$/, "");

  const assemble = (code) => {
    const html = `<title>${esc(sim.title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<style>${esc(css)}</style>
<script id="vault-data" type="application/json">${esc(JSON.stringify(notes))}</script>
${sim.system ? `<script id="system-bundles" type="application/json">${esc(JSON.stringify(systems))}</script>\n` : ""}<script>${esc(code)}</script>
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
          // …unless the simulator asked for systems: then the bundles built here are evaluated.
          b.onResolve({ filter: /(^|\/)ts-loader$/ }, (a) =>
            // The prebuilt loader's own import of the real one goes through.
            a.importer.endsWith("ts-loader-prebuilt.ts")
              ? undefined
              : { path: path.join(here, "core", sim.system ? "ts-loader-prebuilt.ts" : "ts-loader-stub.ts") }
          );
          b.onResolve({ filter: /^esbuild(-wasm)?$/ }, () => ({ path: path.join(here, "core", "empty.ts") }));
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
