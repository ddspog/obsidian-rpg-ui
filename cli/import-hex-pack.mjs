#!/usr/bin/env node
/**
 * Copy the hex-map-editor's texture packs into the vault, one folder per pack.
 *
 *   node cli/import-hex-pack.mjs <editor assets dir> <vault packs folder> [--write]
 *
 * The editor nests by layer first (`assets/terrain/basic/…`); the vault keeps
 * a pack whole (`<packs folder>/basic/terrain/…`), so a pack can be copied or
 * shared as one folder. Each pack gets a `pack.yml` written for the plugin's
 * renderer (see docs/hex-map-design.md §5) — the editor's own pack.yml files
 * are kept beside it as `editor-pack.<layer>.yml` for reference.
 *
 * Dry run unless `--write`. Never overwrites: a pack folder that already
 * exists is skipped (the vault has no git safety net).
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const LAYERS = ["terrain", "path", "stack"];
const IMAGE = /\.(svg|webp|png|jpe?g)$/i;

const [src, dest] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const write = process.argv.includes("--write");
if (!src || !dest) {
  console.error("usage: import-hex-pack.mjs <editor assets dir> <vault packs folder> [--write]");
  process.exit(1);
}

/** The plugin's `pack.yml` for each known pack — display tuning measured from
 *  the art, a starter catalog, autotile tables — kept in `cli/hex-packs/`. */
const TEMPLATES = new URL("./hex-packs/", import.meta.url);
const packYml = (pack) => {
  const file = new URL(`${pack}.pack.yml`, TEMPLATES);
  return existsSync(file) ? readFileSync(file, "utf8") : `name: "${pack}"\ndefaults:\n  zoom: 1.0\n`;
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const plan = new Map(); // pack → [{ from, to }]
const editorYml = new Map(); // pack → [{ from, to }]
for (const layer of LAYERS) {
  const layerDir = join(src, layer);
  if (!existsSync(layerDir)) continue;
  for (const pack of readdirSync(layerDir)) {
    const packDir = join(layerDir, pack);
    if (!statSync(packDir).isDirectory()) continue;
    for (const file of walk(packDir)) {
      const rel = relative(packDir, file);
      if (rel === "pack.yml") {
        if (!editorYml.has(pack)) editorYml.set(pack, []);
        editorYml.get(pack).push({ from: file, to: join(dest, pack, `editor-pack.${layer}.yml`) });
        continue;
      }
      if (!IMAGE.test(rel)) continue;
      if (!plan.has(pack)) plan.set(pack, []);
      plan.get(pack).push({ from: file, to: join(dest, pack, layer, rel) });
    }
  }
}

for (const [pack, files] of plan) {
  const packDir = join(dest, pack);
  if (existsSync(packDir)) {
    console.log(`skip ${pack}: ${packDir} already exists`);
    continue;
  }
  const byLayer = Object.fromEntries(
    LAYERS.map((l) => [l, files.filter((f) => f.to.startsWith(join(packDir, l))).length])
  );
  console.log(
    `${write ? "copy" : "would copy"} ${pack}: ${files.length} tiles (${LAYERS.map((l) => `${l} ${byLayer[l]}`).join(", ")}) → ${packDir}`
  );
  if (!write) continue;
  for (const { from, to } of [...files, ...(editorYml.get(pack) ?? [])]) {
    mkdirSync(join(to, ".."), { recursive: true });
    copyFileSync(from, to);
  }
  writeFileSync(join(packDir, "pack.yml"), packYml(pack));
}
if (!write) console.log("dry run — pass --write to copy");
