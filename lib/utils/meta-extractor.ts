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
 * Recognise `stat.*` entity fences from their YAML key-set. Stat blocks are the
 * one entity family whose identity the body alone can't reveal — but their keys
 * are distinctive enough to classify when the fence info string is unavailable
 * (nested / `.bare()` renders, where `getSectionInfo` returns null):
 *   - stat.monster: nested `stats:` / `abilities:` objects, or a `cr` rating.
 *   - stat.category: a creature-family intro — keyed off `habitat`/`treasure`,
 *     which are stat-block-only fields present whether or not the category
 *     declares an explicit `name:` (a named category with `subtitle`/`level`
 *     would otherwise read as feature.details). `subtitle` alone is a weaker
 *     signal, so it only counts when there's no `name`.
 * Monster is tested first so a categorized monster (which also carries
 * habitat/treasure) is never mistaken for a category.
 */
function detectStatMeta(keys: Set<string>, hasName: boolean): string | null {
  if (keys.has("stats") || keys.has("abilities") || keys.has("cr")) return "stat.monster";
  if (keys.has("habitat") || keys.has("treasure") || (!hasName && keys.has("subtitle"))) {
    return "stat.category";
  }
  return null;
}

/**
 * A mermaid diagram declaration that opens an `rpg figure.mermaid` body.
 *
 * Two tiers keep false positives near zero in the fallback path:
 *   - `flowchart`/`graph` must carry a direction token (`TD`, `LR`, …);
 *   - jargon / camelCase / hyphenated diagram keywords match on a word
 *     boundary (they don't occur as prose sentence-starters);
 *   - the three English-ambiguous keywords (`journey`, `timeline`, `pie`)
 *     must stand ALONE on the line.
 * Case-sensitive: mermaid keywords are lowercase, whereas prose usually
 * capitalises the first word of a body.
 */
const MERMAID_DECL_RE = new RegExp(
  "^(?:" +
    "(?:flowchart|graph)\\s+(?:TB|TD|BT|RL|LR)\\b" +
    "|(?:sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram" +
    "|gitGraph|quadrantChart|requirementDiagram|gantt|mindmap|kanban|treemap" +
    "|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|radar-beta" +
    "|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\\b" +
    "|(?:journey|timeline|pie)\\s*$" +
    ")"
);

/**
 * `rpg figure.mermaid` — a diagram figure. Detected when the body's FIRST
 * meaningful line (after an optional config head + `---`) is a mermaid diagram
 * declaration. Deliberately conservative: only the first body line is
 * inspected, so a rule/feature body that merely embeds a mermaid fence deeper
 * down is never mistaken for a figure.
 */
function looksLikeMermaidFigure(source: string): boolean {
  const lines = source.split("\n");
  const sepIdx = lines.findIndex((l) => l.trim() === "---");
  const bodyStart = sepIdx >= 0 ? sepIdx + 1 : 0;
  for (let i = bodyStart; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    return MERMAID_DECL_RE.test(t);
  }
  return false;
}

/**
 * Detects the meta identifier from raw YAML source by checking for distinctive
 * top-level keys. This is the reliable fallback used in reading view where
 * getSectionInfo returns null and the element contains no code HTML.
 */
/** Lonelog lines: an action (`@(Talon)`), a question (`?`), a roll (`d:`),
 *  an outcome (`=>`), a generator (`gen:`), a tag (`[COMBAT]`), a scene (`S01`). */
const LONELOG_LINE = /^\s*(?:@\(|\?\s|d(?:\([^)]*\))?:|=>|->|gen:|tbl:|\[|S\d|T\d|R\(|PC\()/;

/** Whether a body reads as Lonelog — its first written line one of its kinds. */
function looksLikeLonelog(lines: string[]): boolean {
  const first = lines.find((l) => l.trim());
  return !!first && LONELOG_LINE.test(first);
}

export function detectMetaFromSource(source: string): string | null {
  // `rpg figure.mermaid` — checked first: a leading mermaid diagram
  // declaration is unambiguous and appears in no other block type's body.
  if (looksLikeMermaidFigure(source)) return "figure.mermaid";

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
    const headerValues = new Map<string, string>();
    for (let i = 0; i < sepLineIdx; i++) {
      const m = sourceLines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
      if (m) {
        headerKeys.add(m[1]);
        headerValues.set(m[1], m[2].trim());
      }
    }
    // `rpg log` with its head (`maps:`, `scene:`, `gm:`…) — only a log's own
    // keys above the separator, and Lonelog below it. Must precede feature.gm:
    // `scene:` is a GM head key too, but a GM block's head always names it.
    const LOG_HEAD_KEYS = new Set(["state_key", "scene", "entities", "gm", "maps"]);
    if (
      headerKeys.size > 0 &&
      [...headerKeys].every((k) => LOG_HEAD_KEYS.has(k)) &&
      looksLikeLonelog(sourceLines.slice(sepLineIdx + 1))
    ) {
      return "log";
    }
    // `rpg map` — a battle map: its head names a `grid:` (square/hex) or
    // carries a `legend:` for the drawn cells below the separator.
    if (
      /^(square|hex)$/i.test(headerValues.get("grid") ?? "") ||
      (headerKeys.has("legend") && !headerKeys.has("name"))
    ) {
      return "map";
    }
    // stat.* entity fences (head before `---`, markdown/nested-fence body):
    // classify by key-set since the info string ("rpg stat.category") is gone.
    // Must precede the feature.details check below — a monster carries
    // `name` + `type`, which would otherwise read as a feature.
    const statMeta = detectStatMeta(headerKeys, headerKeys.has("name"));
    if (statMeta) return statMeta;
    // rule.side fence-mode: `kind:` (float/callout/commentary/spread/note),
    // `type:` (preset name), or `title:` without `name:` (side uses title,
    // not name).
    // `type` alone is ambiguous — feature.details also uses `type: passive`;
    // require absence of `name` AND that the type value isn't a known
    // feature type to avoid stealing feature blocks.
    const FEATURE_TYPE_VALUES = new Set(["passive", "action", "reaction", "bonus", "active"]);
    if (
      headerKeys.has("kind") ||
      (headerKeys.has("type") && !headerKeys.has("name") && !FEATURE_TYPE_VALUES.has(headerValues.get("type") ?? "")) ||
      (headerKeys.has("title") && !headerKeys.has("name"))
    ) {
      return "rule.side";
    }
    if (headerKeys.has("icon") || headerKeys.has("color")) {
      return "rule.tab";
    }
    // `rpg feature.gm` in fence-mode (YAML head + `---` + lonelog body). Must
    // precede feature.details / rule.content: a GM block's head is just
    // `id:`/`name:` plus GM-only aspect keys, which would otherwise fall through
    // to rule.content and render the lonelog body as literal prose. These keys
    // belong to no other block schema.
    const GM_HEADER_MARKERS = [
      "generators",
      "cards",
      "oracle",
      "dial",
      "list",
      "reads",
      "emits",
      "scene",
      "event",
      "stack",
      "steps",
    ];
    if (GM_HEADER_MARKERS.some((k) => headerKeys.has(k))) {
      return "feature.gm";
    }
    // feature.choice in fence-mode
    if (headerKeys.has("parent")) return "feature.choice";
    // feature.details in fence-mode (YAML + --- + markdown body).
    // Distinguishes from rule.content by having `name:` plus structural
    // keys unique to the feature schema (rule.content uses `id:`, not `name:`).
    if (headerKeys.has("name")) {
      const featureHeaderMarkers = [
        "subtitle",
        "traits",
        "level",
        "pick",
        "resource",
        "action",
        "reaction",
        "passive",
        "bonus",
        "active",
        "spellcasting",
        "choose",
        "roll",
        "tag",
        "uses",
        "link",
        "value",
        "values",
        "update",
        "type",
      ];
      if (featureHeaderMarkers.some((k) => headerKeys.has(k))) {
        return "feature.details";
      }
    }
    if (FEATURE_TYPE_VALUES.has(headerValues.get("type") ?? "")) {
      return "feature.details";
    }
    return "rule.content";
  }

  // ── Pure-YAML blocks (no `---` separator) ─────────────────────────────
  // `topLevelKeys` is safe here since there's no markdown body that could
  // contain nested fence YAML.
  // stat.monster with no traits body lands here (pure-YAML head only).
  const statMetaYaml = detectStatMeta(topLevelKeys, topLevelKeys.has("name"));
  if (statMetaYaml) return statMetaYaml;
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

  // `rpg list.<name>` — pure-YAML newspaper-flow lists. MUST be detected
  // BEFORE the rule.related array heuristic below: a list's `entries:` items
  // commonly carry `@[[...]]` call tokens, which would otherwise be misread as
  // rule.related. (This is the bug where a list block rendered as prose +
  // `View "block" not registered` on app load/reload — when getSectionInfo is
  // unavailable during a programmatic rerender, extractMeta falls back to this
  // source-based detection.) The fence's `<name>` suffix isn't in the body, so
  // return bare `"list"`; the dispatcher recovers the id from the YAML `name:`
  // via parseListBlock. List-specific markers: top-level `columns:`/`paginate:`
  // or an entry object's `call:`/`format:`/`text:` key (indented under
  // `entries:`) — none of which appear in rule.related or show bodies.
  if (topLevelKeys.has("entries")) {
    const hasListMarker =
      topLevelKeys.has("columns") || topLevelKeys.has("paginate") || /^[ \t]+(?:call|format|text)[ \t]*:/m.test(source);
    if (hasListMarker) return "list";
  }

  // `rpg rule.related` — YAML array of embeds/call tokens, or object
  // with `entries:` + optional `level:`/`view:`. Distinguished from `rpg show`
  // (which also uses `entries:`) by the presence of `view:` co-key or array
  // items containing `![[` embeds / `@[[` call tokens.
  if (topLevelKeys.has("entries") && topLevelKeys.has("view")) return "rule.related";
  const sourceLines2 = source.split("\n");
  const hasArrayItems = sourceLines2.some((l) => /^\s*-\s/.test(l));
  if (hasArrayItems) {
    const hasEmbedOrCall = sourceLines2.some((l) => /!\[\[|@\[\[/.test(l));
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
