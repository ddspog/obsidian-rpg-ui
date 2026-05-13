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
  CompendiumTab,
  RelatedEntry,
  RuleCompendiumBlock,
  RuleContentBlock,
  RuleRelatedBlock,
  RuleSideBlock,
  RuleSubtype,
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
 * Parse a `rpg rule.side` block. Body is pure YAML. `type` provides preset
 * defaults; explicit `title`/`icon`/`color` override the preset. Title is
 * required (either via preset or explicit) — a block with neither reports
 * an empty title and renders with just the icon.
 */
export function parseRuleSide(source: string): RuleSideBlock {
  let parsed: unknown;
  try {
    parsed = parseYAML(source);
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
    rec.kind === "commentary" ? "commentary" : rec.kind === "callout" ? "callout" : "float";
  const title = typeof rec.title === "string" ? rec.title : defaults?.title ?? "";
  const icon = typeof rec.icon === "string" ? rec.icon : defaults?.icon;
  const color = typeof rec.color === "string" ? rec.color : defaults?.color;
  const content = typeof rec.content === "string" ? rec.content : "";
  const direction: "left" | "right" = rec.direction === "left" ? "left" : "right";

  return {
    kind: "side",
    variant,
    title,
    content,
    preset,
    icon,
    color,
    direction,
    source: coerceSource(rec.source),
  };
}

export function parseRuleRelated(source: string): RuleRelatedBlock {
  const entries: RelatedEntry[] = [];
  let parsed: unknown;
  try {
    parsed = parseYAML(source);
  } catch {
    parsed = null;
  }
  if (Array.isArray(parsed)) {
    for (const raw of parsed) {
      const entry = coerceRelatedEntry(raw);
      if (entry) entries.push(entry);
    }
  }
  return { kind: "related", entries };
}

function coerceRelatedEntry(raw: unknown): RelatedEntry | null {
  if (typeof raw === "string") {
    const match = raw.match(/^([^:\[]+):\s*(\[\[.+\]\])\s*$/);
    if (match) return { heading: match[1].trim(), link: match[2].trim() };
    const linkOnly = raw.match(/\[\[.+\]\]/);
    if (linkOnly) return { link: linkOnly[0] };
    return null;
  }
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    for (const [key, value] of Object.entries(rec)) {
      if (typeof value === "string") {
        const linkOnly = value.match(/\[\[.+\]\]/);
        if (linkOnly) return { heading: key, link: linkOnly[0] };
      }
    }
  }
  return null;
}

export function parseRuleCompendium(source: string): RuleCompendiumBlock {
  let parsed: unknown;
  try {
    parsed = parseYAML(source);
  } catch {
    return { kind: "compendium", tabs: [] };
  }
  const tabs: CompendiumTab[] = [];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { tabs?: unknown }).tabs)) {
    for (const raw of (parsed as { tabs: unknown[] }).tabs) {
      const tab = coerceTab(raw);
      if (tab) tabs.push(tab);
    }
  }
  return { kind: "compendium", tabs };
}

function coerceTab(raw: unknown): CompendiumTab | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name : null;
  if (!name) return null;
  const content = typeof rec.content === "string" ? rec.content : "";
  return {
    name,
    content,
    color: typeof rec.color === "string" ? rec.color : undefined,
    icon: typeof rec.icon === "string" ? rec.icon : undefined,
  };
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
    case "compendium":
      return parseRuleCompendium(source);
  }
}

/** Extract the subtype from a fence info string like `"rule.content"`. */
export function subtypeFromMeta(meta: string): RuleSubtype | null {
  if (!meta.startsWith("rule.")) return null;
  const tail = meta.slice("rule.".length);
  if (tail === "content" || tail === "side" || tail === "related" || tail === "compendium") return tail;
  return null;
}

