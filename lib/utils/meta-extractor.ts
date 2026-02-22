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

  for (const { keys, meta } of SOURCE_KEY_TO_META) {
    if (keys.some((k) => topLevelKeys.has(k))) {
      return meta;
    }
  }
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
