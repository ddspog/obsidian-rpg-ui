/**
 * Parsers for `rpg rule.*` fence bodies.
 *
 * `content` bodies are split on the first `---` separator into optional YAML
 * frontmatter plus a markdown body. No separator ⇒ the whole body is
 * markdown and frontmatter is empty.
 *
 * `side` / `related` / `compendium` bodies are pure YAML.
 */

import { parse as parseYAML } from "yaml";
import type {
  RelatedEntry,
  RuleContentBlock,
  RuleNotesBlock,
  RuleRelatedBlock,
  RuleSideBlock,
  RuleSubtype,
  RuleTabBlock,
  SideKind,
  SidePreset,
  SourceTuple,
} from "./types";

/**
 * Preset defaults for `rule.side`. Picks a familiar Obsidian-callout
 * vocabulary so side blocks visually rhyme with `> [!tip]`-style callouts
 * elsewhere in the vault. Each field is overridable on the block.
 */
export const SIDE_PRESETS: Record<
  SidePreset,
  { title: string; icon: string; color: string }
> = {
  note: { title: "Note", icon: "pencil", color: "var(--color-blue, #3498db)" },
  info: { title: "Info", icon: "info", color: "var(--color-cyan, #17a2b8)" },
  tip: { title: "Tip", icon: "lightbulb", color: "var(--color-yellow, #f1c40f)" },
  success: { title: "Success", icon: "check", color: "var(--color-green, #2ecc71)" },
  question: { title: "Question", icon: "help-circle", color: "var(--color-purple, #9b59b6)" },
  warning: { title: "Warning", icon: "alert-triangle", color: "var(--color-orange, #e67e22)" },
  danger: { title: "Danger", icon: "alert-octagon", color: "var(--color-red, #e74c3c)" },
  example: { title: "Example", icon: "list", color: "var(--color-teal, #16a085)" },
  quote: { title: "Quote", icon: "quote", color: "var(--color-gray, #95a5a6)" },
  rules: { title: "Rule", icon: "scroll", color: "#8b6f47" },
};

function isSidePreset(value: unknown): value is SidePreset {
  return typeof value === "string" && value in SIDE_PRESETS;
}

/** Coerce an unknown value into a SourceTuple, or return undefined. */
export function coerceSource(raw: unknown): SourceTuple | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const system = rec.system;
  if (typeof system !== "string" || !system) return undefined;
  const book = typeof rec.book === "string" ? rec.book : undefined;
  const company = typeof rec.company === "string" ? rec.company : undefined;
  return { system, book, company };
}

/**
 * Split a content body on the first standalone `---` line.
 * Returns `[frontmatterText, body]`. If no separator, frontmatter is empty.
 */
function splitOnSeparator(raw: string): [string, string] {
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return [lines.slice(0, i).join("\n"), lines.slice(i + 1).join("\n")];
    }
  }
  return ["", raw];
}

export function parseRuleContent(source: string): RuleContentBlock {
  const [fmText, bodyText] = splitOnSeparator(source);
  let frontmatter: Record<string, unknown> = {};
  if (fmText.trim()) {
    try {
      const parsed = parseYAML(fmText);
      if (parsed && typeof parsed === "object") frontmatter = parsed as Record<string, unknown>;
    } catch {
      frontmatter = {};
    }
  }
  return {
    kind: "content",
    frontmatter,
    body: bodyText.replace(/^\n+/, "").replace(/\n+$/, ""),
    source: coerceSource(frontmatter.source),
  };
}

/**
 * Parse a `rpg rule.side` block. Supports both:
 *   - Pure YAML with `content:` field (backwards compatible)
 *   - Fence mode: YAML head + `---` + markdown body (stored as `content`)
 */
export function parseRuleSide(source: string): RuleSideBlock {
  const [fmText, bodyText] = splitOnSeparator(source);
  const hasFenceBody = fmText !== "" && bodyText !== source;

  let parsed: unknown;
  try {
    parsed = parseYAML(hasFenceBody ? fmText : source);
  } catch {
    parsed = null;
  }
  const rec: Record<string, unknown> =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const preset: SidePreset | undefined = isSidePreset(rec.type) ? rec.type : undefined;
  const defaults = preset ? SIDE_PRESETS[preset] : undefined;

  const variant: SideKind =
    rec.kind === "commentary"
      ? "commentary"
      : rec.kind === "callout"
        ? "callout"
        : rec.kind === "spread"
          ? "spread"
          : "float";
  const title = typeof rec.title === "string" ? rec.title : defaults?.title ?? "";
  const subtitle = typeof rec.subtitle === "string" ? rec.subtitle : undefined;
  const icon = typeof rec.icon === "string" ? rec.icon : defaults?.icon;
  const color = typeof rec.color === "string" ? rec.color : defaults?.color;
  const content = hasFenceBody
    ? bodyText.replace(/^\n+/, "").replace(/\n+$/, "")
    : typeof rec.content === "string" ? rec.content : typeof rec.text === "string" ? rec.text : "";
  const direction: "left" | "right" = rec.direction === "left" ? "left" : "right";

  return {
    kind: "side",
    variant,
    title,
    subtitle,
    content,
    preset,
    icon,
    color,
    direction,
    source: coerceSource(rec.source),
  };
}

/**
 * Parse a `rpg rule.related` block. Body is YAML — accepts either:
 *
 *   1. A flat list of strings, each either:
 *        - `"![[file]]"`               — pure embed
 *        - `"Heading: ![[file]]"`      — embed with a preceding heading
 *      (default heading level: 3)
 *
 *   2. An object form:
 *        ```
 *        level: 4
 *        entries:
 *          - "![[file]]"
 *          - "Heading: ![[file]]"
 *        ```
 *
 * Strict on the embed token: only `![[...]]` (with the leading `!`) is
 * accepted. A bare `[[link]]` is rejected — embeds and links are
 * different intentions.
 */
export function parseRuleRelated(source: string): RuleRelatedBlock {
  let parsed: unknown;
  try {
    parsed = parseYAML(source);
  } catch {
    parsed = null;
  }

  let level = 3;
  let view: "footer" | undefined;
  let rawEntries: unknown[] = [];

  if (Array.isArray(parsed)) {
    rawEntries = parsed;
  } else if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.level === "number" && rec.level >= 1 && rec.level <= 6) {
      level = Math.floor(rec.level);
    }
    if (rec.view === "footer") {
      view = "footer";
    }
    if (Array.isArray(rec.entries)) {
      rawEntries = rec.entries;
    }
  }

  // Fallback: when YAML fails (e.g. unquoted `[[` sequences), parse
  // raw `- value` lines as string entries so authors don't need to
  // quote wikilinks and call tokens.
  if (rawEntries.length === 0) {
    const RAW_ITEM = /^\s*-\s+(.*)/;
    const VIEW_LINE = /^\s*view\s*:\s*(\S+)/;
    for (const line of source.split("\n")) {
      const vm = line.match(VIEW_LINE);
      if (vm && vm[1] === "footer") {
        view = "footer";
        continue;
      }
      const m = line.match(RAW_ITEM);
      if (m && m[1].trim()) rawEntries.push(m[1].trim());
    }
  }

  const entries: RelatedEntry[] = [];
  for (const raw of rawEntries) {
    const entry = coerceRelatedEntry(raw);
    if (entry) entries.push(entry);
  }
  return { kind: "related", level, view, entries };
}

const EMBED_RE = /!\[\[[^\[\]\n]+\]\]/;
const CALL_RE = /@\[\[[^\]\n]+\]\]\.[A-Za-z_][\w-]*\([^)\n]*\)/;

function coerceRelatedEntry(raw: unknown): RelatedEntry | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Heading-prefixed form: "Heading text: ![[file]]" or "Heading: @[[file]].fn()"
    // Only split on colons that appear BEFORE any `[[`, `@[[`, or backtick
    // — colons inside wikilinks or call tokens are part of the path/name.
    const firstBracket = trimmed.search(/\[\[|`/);
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0 && (firstBracket < 0 || colonIdx < firstBracket)) {
      const head = trimmed.slice(0, colonIdx).trim();
      const tail = trimmed.slice(colonIdx + 1).trim();
      if (head && EMBED_RE.test(tail)) {
        const m = tail.match(EMBED_RE);
        if (m) return { heading: head, embed: m[0] };
      }
      if (head && tail) return { heading: head, markdown: tail };
    }
    // Pure embed form: "![[file]]"
    const m = trimmed.match(EMBED_RE);
    if (m && m[0] === trimmed) return { embed: m[0] };
    // Fallback: any non-empty string is treated as markdown (may contain
    // call tokens, wikilinks, or plain prose).
    return { markdown: trimmed };
  }
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    for (const [head, value] of Object.entries(rec)) {
      if (typeof value === "string") {
        const em = value.trim().match(EMBED_RE);
        if (em) return { heading: head, embed: em[0] };
        if (value.trim()) return { heading: head, markdown: value.trim() };
      }
    }
  }
  return null;
}

/**
 * Parse a `rpg rule.tab` block. Same shape as `rule.content` (YAML head +
 * `---` + markdown body) but requires a `name:` field.
 */
export function parseRuleTab(source: string): RuleTabBlock {
  const [fmText, bodyText] = splitOnSeparator(source);
  let frontmatter: Record<string, unknown> = {};
  if (fmText.trim()) {
    try {
      const parsed = parseYAML(fmText);
      if (parsed && typeof parsed === "object") frontmatter = parsed as Record<string, unknown>;
    } catch {
      frontmatter = {};
    }
  }
  const name = typeof frontmatter.name === "string" ? frontmatter.name : "";
  return {
    kind: "tab",
    name,
    icon: typeof frontmatter.icon === "string" ? frontmatter.icon : undefined,
    color: typeof frontmatter.color === "string" ? frontmatter.color : undefined,
    body: bodyText.replace(/^\n+/, "").replace(/\n+$/, ""),
    frontmatter,
    source: coerceSource(frontmatter.source),
  };
}

/**
 * Parse a `rpg rule.notes` block. Body is pure markdown — no YAML head,
 * no separator handling. Whitespace is trimmed on both ends so the
 * renderer doesn't emit leading/trailing blank paragraphs.
 */
export function parseRuleNotes(source: string): RuleNotesBlock {
  return { kind: "notes", body: source.replace(/^\n+/, "").replace(/\n+$/, "") };
}

/** Subtype-dispatch entrypoint: pick the parser matching the fence's suffix. */
export function parseRuleBlock(subtype: RuleSubtype, source: string) {
  switch (subtype) {
    case "content":
      return parseRuleContent(source);
    case "side":
      return parseRuleSide(source);
    case "related":
      return parseRuleRelated(source);
    case "notes":
      return parseRuleNotes(source);
    case "tab":
      return parseRuleTab(source);
  }
}

/** Extract the subtype from a fence info string like `"rule.content"`. */
export function subtypeFromMeta(meta: string): RuleSubtype | null {
  if (!meta.startsWith("rule.")) return null;
  const tail = meta.slice("rule.".length);
  if (
    tail === "content" ||
    tail === "side" ||
    tail === "related" ||
    tail === "notes" ||
    tail === "tab"
  )
    return tail;
  return null;
}

