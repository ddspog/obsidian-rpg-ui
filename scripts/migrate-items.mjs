#!/usr/bin/env node
/**
 * migrate-items.mjs
 *
 * One-shot migration: rewrites every `.md` under
 * `vault/tales-of-the-valiant/worldbuilding/items/**` from the
 * old dot-keyed frontmatter shape (`.item:` / `.weapon:` / `.container:`
 * / `.shop:` / `.metadata:`) into a single `rpg item.element` fence
 * body. Drops the trailing `tx` / `dataviewjs` rendering blocks — the
 * new fence handles everything inline.
 *
 * Dry-run by default; pass `--write` to mutate files.
 */

import { readFile, writeFile } from "node:fs/promises";
import { globSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ITEM_DIR = resolve(
  ROOT,
  "vault/tales-of-the-valiant/worldbuilding/items",
);

const WRITE = process.argv.includes("--write");

/** Build the new element body object from the old flat-frontmatter. */
function buildElementBody(fm) {
  const body = {};
  if (fm.type) body.type = fm.type;
  if (fm.cost) body.cost = fm.cost;
  if (fm.weight != null) body.weight = fm.weight;
  if (fm.rarity) body.rarity = fm.rarity;
  if (fm.source) body.source = fm.source;
  if (fm.reference_img) body.image = fm.reference_img;

  // `reference_desc` is an array of paragraphs — join into a single
  // markdown string so the card renders them as prose.
  if (Array.isArray(fm.reference_desc) && fm.reference_desc.length > 0) {
    body.desc = fm.reference_desc
      .filter((p) => typeof p === "string" && p.trim())
      .join("\n\n");
  } else if (typeof fm.reference_desc === "string" && fm.reference_desc.trim()) {
    body.desc = fm.reference_desc;
  }

  // Weapon-specific fields (`.weapon:` was a YAML separator; the actual
  // keys `damage`, `properties`, `options`, `bonus` sit at the root).
  if (fm.damage || fm.properties || fm.options || fm.weapon_bonus) {
    body.weapon = {};
    if (fm.damage) body.weapon.damage = fm.damage;
    if (fm.properties) body.weapon.properties = fm.properties;
    if (fm.options) body.weapon.options = fm.options;
    if (fm.weapon_bonus) body.weapon.bonus = fm.weapon_bonus;
    if (fm.bonus && !fm.damage) {
      // "+1" bonus on a magical weapon lives at root too.
      body.weapon.bonus = fm.bonus;
    } else if (fm.bonus && fm.damage) {
      body.weapon.bonus = fm.bonus;
    }
  }

  // Armor-specific fields.
  if (fm.ac || fm.armor_category) {
    body.armor = {};
    if (fm.ac) body.armor.ac = fm.ac;
    if (fm.armor_category) body.armor.category = fm.armor_category;
  }

  // Container-specific fields (`.container:` separator + volume_cap /
  // weight_cap at root).
  if (fm.volume_cap || fm.weight_cap) {
    body.container = {};
    if (fm.volume_cap) body.container.volume_cap = fm.volume_cap;
    if (fm.weight_cap) body.container.weight_cap = fm.weight_cap;
  }

  // Shop fields (`.shop:` separator).
  if (fm.cheap || fm.expensive || fm.availability) {
    body.shop = {};
    if (fm.cheap) body.shop.cheap = fm.cheap;
    if (fm.expensive) body.shop.expensive = fm.expensive;
    if (fm.availability) body.shop.availability = fm.availability;
  }

  return body;
}

/** Format the YAML body with double-quoted strings for wikilink values so
 *  the `[[Foo]]` shape survives a round-trip (authored quoted in the
 *  original). */
function formatBody(body) {
  return stringifyYaml(body, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
}

async function migrateFile(path) {
  const raw = await readFile(path, "utf8");
  if (!raw.startsWith("---")) {
    console.warn(`skip (no frontmatter): ${path}`);
    return { changed: false };
  }
  const fmEnd = raw.indexOf("\n---", 3);
  if (fmEnd < 0) {
    console.warn(`skip (unterminated frontmatter): ${path}`);
    return { changed: false };
  }

  const fmSource = raw.slice(3, fmEnd).replace(/^\n/, "");
  let fm = {};
  try {
    fm = parseYaml(fmSource) ?? {};
  } catch (e) {
    console.warn(`skip (malformed yaml): ${path} — ${e.message}`);
    return { changed: false };
  }

  if (fm.type == null && fm.weight == null && fm.damage == null && fm.ac == null) {
    // Already migrated or non-item file
    return { changed: false };
  }

  const cssclasses = fm.cssclasses ?? ["note-item"];
  const body = buildElementBody(fm);
  const yamlBody = formatBody(body);

  // Preserve any post-frontmatter prose that isn't tx / dataviewjs
  // rendering — some files append source footers outside the tx blocks.
  const rest = raw.slice(fmEnd + 4).replace(/^\n/, "");
  const stripped = stripOldRendering(rest);

  const newContent = [
    "---",
    `cssclasses: ${JSON.stringify(cssclasses)}`,
    "---",
    "",
    "```rpg item.element",
    yamlBody,
    "```",
    stripped.trim() ? "" : "",
    stripped.trim(),
    "",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  if (newContent === raw) return { changed: false };
  if (WRITE) await writeFile(path, newContent, "utf8");
  return { changed: true, before: raw.length, after: newContent.length };
}

/** Drop the legacy `tx` / `dataviewjs` rendering blocks the old items
 *  used to build their own cards in markdown. Keep anything else (e.g.
 *  trailing prose, source footer) intact. */
function stripOldRendering(body) {
  let out = body;
  // Block: ```tx ... ```
  out = out.replace(/```tx[\s\S]*?```/g, "");
  // Block: ````dataviewjs ... ````
  out = out.replace(/````dataviewjs[\s\S]*?````/g, "");
  // Single `= this.xxx` dataview inline directives
  out = out.replace(/`=[^`]*`/g, "");
  // **Source**: *italic* trailing line — keep, the card renders it too
  // from the fence's `source:` field; duplication is harmless but ugly,
  // so drop the trailing `**Source**: *…*` line if present.
  out = out.replace(/^\s*\*\*Source\*\*:\s*\*[^\n]*\*\s*$/m, "");
  return out;
}

async function main() {
  const files = globSync(`${ITEM_DIR}/**/*.md`);
  let changed = 0;
  for (const f of files) {
    const res = await migrateFile(f);
    if (res.changed) {
      changed++;
      console.log(`${WRITE ? "WROTE" : "dry-run"}  ${f}`);
    }
  }
  console.log(`\n${WRITE ? "Migrated" : "Would migrate"} ${changed} / ${files.length} files.`);
  if (!WRITE) console.log("(pass --write to mutate)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
