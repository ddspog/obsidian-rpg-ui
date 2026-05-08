#!/usr/bin/env node
/**
 * Migrate Tales-of-the-Valiant item markdown files from the old
 * dot-keyed frontmatter + `tx` / `dataviewjs` rendering into a single
 * `rpg item.element` fence body, preserving every field the source
 * carried:
 *
 *   - `.item` block  → type, cost, weight, desc (joined reference_desc),
 *                      image (reference_img), source
 *   - `.container`   → container.volume_cap, container.weight_cap
 *   - `.shop`        → shop.cheap, shop.expensive, shop.availability
 *
 * Weight `__` collapses to no weight entry (the inventory resolver treats
 * "no weight" as 0 lb., which is what "__" meant in the legacy schema).
 * The trailing `Source:` prose is emitted as plain markdown below the
 * fence so the card + note footer both surface it, matching the Longsword
 * / Shield pattern already in the plugin-side folder.
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const SRC_ROOT =
  "/Users/ddspog/src/github.com/ddspog/testing-vault/systems/tales-of-the-valiant/worldbuilding/items";
const DST_ROOT =
  "/Users/ddspog/src/github.com/ddspog/testing-vault/.obsidian/plugins/obsidian-rpg-ui/vault/systems/tales-of-the-valiant/worldbuilding/items";
const FOLDERS = ["adventuring-gear", "clothes", "containers", "pack-items"];

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  return { fm: YAML.parse(m[1]) ?? {}, body: m[2] };
}

/** Build a YAML doc from an ordered list of key/value pairs so the
 *  fence reads top-down: type → cost → weight → image → desc →
 *  container → shop. The `yaml` package emits keys alphabetically when
 *  given a raw object, which would reorder the fence; using a Document
 *  with explicit key ordering keeps authored ordering stable. */
function buildFenceBody(pairs) {
  const doc = new YAML.Document();
  const map = doc.createNode({}, { flow: false });
  doc.contents = map;
  for (const [k, v] of pairs) {
    if (v === undefined || v === null || v === "") continue;
    map.set(k, v);
  }
  return doc.toString({ lineWidth: 0 }).trimEnd();
}

/** reference_desc is either a list of markdown embeds, a list of prose
 *  strings, or a mix. Join them with blank lines — authors who wrote
 *  embeds expect them to stay standalone; prose entries read fine as
 *  separate paragraphs. */
function buildDesc(raw) {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  if (!Array.isArray(raw)) return String(raw);
  const parts = raw
    .map((x) => (typeof x === "string" ? x.trim() : String(x)))
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join("\n\n");
}

/** `__` was the legacy placeholder for "weightless" (amulets, parchment,
 *  signet rings). Drop it so the inventory encumbrance pass treats the
 *  item as 0 lb. rather than parsing "__" as NaN. */
function cleanWeight(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s || s === "__") return undefined;
  return s;
}

function migrateFile(srcPath, folder) {
  const text = fs.readFileSync(srcPath, "utf8");
  const { fm } = splitFrontmatter(text);
  const base = path.basename(srcPath, ".md");

  const container = {};
  if (fm.volume_cap) container.volume_cap = String(fm.volume_cap);
  if (fm.weight_cap) container.weight_cap = String(fm.weight_cap);

  const shop = {};
  if (fm.cheap) shop.cheap = String(fm.cheap);
  if (fm.expensive) shop.expensive = String(fm.expensive);
  if (Array.isArray(fm.availability)) shop.availability = fm.availability.map(String);

  const pairs = [
    ["type", fm.type ? String(fm.type) : "Adventuring Gear"],
    ["cost", fm.cost ? String(fm.cost) : undefined],
    ["weight", cleanWeight(fm.weight)],
    ["image", fm.reference_img ? String(fm.reference_img) : undefined],
    ["desc", buildDesc(fm.reference_desc)],
  ];
  if (Object.keys(container).length > 0) pairs.push(["container", container]);
  if (Object.keys(shop).length > 0) pairs.push(["shop", shop]);

  const fenceBody = buildFenceBody(pairs);
  const source = fm.source ? String(fm.source) : "";

  const out = [
    "---",
    'cssclasses: ["note-item"]',
    "---",
    `# ${base}`,
    "```rpg item.element",
    fenceBody,
    "```",
    "",
  ];
  if (source) {
    out.push(`**Source**: _${source.replace(/^From\s+/i, "From ")}_`);
    out.push("");
  }
  return out.join("\n");
}

let migrated = 0;
let skipped = 0;
for (const folder of FOLDERS) {
  const srcDir = path.join(SRC_ROOT, folder);
  const dstDir = path.join(DST_ROOT, folder);
  if (!fs.existsSync(srcDir)) continue;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    if (!entry.endsWith(".md")) continue;
    const src = path.join(srcDir, entry);
    const dst = path.join(dstDir, entry);
    try {
      fs.writeFileSync(dst, migrateFile(src, folder));
      migrated++;
    } catch (err) {
      console.error(`Failed: ${src} — ${err.message}`);
      skipped++;
    }
  }
}
console.log(`Migrated ${migrated} item files${skipped ? ` (skipped ${skipped})` : ""}.`);
