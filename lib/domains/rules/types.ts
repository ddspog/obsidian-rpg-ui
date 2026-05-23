/**
 * Type definitions for the `rpg rule.*` entity.
 *
 * Source files hold the authoritative rule text. A file can mix any of:
 *   rpg rule.content      — main body, renders inline (default)
 *   rpg rule.side         — callout-style margin <aside> with title + icon
 *   rpg rule.related      — see-also list, stripped when the file is imported
 *   rpg rule.notes        — author prose, stripped when the file is imported
 *   rpg rule.tab          — one tab; consecutive tabs merge into a tablist
 *
 * `content` / `tab` bodies are optional YAML frontmatter + `---` + markdown.
 * `notes` body is pure markdown (no YAML).
 * `side` / `related` bodies are pure YAML.
 */

export type RuleSubtype = "content" | "side" | "related" | "notes" | "tab";

/**
 * Where a piece of rule content comes from. Blocks whose tuple differs from
 * the importing compendium's tuple are rendered with a homebrew modifier.
 * Missing tuple ⇒ treated as homebrew (forces explicit tagging of canonical
 * content).
 */
export interface SourceTuple {
  system: string;
  book?: string;
  company?: string;
}

/** Parsed `rpg rule.content` block. */
export interface RuleContentBlock {
  kind: "content";
  /** Optional YAML frontmatter from before the `---` separator. */
  frontmatter: Record<string, unknown>;
  /** Markdown body from after the `---` separator (or the whole body if no separator). */
  body: string;
  /** Resolved source tuple, if any — from frontmatter `source:` field. */
  source?: SourceTuple;
}

/**
 * Preset type names for `rpg rule.side` blocks. Each preset provides a
 * default title, color, and icon; the block can still override any of them.
 * Matches the familiar Obsidian callout vocabulary.
 */
export type SidePreset =
  | "note"
  | "info"
  | "tip"
  | "success"
  | "question"
  | "warning"
  | "danger"
  | "example"
  | "quote"
  | "rules";

/**
 * Structural variant of a `rule.side` block.
 *   - `float` (default): floats into the gutter, glued to the page edge,
 *     with a pentagon flag — a banner-style margin aside.
 *   - `callout`: in-flow block within the readable column, certificate-style
 *     decoration (top + bottom accent bars). Cleaner alternative to
 *     Obsidian's `> [!type]` callouts when nested-quoting is awkward.
 *   - `commentary`: gutter-only floated aside, italic + semi-transparent;
 *     comments on the preceding block.
 *   - `spread`: in-flow block that merges with consecutive spread siblings
 *     into a responsive two-column grid — rulebook reference layout.
 */
export type SideKind = "float" | "callout" | "commentary" | "spread";

/**
 * Parsed `rpg rule.side` block. Body is pure YAML; shape mirrors a callout:
 *
 *   kind: commentary     # optional — structural variant; default `callout`
 *   type: tip            # optional — preset (color/icon/title)
 *   title: Quick tip     # overrides preset or stands alone
 *   icon: lightbulb      # Lucide name or single emoji (optional)
 *   color: "#f1c40f"     # Obsidian color name or hex (optional)
 *   direction: right     # which margin to float to (default: right; ignored for commentary)
 *   source: {...}        # optional source tuple (parsed but not visually flagged on sides)
 *   content: |
 *     Markdown body.
 */
export interface RuleSideBlock {
  kind: "side";
  variant: SideKind;
  title: string;
  subtitle?: string;
  content: string;
  preset?: SidePreset;
  icon?: string;
  color?: string;
  direction: "left" | "right";
  source?: SourceTuple;
}

/** One entry in a `rpg rule.related` list. */
export interface RelatedEntry {
  /** Optional heading text printed before the embedded link or markdown. */
  heading?: string;
  /** Raw Obsidian embed token (always with `!`), e.g. `"![[ammunition]]"`. */
  embed?: string;
  /** Arbitrary markdown — may contain `@[[file]].fn()` call tokens. */
  markdown?: string;
}

/** Parsed `rpg rule.related` block. */
export interface RuleRelatedBlock {
  kind: "related";
  /** Heading level (1–6) used for `heading: ![[link]]` entries. Default 3. */
  level: number;
  /** When `"footer"`, a thematic break (`<hr>`) is rendered before entries. */
  view?: "footer";
  entries: RelatedEntry[];
}

/**
 * Parsed `rpg rule.notes` block — author prose that renders when reading
 * the source file directly but is stripped when the file is imported via
 * `@[[file]].fn()`. Body is pure markdown (no YAML head).
 */
export interface RuleNotesBlock {
  kind: "notes";
  /** Raw markdown body. */
  body: string;
}

/** One tab in a consecutive group of `rpg rule.tab` blocks. */
export interface RuleTabBlock {
  kind: "tab";
  /** Tab label (required). */
  name: string;
  /** Obsidian color name (e.g. "red") or hex string (e.g. "#c0392b"). */
  color?: string;
  /** Lucide icon name (e.g. "swords") or single emoji. */
  icon?: string;
  /** Markdown body from after the `---` separator. */
  body: string;
  /** Optional YAML frontmatter from before the `---` separator. */
  frontmatter: Record<string, unknown>;
  source?: SourceTuple;
}

export type RuleBlock = RuleContentBlock | RuleSideBlock | RuleRelatedBlock | RuleNotesBlock | RuleTabBlock;

