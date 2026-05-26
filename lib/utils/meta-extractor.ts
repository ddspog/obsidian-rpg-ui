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
export function detectMetaFromSource(source: string): string | null {
  // Parse only the top-level keys by scanning for "key:" at the start of lines
  // (no YAML library needed — avoids circular dependency and is fast)
  const topLevelKeys = new Set<string>();
  for (const line of source.split("\n")) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (m) topLevelKeys.add(m[1]);
  }

  // ── Fence-mode blocks (YAML header + `---` + markdown/nested fences) ──
  // Must run FIRST: the body after `---` can contain nested rpg fences
  // whose YAML keys (parent, type, direction, …) would mislead the
  // `topLevelKeys` checks below. Only `headerKeys` (above the separator)
  // are safe for classification.
  const sourceLines = source.split("\n");
  const sepLineIdx = sourceLines.findIndex((l) => l.trim() === "---");
  if (sepLineIdx > 0 && sepLineIdx < sourceLines.length - 1) {
    const headerKeys = new Set<string>();
    for (let i = 0; i < sepLineIdx; i++) {
      const m = sourceLines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
      if (m) headerKeys.add(m[1]);
    }
    // rule.side fence-mode: `kind:` (float/callout/commentary), `type:`
    // (preset name), or `title:` without `name:` (side uses title, not name).
    // `type` alone is ambiguous — feature.details also uses `type: passive`;
    // require absence of `name` to avoid stealing feature blocks.
    if (
      headerKeys.has("kind") ||
      (headerKeys.has("type") && !headerKeys.has("name")) ||
      (headerKeys.has("title") && !headerKeys.has("name"))
    ) {
      return "rule.side";
    }
    if (headerKeys.has("icon") || headerKeys.has("color")) {
      return "rule.tab";
    }
    // feature.choice in fence-mode
    if (headerKeys.has("parent")) return "feature.choice";
    // feature.details in fence-mode (YAML + --- + markdown body).
    // Distinguishes from rule.content by having `name:` plus structural
    // keys unique to the feature schema (rule.content uses `id:`, not `name:`).
    if (headerKeys.has("name")) {
      const featureHeaderMarkers = [
        "subtitle", "traits", "level", "pick", "resource",
        "action", "reaction", "passive", "bonus", "active",
        "spellcasting", "choose", "roll", "tag", "uses",
        "link", "value", "values", "update", "type",
      ];
      if (featureHeaderMarkers.some((k) => headerKeys.has(k))) {
        return "feature.details";
      }
    }
    return "rule.content";
  }

  // ── Pure-YAML blocks (no `---` separator) ─────────────────────────────
  // `topLevelKeys` is safe here since there's no markdown body that could
  // contain nested fence YAML.
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
  if (
    topLevelKeys.has("direction") ||
    (topLevelKeys.has("title") && topLevelKeys.has("content") && !topLevelKeys.has("name"))
  ) {
    return "rule.side";
  }

  // `rpg rule.related` — YAML array of embeds/call tokens, or object
  // with `entries:` + optional `level:`/`view:`. Distinguished from `rpg show`
  // (which also uses `entries:`) by the presence of `view:` co-key or array
  // items containing `![[` embeds / `@[[` call tokens.
  if (topLevelKeys.has("entries") && topLevelKeys.has("view")) return "rule.related";
  const sourceLines2 = source.split("\n");
  const hasArrayItems = sourceLines2.some((l) => /^\s*-\s/.test(l));
  if (hasArrayItems) {
    const hasEmbedOrCall = sourceLines2.some((l) =>
      /!\[\[|@\[\[/.test(l)
    );
    if (hasEmbedOrCall) return "rule.related";
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

  // `rpg rule.notes` — pure markdown/text with no YAML structure.
  // Only block type designed for arbitrary prose, so if nothing else
  // matched and the source has content, treat it as notes.
  if (source.trim().length > 0 && topLevelKeys.size === 0) return "rule.notes";

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
