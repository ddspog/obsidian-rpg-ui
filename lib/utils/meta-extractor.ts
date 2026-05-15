import { MarkdownPostProcessorContext } from "obsidian";

/**
 * Maps top-level YAML keys found in a code block's source to the corresponding
 * meta identifier (view codeblock value). Ordered from most specific to least.
 *
 * In Obsidian's code block processor, `el` is an empty container that the plugin
 * writes into — it does NOT contain the original code HTML. The `source` parameter
 * is the only reliable way to access the YAML content in all rendering modes.
 */
const SOURCE_KEY_TO_META: Array<{ keys: string[]; meta: string }> = [
  // ShowView: entries / table / cards
  { keys: ["entries", "table", "cards"], meta: "show" },
  // System definition views
  { keys: ["skills"], meta: "system.skills" },
  { keys: ["features"], meta: "system.features" },
  { keys: ["expressions"], meta: "system.expressions" },
  { keys: ["spellcasting", "casting_time", "castingTime"], meta: "system.spellcasting" },
  { keys: ["conditions"], meta: "system.conditions" },
  { keys: ["name"], meta: "system" },
  // Character sheet views
  { keys: ["proficiencies", "expertise", "half_proficiencies"], meta: "skills" },
  { keys: ["health", "hitdice", "hit_dice", "death_saves"], meta: "healthpoints" },
  { keys: ["sections", "currency"], meta: "inventory" },
  { keys: ["categories"], meta: "features" },
  { keys: ["components", "range", "duration"], meta: "spell" },
  // attributes must come after spell/features/etc. to avoid false positives
  { keys: ["attributes"], meta: "system.attributes" },
  // consumable / initiative share 'items' — consumable also has 'uses'
  { keys: ["items", "uses"], meta: "consumable" },
  { keys: ["items"], meta: "initiative" },
];

/**
 * Detects the meta identifier from raw YAML source by checking for distinctive
 * top-level keys. This is the reliable fallback used in reading view where
 * getSectionInfo returns null and the element contains no code HTML.
 */
function detectMetaFromSource(source: string): string | null {
  // Parse only the top-level keys by scanning for "key:" at the start of lines
  // (no YAML library needed — avoids circular dependency and is fast)
  const topLevelKeys = new Set<string>();
  for (const line of source.split("\n")) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (m) topLevelKeys.add(m[1]);
  }

  // Feature blocks — checked BEFORE the SOURCE_KEY_TO_META table so the
  // generic `name → system` fallback doesn't capture them. The fence is the
  // authoritative meta source (preferred via getSectionInfo), but in reading
  // mode that can fail; these heuristics keep `rpg feature.{details,choice,unlock,level}`
  // dispatching correctly.
  if (topLevelKeys.has("parent")) return "feature.choice";
  if (topLevelKeys.has("kind") && topLevelKeys.has("level")) return "feature.unlock";
  // feature.level is data-only: just `level` (+ maybe `traits`) with no name,
  // parent, or kind markers.
  if (
    topLevelKeys.has("level") &&
    !topLevelKeys.has("name") &&
    !topLevelKeys.has("parent") &&
    !topLevelKeys.has("kind")
  ) {
    return "feature.level";
  }
  // `rpg rule.side` fence body — pure YAML with keys like `direction`,
  // `title`, `content`, `type`, `kind`, `color`, `icon`. The `direction`
  // key is unique to rule.side; `title` + `content` (without `name`) is
  // a strong secondary signal. Check BEFORE the `---` separator heuristic
  // so embedded side blocks inside whole-file imports route correctly.
  if (
    topLevelKeys.has("direction") ||
    (topLevelKeys.has("title") && topLevelKeys.has("content") && !topLevelKeys.has("name"))
  ) {
    return "rule.side";
  }

  // `rpg rule.content` fence body — YAML frontmatter + `---` + markdown.
  // The standalone `---` line distinguishes it from feature.details and
  // other YAML-only blocks. Check FIRST so blocks with both `name:` and
  // `values:` (which would otherwise be claimed by feature.details below)
  // route to the rule.content handler when embedded.
  const sourceLines = source.split("\n");
  const sepLineIdx = sourceLines.findIndex((l) => l.trim() === "---");
  if (sepLineIdx > 0 && sepLineIdx < sourceLines.length - 1) {
    return "rule.content";
  }

  const featureMarkers = ["subtitle", "tag", "pick", "uses", "link", "value", "values", "type"];
  if (topLevelKeys.has("name") && featureMarkers.some((k) => topLevelKeys.has(k))) {
    return "feature.details";
  }

  // Skip the generic `name → system` fallback for bare-`name` blocks: that
  // mapping was too permissive and would steal `rpg feature.details` blocks
  // whose YAML happens to be just `name: …`. We retain the more specific
  // entries (attributes, skills, etc.) but prefer feature.details when only
  // `name` is present, since system-definition fences in practice carry
  // additional system-specific keys (attributes, expressions, …).
  for (const { keys, meta } of SOURCE_KEY_TO_META) {
    if (meta === "system") continue;
    if (keys.some((k) => topLevelKeys.has(k))) {
      return meta;
    }
  }

  // `rpg table.<name>` body — a markdown table, sometimes preceded by a
  // `key:` option line. The fence's `<name>` suffix can't be recovered from
  // the body alone, so we return the bare meta `"table"` and let the
  // dispatcher recover the name from `sectionInfo.text` when needed.
  const lines = source.split("\n");
  const hasPipeRow = lines.some((l) => /^\s*\|.*\|/.test(l.trim()));
  const hasSeparator = lines.some((l) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim()));
  if (hasPipeRow && hasSeparator) return "table";

  // Final fallback: a block with `name:` and no other recognised marker is
  // overwhelmingly a feature.details in compendium docs. Route it that way
  // rather than misrouting to SystemView.
  if (topLevelKeys.has("name")) return "feature.details";

  return null;
}

/**
 * Extracts the meta identifier from an rpg code block.
 * The meta is the word(s) after "rpg" in the fence line (e.g., "attributes" from the fence rpg attributes).
 *
 * Strategy (in order):
 *  1. data-language attribute on el
 *  2. getSectionInfo — works in edit mode and live preview
 *  3. source YAML key detection — works in reading view where el is an empty container
 *
 * @param ctx - The markdown post processor context
 * @param el - The HTML element (empty container in reading view)
 * @param source - The raw YAML source of the block (always available in code block processors)
 * @returns The meta identifier or null if extraction fails
 */
export function extractMeta(ctx: MarkdownPostProcessorContext, el: HTMLElement, source?: string): string | null {
  try {
    // 1. data-language attribute (some Obsidian builds expose this)
    const lang = el.getAttribute("data-language");
    if (lang && lang.startsWith("rpg")) {
      const match = lang.match(/^rpg\s+(\S+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 2. getSectionInfo — reliable in edit mode and live preview
    const sectionInfo = ctx.getSectionInfo(el);
    if (sectionInfo && sectionInfo.text) {
      const lines = sectionInfo.text.split("\n");
      if (lines.length > 0) {
        // Search backward from lineStart to find the fence
        for (let i = sectionInfo.lineStart; i >= Math.max(0, sectionInfo.lineStart - 5); i--) {
          const line = lines[i];
          if (line && line.includes("rpg")) {
            const match = line.match(/rpg\s+(\S+)/);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
        // Also search forward
        for (let i = sectionInfo.lineStart; i < Math.min(lines.length, sectionInfo.lineStart + 5); i++) {
          const line = lines[i];
          if (line && line.includes("rpg")) {
            const match = line.match(/rpg\s+(\S+)/);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
      }
    }

    // 3. Source YAML key detection — reading view fallback
    // In reading view, el is an empty container provided for rendering output,
    // not the original code block element.  The `source` parameter is the only
    // way to access the block content in that context.
    if (source) {
      return detectMetaFromSource(source);
    }

    return null;
  } catch (e) {
    console.error("Error extracting meta from code block:", e);
    return null;
  }
}
