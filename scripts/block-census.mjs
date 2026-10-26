#!/usr/bin/env node
/**
 * A census of every `rpg` block: where the plugin defines it, which stylesheet
 * draws it, and the real notes in a vault that use it — with the best few
 * picked as examples to review. Feeds the `/ui-review` command.
 *
 *   node scripts/block-census.mjs [--vault <dir>]... [--json out.json] [--md out.md]
 *
 * Vaults default to the repo's own `vault/` plus `$RPG_VAULT_ROOT` when set. A
 * note counts as "real" content when it is not under a tests / examples /
 * sandbox folder.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[++i]);
  return out;
};
const vaults = [...flag("--vault")];
if (vaults.length === 0) {
  vaults.push(path.join(root, "vault"));
  if (process.env.RPG_VAULT_ROOT) vaults.push(process.env.RPG_VAULT_ROOT);
}
const [jsonOut] = flag("--json");
const [mdOut] = flag("--md");

const SKIP_DIRS = new Set([".git", ".obsidian", "node_modules", ".claude", ".trash"]);
const TEST_PATH = /(^|\/)(tests?|examples?|sandbox|sessions)(\/|$)/i;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// ---- 1. what the plugin defines -------------------------------------------------

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const rel = (p) => path.relative(root, p).split(path.sep).join("/");

/** Views registered with a fixed fence name (`codeblock = "show"`). */
const definitions = new Map(); // fence name (or "family.*") → { source, kind }
for (const f of walk(path.join(root, "lib/views"))) {
  for (const m of read(f).matchAll(/codeblock\s*=\s*"([^"]+)"/g))
    definitions.set(m[1], { source: rel(f), kind: "view" });
}
for (const [legacy, meta] of Object.entries({
  ability: "attributes",
  "event-btns": "events",
})) {
  if (definitions.has(meta)) definitions.set(legacy, { ...definitions.get(meta), kind: "legacy alias" });
}

/** Blocks defined by code that is not a view class. */
const KNOWN = {
  "rule.content": {
    source: "lib/domains/rules/parse-rule-block.ts, lib/plugin/rule-call-processor.tsx",
    kind: "built-in (rule note)",
  },
  "rule.side": {
    source: "lib/domains/rules/parse-rule-block.ts, vault/*/config/rule-views.tsx",
    kind: "built-in (rule note)",
  },
  "rule.tab": {
    source: "lib/domains/rules/parse-rule-block.ts, vault/*/config/rule-views.tsx",
    kind: "built-in (rule note)",
  },
  "rule.related": { source: "lib/domains/rules/parse-rule-block.ts", kind: "built-in (rule note)" },
  "rule.notes": { source: "lib/domains/rules/parse-rule-block.ts", kind: "built-in (rule note)" },
  expression: {
    source: "lib/systems/parser.ts (a system's expression, shown by system.expressions)",
    kind: "system definition",
  },
  "class.features": { source: "lib/ui/features/ClassFeaturesBlock.tsx", kind: "placeholder" },
  log: { source: "lib/views/SessionLogView.tsx", kind: "view" },
  "map (grid: hex)": { source: "lib/domains/hexmap/, lib/components/hexmap/", kind: "built-in (overworld hex map)" },
  "map (grid: square)": { source: "lib/domains/battlemap/, lib/components/battlemap/", kind: "built-in (battle map)" },
};
for (const [k, v] of Object.entries(KNOWN)) if (!definitions.has(k)) definitions.set(k, v);

/** Entity blocks a system defines in its config (`config/blocks/<family>/<name>.tsx`). */
for (const f of walk(path.join(root, "vault"))) {
  const m = rel(f).match(/\/config\/blocks\/([^/]+)\/([^/]+)\.tsx$/);
  if (m) definitions.set(`${m[1]}.${m[2]}`, { source: rel(f), kind: "system block" });
}

// Built into main.ts's dispatch by prefix.
const PREFIX = {
  table: { source: "lib/domains/tables", kind: "built-in (named table)", css: "rpg-table.css" },
  list: { source: "lib/domains/lists", kind: "built-in (named list)", css: "rpg-list.css" },
  figure: { source: "lib/domains/figures", kind: "built-in (figure)", css: "figure-block.css" },
  map: {
    source: "lib/domains/battlemap, lib/domains/hexmap",
    kind: "built-in (battle or hex map)",
    css: "battlemap.css, hex-map.css",
  },
  spell: { source: "lib/components/SpellCard.tsx", kind: "built-in (spell card)", css: "spell-card.css" },
  rule: {
    source: "vault/*/config/rule-views.tsx",
    kind: "system block (rules)",
    css: "rule-block.css, rule-compendium.css",
  },
};

/** Stylesheet(s) that style a block, found by its class or aria-details hint, else by family name. */
const cssFiles = fs.readdirSync(path.join(root, "lib/styles/components")).filter((f) => f.endsWith(".css"));
const CSS_BY_FAMILY = {
  feature: "feature-card.css, feature-accordion.css, danger-card.css",
  item: "item-card.css, item-magic-card.css",
  stat: "statblock.css",
  inventory: "inventory-block.css, loadout-cards.css",
  log: "session-log*.css (prose, drawer, hud-bar, hotbar, popover, cards)",
  attributes: "ability-cards.css, attributes-display.css",
  skills: "skills-display.css, skill-li.css",
  stats: "stat*.css (diamond, hex-pair, shield)",
  badges: "badge.css, badge-shield.css",
  healthpoints: "health-card.css, fieldset-health.css, progress-health.css",
  consumable: "consumables.css",
  initiative: "initiative*.css",
  events: "event-buttons.css",
  system:
    "system-definition.css, system-attributes-definition.css, system-info.css, conditions-display.css, expressions-display.css",
  features: "features*.css",
  draft: "draft.css",
};
/** A character block's own stylesheet(s); every one shares sheet-surface.css (all widths) and mobile.css (phones). */
const CSS_CHARACTER = {
  header: "banner-header.css, portrait-thumb.css",
  health: "health-card.css, vitals-strip.css, death-save-dots.css, play-toggle.css",
  stats: "stat-diamond.css, stat-hex-pair.css",
  senses: "senses-row.css",
  skills: "skills-row.css, roll-popover.css",
  rolls: "rolls-row.css, roll-popover.css",
  proficiencies: "proficiencies-row.css",
  features: "feature-accordion.css, features-tree.css",
  spells: "spells.css, spell-components.css, spellcasting-display.css",
  inventory: "inventory-block.css, loadout-cards.css",
  description: "character-description.css",
  sheet: "section-row.css, rpg-ui-page.css",
};
const cssFor = (fence) => {
  const [family, name] = fence.split(".");
  if (fence.startsWith("map (")) return fence.includes("hex") ? "hex-map.css" : "battlemap.css";
  if (PREFIX[family]?.css) return PREFIX[family].css;
  if (fence === "log") return CSS_BY_FAMILY.log;
  if (fence === "map (grid: hex)") return "hex-map.css";
  if (fence === "map (grid: square)") return "battlemap.css";
  if (family === "character") return `${CSS_CHARACTER[name] ?? "—"} (+ sheet-surface.css, mobile.css)`;
  if (CSS_BY_FAMILY[family]) return CSS_BY_FAMILY[family];
  const guess = cssFiles.filter((f) => f.toLowerCase().includes((name ?? family).toLowerCase()));
  return guess.join(", ") || "—";
};

function definitionOf(fence) {
  if (definitions.has(fence)) return definitions.get(fence);
  const family = fence.split(/[ .]/)[0];
  if (PREFIX[family] && (NAMED.has(family) || !fence.includes(".")))
    return { source: PREFIX[family].source, kind: PREFIX[family].kind };
  if (PREFIX[family] && family !== "rule") return { source: PREFIX[family].source, kind: PREFIX[family].kind };
  return { source: "—", kind: "not a block the plugin defines (a typo, or an example in a guide)" };
}

// ---- 2. what the vaults use -----------------------------------------------------

const FENCE = /^(\s*(?:>\s*)*)(`{3,}|~{3,})\s*rpg\s+([A-Za-z0-9_.-]+)/;
/** `table.fate-chart`, `list.arcane-1st`: a name the vault chose, not a block type of the plugin. */
const NAMED = new Set(["table", "list"]);
const variants = new Map(); // `table.*` → Set of names
const normalise = (fence) => {
  const [family, ...rest] = fence.split(".");
  if (NAMED.has(family) && rest.length) {
    const key = `${family}.*`;
    (variants.get(key) ?? variants.set(key, new Set()).get(key)).add(rest.join("."));
    return key;
  }
  return fence;
};
const uses = new Map(); // fence → { total, notes: [{ count, vault, path, real, types }] }
const byPath = new Map(); // the same note in two vaults counts once: the later vault (your own) wins
for (const vault of vaults) {
  if (!fs.existsSync(vault)) continue;
  for (const f of walk(vault)) {
    if (!f.endsWith(".md")) continue;
    const rp = path.relative(vault, f).split(path.sep).join("/");
    const types = new Map();
    const lines = fs.readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      const m = line.match(FENCE);
      if (!m) return;
      let t = normalise(m[3]);
      // `map` is two blocks: an overworld hex map and a square battle map.
      if (t === "map") {
        const head = lines.slice(i + 1, i + 12).join("\n");
        t = /^\s*(?:>\s*)*grid:\s*["']?hex/m.test(head) ? "map (grid: hex)" : "map (grid: square)";
      }
      types.set(t, (types.get(t) ?? 0) + 1);
    });
    if (types.size === 0) byPath.delete(rp);
    else byPath.set(rp, { vault: path.basename(vault), path: rp, real: !TEST_PATH.test(rp), types });
  }
}
const notes = [...byPath.values()];
for (const note of notes) {
  for (const [t, count] of note.types) {
    const u = uses.get(t) ?? { total: 0, notes: [] };
    u.total += count;
    u.notes.push({ ...note, count });
    uses.set(t, u);
  }
}

/** Best examples first: real content, a few blocks of the type, and a note that shows the family in company. */
function examples(fence, limit = 3) {
  const u = uses.get(fence);
  if (!u) return [];
  const score = (n) =>
    (n.real ? 100 : 0) +
    (n.count >= 1 && n.count <= 4 ? 20 : n.count <= 10 ? 8 : 0) +
    Math.min(n.types.size, 8) * 3 -
    Math.min(n.count, 40) * 0.5 -
    (n.vault === "vault" ? 5 : 0);
  return [...u.notes].sort((a, b) => score(b) - score(a) || a.path.localeCompare(b.path)).slice(0, limit);
}

// ---- 3. report --------------------------------------------------------------------

const fences = new Set([...uses.keys(), ...[...definitions.keys()]]);
const rows = [...fences]
  .map((fence) => {
    const def = definitionOf(fence);
    const u = uses.get(fence);
    return {
      fence,
      family: fence.split(/[ .]/)[0],
      kind: def.kind,
      source: def.source,
      css: cssFor(fence),
      uses: u?.total ?? 0,
      notes: u?.notes.length ?? 0,
      realNotes: u?.notes.filter((n) => n.real).length ?? 0,
      examples: examples(fence).map((n) => ({ vault: n.vault, path: n.path, count: n.count, real: n.real })),
    };
  })
  .sort((a, b) => a.family.localeCompare(b.family) || b.uses - a.uses || a.fence.localeCompare(b.fence));

const families = [...new Set(rows.map((r) => r.family))].map((family) => {
  const rs = rows.filter((r) => r.family === family);
  return {
    family,
    blocks: rs.length,
    uses: rs.reduce((n, r) => n + r.uses, 0),
    unused: rs.filter((r) => r.uses === 0).map((r) => r.fence),
    top: rs[0].fence,
  };
});

// A note that shows many families: the page-level examples.
const pages = notes
  .filter((n) => n.real)
  .map((n) => ({ ...n, families: new Set([...n.types.keys()].map((t) => t.split(/[ .]/)[0])) }))
  .sort((a, b) => b.types.size - a.types.size || b.families.size - a.families.size || a.path.localeCompare(b.path))
  .slice(0, 14);

if (jsonOut)
  fs.writeFileSync(
    jsonOut,
    JSON.stringify(
      {
        vaults,
        families,
        blocks: rows,
        pages: pages.map((p) => ({
          vault: p.vault,
          path: p.path,
          families: [...p.families],
          blocks: Object.fromEntries(p.types),
        })),
      },
      null,
      2
    )
  );

const md = [];
md.push("# Block census");
md.push("");
md.push(
  `Generated by \`node scripts/block-census.mjs\`. Vaults read: ${vaults.map((v) => `\`${path.basename(v)}\``).join(", ")}.`
);
md.push("");
md.push(
  `${rows.length} distinct \`rpg\` block types in ${families.length} families; ${notes.length} notes use at least one.`
);
md.push("");
md.push("## Families");
md.push("");
md.push("| Family | Block types | Uses | Most used | Defined but unused |");
md.push("|---|---:|---:|---|---|");
for (const f of families)
  md.push(
    `| \`${f.family}\` | ${f.blocks} | ${f.uses} | \`${f.top}\` | ${f.unused.length ? f.unused.map((u) => `\`${u}\``).join(", ") : "—"} |`
  );
md.push("");
md.push("## Blocks, with real examples");
md.push("");
md.push(
  "Examples are ordered best first: real content over tests, a few blocks of the type in the note, and a note that shows the family in company. `real` counts notes outside tests, examples and sandbox folders."
);
md.push("");
let lastFamily = "";
for (const r of rows) {
  if (r.family !== lastFamily) {
    if (lastFamily) md.push("");
    md.push(`### \`${r.family}\``);
    md.push("");
    lastFamily = r.family;
  }
  const named = variants.get(r.fence);
  md.push(
    `- **\`${r.fence}\`** — ${r.uses} use${r.uses === 1 ? "" : "s"} in ${r.notes} note${r.notes === 1 ? "" : "s"} (${r.realNotes} real). ${r.kind}${named ? `; ${named.size} different names` : ""}.`
  );
  md.push(`  - Defined in: \`${r.source}\` · styled by: ${r.css}`);
  if (r.examples.length === 0) md.push("  - Examples: none in these vaults.");
  for (const e of r.examples)
    md.push(`  - ${e.real ? "Example" : "Test note"}: \`${e.vault}/${e.path}\` (${e.count} here)`);
}
md.push("");
md.push("## Surfaces that are not blocks");
md.push("");
md.push("Review these too; they have no fence of their own, so the census cannot find them.");
md.push("");
md.push("| Surface | Where it lives | Reach it by |");
md.push("|---|---|---|");
md.push(
  "| Plugin settings (5 tabs) | `lib/plugin/settings-tab.ts`, `settings-tab.css` | Settings, then Dnd UI Toolkit |"
);
md.push(
  "| Log: actions drawer, hotbar, roster, HUD | `lib/components/session-log/`, `session-log-*.css` | Open a note with an `rpg log` block, press A |"
);
md.push(
  "| Log: card form (the popup that adds to the log) | `placeholder-popover.tsx`, `session-log-popover.css` | Pick a tile in the drawer |"
);
md.push(
  "| Log: sidebar, bookkeeping review, bottom bar (phone) | `log-sidebar.tsx`, `bookkeeping.tsx`, `bottom-drawer.tsx` | Same note; Log and Save |"
);
md.push("| Battle map pane in a log | `lib/components/battlemap/battle-pane.tsx` | A log with `[COMBAT: …]` |");
md.push(
  "| Battle map note: Place tokens, Expand | `map-token-editor.tsx`, `map-pan-zoom.tsx` | A note with an `rpg map` square block |"
);
md.push(
  "| Hex map: play, mark and build modes, Expand | `lib/components/hexmap/`, `hex-map.css` | A note with `grid: hex` |"
);
md.push(
  "| Image studio, card frames | `lib/components/image-studio/`, `card-frame.css` | Command: Open image studio |"
);
md.push("| New battle map note | `lib/plugin/new-map-modal.ts` | Command: New battle map note |");
md.push("| Roll popover (sheet) | `lib/ui/dice/RollPopover.tsx`, `roll-popover.css` | Tap a skill or an attack |");
md.push("");
md.push("## Pages that show many families");
md.push("");
md.push("Good single pages to review end to end.");
md.push("");
md.push("| Note | Families | Block types |");
md.push("|---|---|---:|");
for (const p of pages)
  md.push(`| \`${p.vault}/${p.path}\` | ${[...p.families].map((f) => `\`${f}\``).join(" ")} | ${p.types.size} |`);
md.push("");

const text = md.join("\n");
if (mdOut) fs.writeFileSync(mdOut, text);
else if (!jsonOut) process.stdout.write(text);
