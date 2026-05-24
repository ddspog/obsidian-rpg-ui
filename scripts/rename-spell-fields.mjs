#!/usr/bin/env node
/**
 * rename-spell-fields.mjs — one-shot rename pass over the spell docs
 * already migrated to the `rpg spell` fence shape. Applies:
 *
 *   magic_source:   → source:
 *   reference_desc: → text:     (array-of-paragraphs → `|`-block string)
 *   reference_img:  → image:
 *   source:         → dropped from YAML; emit `**Source**: *…*` line
 *                     AFTER the fence so book attribution lives in
 *                     plain markdown (mirrors how feature compendium
 *                     docs handle attribution).
 *
 * Runs across both the plugin's `vault/...` tree and the real vault
 * root so the on-disk canonical copy and the plugin-bundled copy stay
 * in sync. Idempotent: files already using the new shape are left
 * alone.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(pluginRoot, "../../..");

const SPELL_REL = "tales-of-the-valiant/worldbuilding/spells";
const ROOTS = [
  path.join(pluginRoot, "vault", SPELL_REL),
  path.join(vaultRoot, SPELL_REL),
];

// ── Fence extraction ────────────────────────────────────────────────────

const FENCE_RE = /```+\s*rpg\s+spell\s*\n([\s\S]*?)```+/g;

function paragraphsToMarkdown(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .filter((v) => typeof v === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof value === "string") return value.trim();
  return "";
}

function buildYamlBody(data) {
  const ordered = {};
  // Keep a predictable field order so diffs stay clean.
  const ORDER = [
    "circle",
    "source",
    "school",
    "casting",
    "range",
    "components",
    "duration",
    "style",
    "summary",
    "text",
    "image",
    "name",
  ];
  for (const key of ORDER) {
    if (data[key] == null) continue;
    if (Array.isArray(data[key]) && data[key].length === 0) continue;
    if (typeof data[key] === "string" && data[key].trim() === "") continue;
    ordered[key] = data[key];
  }
  // Carry through anything else the doc had that we don't recognise
  // (author-specific extras).
  for (const key of Object.keys(data)) {
    if (!(key in ordered) && data[key] != null) ordered[key] = data[key];
  }
  return stringifyYaml(ordered, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
    blockQuote: "literal",
  }).replace(/\n+$/, "");
}

async function migrateFile(abs) {
  const raw = await fs.readFile(abs, "utf8");
  const match = FENCE_RE.exec(raw);
  FENCE_RE.lastIndex = 0; // reset (global regex)
  if (!match) return { status: "skip-no-fence", path: abs };
  const yamlText = match[1];

  let data;
  try {
    data = parseYaml(yamlText) ?? {};
  } catch (err) {
    return { status: "error-parse", path: abs, err: err.message };
  }

  // Detect whether this file still has the old field names.
  const hasOld =
    "magic_source" in data ||
    "reference_desc" in data ||
    "reference_img" in data ||
    // `source` is old-form when it's a STRING (book attribution).
    (typeof data.source === "string");
  if (!hasOld) return { status: "skip-already-renamed", path: abs };

  // ── Apply renames ───────────────────────────────────────────────────
  let trailingSource = null;
  if (typeof data.source === "string") {
    trailingSource = data.source.trim();
    delete data.source;
  }
  if ("magic_source" in data) {
    data.source = data.magic_source;
    delete data.magic_source;
  }
  if ("reference_desc" in data) {
    data.text = paragraphsToMarkdown(data.reference_desc);
    delete data.reference_desc;
  }
  if ("reference_img" in data) {
    data.image = data.reference_img;
    delete data.reference_img;
  }

  // ── Rebuild the doc ─────────────────────────────────────────────────
  const newFence = "```rpg spell\n" + buildYamlBody(data) + "\n```";
  const before = raw.slice(0, match.index);
  const after = raw.slice(match.index + match[0].length);
  const trailerPieces = [];
  if (trailingSource) {
    trailerPieces.push(`**Source**: *${trailingSource}*`);
  }
  const trailerText = trailerPieces.length > 0 ? "\n\n" + trailerPieces.join("\n") + "\n" : "";
  // Strip any trailing `**Source**: …` line that might already be in the
  // markdown tail so we don't end up with duplicates on re-runs.
  const cleanedAfter = after.replace(/\n*\*\*Source\*\*\s*:\s*.+$/m, "").replace(/\n+$/, "\n");
  const next = before + newFence + "\n" + cleanedAfter.replace(/^\n+/, "\n") + trailerText;

  await fs.writeFile(abs, next, "utf8");
  return { status: "migrated", path: abs };
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && p.endsWith(".md")) out.push(p);
  }
  return out;
}

async function main() {
  let total = 0;
  let migrated = 0;
  let skipped = 0;
  let errored = 0;
  for (const root of ROOTS) {
    const files = await walk(root);
    const targets = files.filter((f) => !f.includes("/spell-lists/"));
    for (const abs of targets) {
      total++;
      const res = await migrateFile(abs);
      if (res.status === "migrated") {
        migrated++;
        console.log(`  ✓ ${path.relative(process.cwd(), abs)}`);
      } else if (res.status.startsWith("skip")) {
        skipped++;
      } else {
        errored++;
        console.error(`  ✗ ${path.relative(process.cwd(), abs)} — ${res.err ?? res.status}`);
      }
    }
  }
  console.log(`\nTotal: ${total}  migrated: ${migrated}  skipped: ${skipped}  errored: ${errored}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
