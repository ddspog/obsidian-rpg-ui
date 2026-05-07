#!/usr/bin/env node
/**
 * migrate-spells.mjs — convert every spell doc under
 * `worldbuilding/spells/` from the frontmatter + `tx`-blocks authoring
 * shape to a single `rpg spell` fence with the fields as YAML body.
 *
 * Runs against both the plugin's `vault/systems/.../worldbuilding/spells`
 * and the real vault root's `systems/.../worldbuilding/spells` so the
 * on-disk canonical copy and the plugin-bundled copy stay in sync.
 *
 * Idempotent: files already migrated (no `.spell:` frontmatter section
 * present) are left alone.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(pluginRoot, "../../..");

const SPELL_REL = "systems/tales-of-the-valiant/worldbuilding/spells";
const ROOTS = [
  path.join(pluginRoot, "vault", SPELL_REL),
  path.join(vaultRoot, SPELL_REL),
];

// ── Frontmatter parsing ─────────────────────────────────────────────────

const FM_FIELDS = [
  "circle",
  "magic_source",
  "school",
  "casting",
  "range",
  "components",
  "duration",
  "style",
  "summary",
  "reference_desc",
  "reference_img",
  "source",
];

function stripFrontmatterSectionMarkers(raw) {
  // The user's frontmatter uses null-valued section markers (`.spell:`,
  // `.effect:`, `.item:`, `.metadata:`) as visual separators. YAML parses
  // these as top-level keys with null values and flat sibling fields.
  // Drop those marker lines so the parser sees a clean flat mapping.
  return raw
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Match e.g. ".spell:" or ".spell: " (no value) at indent zero.
      if (/^\.\w+\s*:\s*$/.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

function extractFrontmatterAndBody(contents) {
  const m = contents.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: contents };
  return { frontmatter: m[1], body: m[2] };
}

// ── Body assembly ───────────────────────────────────────────────────────

function cleanupDataviewTail(raw) {
  // Remove inline dataview leftovers (`\`= this.foo\``, `\`= join(this.…)\``,
  // and the `**Source**: *\`= this.source\`*` line) from already-migrated
  // docs. Keep the rpg spell fence and any real prose intact.
  const filtered = raw
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^`\s*=\s*this\./.test(t)) return false;
      if (/^`\s*=\s*join\(this\./.test(t)) return false;
      if (/\*?\*?Source\*?\*?\s*:\s*\*?`\s*=\s*this\.source/.test(t)) return false;
      return true;
    })
    .join("\n");
  // Collapse any run of 3+ blank lines left behind by the filter down to 2.
  return filtered.replace(/\n{3,}/g, "\n\n");
}

function toSpellBody(fm) {
  const body = {};
  for (const key of FM_FIELDS) {
    const v = fm[key];
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    body[key] = v;
  }
  return body;
}

function formatSpellBlock(body) {
  const yaml = stringifyYaml(body, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).replace(/\n+$/, "");
  return "```rpg spell\n" + yaml + "\n```";
}

// ── Migration ──────────────────────────────────────────────────────────

async function migrateFile(abs) {
  const raw = await fs.readFile(abs, "utf8");
  const { frontmatter, body } = extractFrontmatterAndBody(raw);

  // Cleanup pass for already-migrated files: strip any leftover
  // inline-dataview lines that referenced the old frontmatter fields
  // (the first migration regex only caught fenced `tx` blocks).
  if (!frontmatter || !/^\.spell\s*:/m.test(frontmatter)) {
    const cleaned = cleanupDataviewTail(raw);
    if (cleaned !== raw) {
      await fs.writeFile(abs, cleaned, "utf8");
      return { status: "cleaned-tail", path: abs };
    }
    return { status: "skip-already-migrated", path: abs };
  }

  let fm;
  try {
    fm = parseYaml(stripFrontmatterSectionMarkers(frontmatter)) ?? {};
  } catch (err) {
    return { status: "error-parse-frontmatter", path: abs, err: err.message };
  }

  const spellBody = toSpellBody(fm);
  const stem = path.basename(abs).replace(/\.md$/, "");

  // Strip the three `tx`-blocks the user authored for live-preview
  // rendering (they're redundant under the new rpg-spell card), plus
  // any inline dataview expressions that referenced the spell fields
  // outside the tx blocks. Keep everything else (H1, prose paragraphs,
  // footnotes) so authoring extras aren't lost.
  const trimmedBody = body
    .replace(/```tx[\s\S]*?```\n?/g, "")
    // Drop any line that's just an inline dataview expression
    // (`= this.foo`, wrapped in backticks) — those referenced the old
    // frontmatter fields and are redundant now.
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^`\s*=\s*this\./.test(t)) return false;
      if (/^`\s*=\s*join\(this\./.test(t)) return false;
      // Drop source-line variants like `**Source**: *\`= this.source\`*`.
      if (/\*?\*?Source\*?\*?\s*:\s*\*?`\s*=\s*this\.source/.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();

  // Keep any `cssclasses:` metadata on a minimal frontmatter so
  // Obsidian's `note-spell` class chain still applies when present.
  const meta = fm[".metadata"] ?? {};
  const cssclasses = Array.isArray(fm.cssclasses)
    ? fm.cssclasses
    : Array.isArray(meta.cssclasses)
      ? meta.cssclasses
      : [];

  const newFrontmatter = cssclasses.length > 0
    ? "---\ncssclasses:\n" + cssclasses.map((c) => `  - ${c}`).join("\n") + "\n---\n"
    : "";

  const heading = `# ${stem}\n\n`;
  const spellFence = formatSpellBlock(spellBody);
  // Keep any trailing narrative after the original frontmatter (footnotes,
  // source tables, …) AFTER the rpg spell fence so authoring extras
  // aren't lost.
  const trailer = trimmedBody
    .replace(/^#\s+[^\n]+\n?/, "") // drop duplicate H1
    .trim();

  const next = newFrontmatter + heading + spellFence + (trailer ? "\n\n" + trailer + "\n" : "\n");
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
    // Skip the spell-lists subfolder — those are aggregation/list docs,
    // not per-spell entries.
    const targets = files.filter((f) => !f.includes("/spell-lists/"));
    for (const abs of targets) {
      total++;
      const res = await migrateFile(abs);
      if (res.status === "migrated" || res.status === "cleaned-tail") {
        migrated++;
        console.log(`  ${res.status === "cleaned-tail" ? "~" : "✓"} ${path.relative(process.cwd(), abs)}`);
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
