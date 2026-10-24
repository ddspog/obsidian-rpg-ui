#!/usr/bin/env node
/**
 * Builds the Lonelog simulator: one HTML file holding the plugin's Log view, its styles and a
 * copy of the vault's notes, which runs in any browser (a phone included).
 *
 *   RPG_VAULT_ROOT=/path/to/vault node scripts/build-simulator.mjs   →  simulator/dist/simulator.html
 *
 * Run `npm run build` first so styles.css is current.
 */
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultRoot = path.resolve(process.env.RPG_VAULT_ROOT ?? path.join(root, "../.."));
const out = path.join(root, "simulator", "dist");

/** Every note in the vault, by path (Obsidian's own folder and git are left out). */
function readVault(dir, rel = "", into = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) readVault(full, r, into);
    else if (e.name.endsWith(".md")) into[r] = fs.readFileSync(full, "utf8");
  }
  return into;
}

const vault = readVault(vaultRoot);
const bundle = await esbuild.build({
  entryPoints: [path.join(root, "simulator", "main.ts")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  alias: { obsidian: path.join(root, "simulator", "obsidian-stub.ts") },
  plugins: [
    {
      // The system loader compiles TypeScript with esbuild: left out of the page.
      name: "no-system-compiler",
      setup(b) {
        b.onResolve({ filter: /(^|\/)ts-loader$/ }, () => ({
          path: path.join(root, "simulator", "ts-loader-stub.ts"),
        }));
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  logLevel: "warning",
});

const esc = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");
const css = [path.join(root, "simulator", "base.css"), path.join(root, "styles.css")]
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const html = `<title>Lonelog Simulator</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<style>${esc(css)}</style>
<script id="vault-data" type="application/json">${esc(JSON.stringify(vault))}</script>
<script>${esc(bundle.outputFiles[0].text)}</script>
`;
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, "simulator.html");
fs.writeFileSync(file, html);
console.log(`${Object.keys(vault).length} notes, ${(html.length / 1e6).toFixed(1)} MB → ${path.relative(root, file)}`);
