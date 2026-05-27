/**
 * Per-system view registry for `@[[file]].fn(args)` rule imports.
 *
 * Modes:
 *   - `join`: render called once with all matching content bodies joined
 *   - `each`: render called per content block
 *   - `args`: render called per content block, args forwarded
 *
 * Render must be sync — return ReactNode, not Promise<ReactNode>.
 *
 * Selecting a specific block by id: pass it as the FIRST positional arg.
 *   `@[[rules/combat]].h3(grapple)` → only the block with `id: grapple`
 *
 * Heading text resolution: when a block is selected by id, the heading
 * uses `block.frontmatter.name` (falling back to the filename); when
 * multiple blocks are joined, the filename is used.
 */

// @ts-ignore — resolved at runtime by the plugin's esbuild-wasm bundler
import { Markdown, RuleSide, resolveVaultImage, StatblockVehicle, resolveStatFeatures, ItemMagicCard, extractItemMagicBlocks } from "rpg-ui-toolkit";
// @ts-ignore — resolved at runtime
import type { RuleViewCtx, RuleViewEntry, RuleViewMap, SidePreset, ResolvedStatFeature } from "rpg-ui-toolkit";
import * as React from "react";

/** Heading text: use explicit `name` from frontmatter, or undefined if absent. */
function headingText(ctx: RuleViewCtx): string | undefined {
  const fm = ctx.frontmatter as Record<string, unknown>;
  if (typeof fm.name === "string" && fm.name) return fm.name;
  return undefined;
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function renderWikilinks(text: string): React.ReactNode {
  const re = /\[\[([^\]\n]+)\]\]/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) {
      parts.push(React.createElement(React.Fragment, { key: `t${cursor}` }, text.slice(cursor, m.index)));
    }
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    parts.push(React.createElement("a", {
      key: `l${m.index}`,
      className: "internal-link",
      href: target,
      "data-href": target,
    }, label));
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    parts.push(React.createElement(React.Fragment, { key: `t${cursor}` }, text.slice(cursor)));
  }
  return React.createElement(React.Fragment, null, ...parts);
}

/** Build an h{N}-prefixed view entry. Shared by `h1` … `h6` below. */
function headingView(level: 1 | 2 | 3 | 4 | 5 | 6): RuleViewEntry {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return {
    mode: "join",
    render: (ctx) => {
      const title = headingText(ctx);
      return React.createElement(
        "section",
        { className: `rpg-view rpg-view--h${level}` },
        title ? React.createElement(Tag, null, title) : null,
        React.createElement(Markdown, { source: ctx.content, sourcePath: ctx.file })
      );
    },
  };
}

type BannerHeight = "short" | "normal" | "tall" | "hero";
type BannerPosition = "top" | "center" | "bottom";

function parseBannerArgs(args?: unknown[]): { height: BannerHeight; position: BannerPosition } {
  let height: BannerHeight = "normal";
  let position: BannerPosition = "center";
  for (const arg of args ?? []) {
    if (arg === "short" || arg === "tall" || arg === "normal" || arg === "hero") height = arg;
    else if (arg === "top" || arg === "center" || arg === "bottom") position = arg;
  }
  return { height, position };
}

function normalizeStatValue(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 1 && typeof raw[0][0] === "string") {
    return `[[${raw[0][0]}]]`;
  }
  return String(raw);
}

function normalizeStats(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeStatValue(value);
  }
  return out;
}

function normalizeAbilities(raw: unknown): { str: number; dex: number; con: number; int: number; wis: number; cha: number } {
  const defaults = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const v = obj[key];
    if (typeof v === "number") defaults[key] = v;
    else if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) defaults[key] = n;
    }
  }
  return defaults;
}

function normalizeFeatures(raw: unknown): Array<{ ref: string; [key: string]: unknown }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: unknown) => {
    if (typeof entry === "string") return { ref: entry };
    if (entry && typeof entry === "object" && "ref" in (entry as Record<string, unknown>)) return entry as { ref: string; [key: string]: unknown };
    if (Array.isArray(entry) && entry.length === 1 && Array.isArray(entry[0])) return { ref: `[[${entry[0][0]}]]` };
    return null;
  }).filter((x): x is { ref: string; [key: string]: unknown } => x !== null);
}

function StatblockCall({ parsed, body, view, sourcePath }: {
  parsed: Record<string, unknown>;
  body?: string;
  view?: string;
  sourcePath: string;
}) {
  const [resolved, setResolved] = React.useState<ResolvedStatFeature[]>([]);
  const features = React.useMemo(() => normalizeFeatures(parsed.features), [parsed.features]);
  const name = typeof parsed.name === "string" ? parsed.name : "";

  React.useEffect(() => {
    if (features.length === 0) { setResolved([]); return; }
    let cancelled = false;
    const selfProps = { name: name.toLowerCase(), size: parsed.size, type: parsed.type, dimensions: parsed.dimensions };
    resolveStatFeatures(features, sourcePath, selfProps).then((r: ResolvedStatFeature[]) => {
      if (!cancelled) setResolved(r);
    });
    return () => { cancelled = true; };
  }, [features, name, sourcePath]);

  return React.createElement(StatblockVehicle, {
    name,
    size: typeof parsed.size === "string" ? parsed.size : "",
    type: typeof parsed.type === "string" ? parsed.type : "",
    dimensions: typeof parsed.dimensions === "string" ? parsed.dimensions : undefined,
    stats: normalizeStats(parsed.stats),
    abilities: normalizeAbilities(parsed.abilities),
    features: resolved,
    body,
    view,
    sourcePath,
  });
}

export const ruleViews: RuleViewMap = {
  /**
   * Heading-prefixed views. Pick the level that nests correctly under
   * the surrounding document structure.
   *
   *   `@[[rules/combat]].h3()`        → all blocks, h3 with file name
   *   `@[[rules/combat]].h3(grapple)` → grapple block, h3 with `grapple.name`
   */
  h1: headingView(1),
  h2: headingView(2),
  h3: headingView(3),
  h4: headingView(4),
  h5: headingView(5),
  h6: headingView(6),

  /**
   * Paragraph form: bold name + first line of body in the same paragraph.
   * Rest of body flows below. Block-level container.
   *
   *   `@[[rules/combat]].p(grapple)`
   */
  p: {
    mode: "join",
    render: (ctx) => {
      const name = headingText(ctx);
      let source: string;
      if (name) {
        const firstNl = ctx.content.indexOf("\n");
        source = firstNl >= 0
          ? `***${name}.*** ${ctx.content.slice(0, firstNl)}\n${ctx.content.slice(firstNl)}`
          : `***${name}.*** ${ctx.content}`;
      } else {
        source = ctx.content;
      }
      return React.createElement(
        "div",
        { className: "rpg-view rpg-view--p" },
        React.createElement(Markdown, { source, sourcePath: ctx.file })
      );
    },
  },

  /**
   * Inline form: bold name + body injected into the parent paragraph.
   * Truly inline — flows with surrounding prose. Content after newlines
   * / tables breaks out naturally.
   *
   *   `@[[rules/combat]].inline(grapple)`
   */
  inline: {
    mode: "join",
    render: (ctx) => {
      const name = headingText(ctx);
      let source: string;
      if (name) {
        const firstNl = ctx.content.indexOf("\n");
        source = firstNl >= 0
          ? `**${name}.** ${ctx.content.slice(0, firstNl)}\n${ctx.content.slice(firstNl)}`
          : `**${name}.** ${ctx.content}`;
      } else {
        source = ctx.content;
      }
      return React.createElement(
        "span",
        { className: "rpg-view rpg-view--inline" },
        React.createElement(Markdown, { source, sourcePath: ctx.file })
      );
    },
  },

  /**
   * List item — produces `<li>` elements wrapped in a `<ul>`. When called
   * without an id, ALL blocks render as items in one list. Level parameter
   * controls nesting depth (1 = base/default, 2+ = indented).
   *
   *   `@[[combat]].item()`               — all blocks, level 1
   *   `@[[combat]].item(grapple)`        — single item, level 1
   *   `@[[combat]].item(shove, 2)`       — single item, indented one level
   */
  item: {
    mode: "args",
    wrapper: "ul",
    render: (ctx, args) => {
      const name = headingText(ctx);
      const level = typeof args?.[0] === "number" ? args[0] : 1;
      let source: string;
      if (name) {
        const firstNl = ctx.content.indexOf("\n");
        source = firstNl >= 0
          ? `**${name}.** ${ctx.content.slice(0, firstNl)}\n${ctx.content.slice(firstNl)}`
          : `**${name}.** ${ctx.content}`;
      } else {
        source = ctx.content;
      }
      const style = level > 1 ? { marginInlineStart: `${3.5 + (level - 2) * 1.5}em` } : undefined;
      return React.createElement(
        "li",
        { className: "rpg-view rpg-view--item", style },
        React.createElement(Markdown, { source, sourcePath: ctx.file })
      );
    },
  },

  /**
   * Bare body — no chrome, just the markdown. For inline citation.
   *
   *   `@[[rules/combat]].bare(grapple)`
   */
  bare: {
    mode: "join",
    raw: true,
    render: (ctx) => React.createElement(Markdown, { source: ctx.content, sourcePath: ctx.file }),
  },

  /**
   * Float side block — banner-style margin aside glued to the page edge.
   * Extra args: direction (left|right), type (preset name).
   *
   *   `@[[rules/combat]].float(grapple)`           — defaults: right, rules
   *   `@[[rules/combat]].float(grapple, left)`      — direction=left
   *   `@[[rules/combat]].float(grapple, left, tip)` — direction=left, type=tip
   */
  float: {
    mode: "args",
    render: (ctx, args) => {
      const direction = args?.[0] === "left" ? "left" : "right";
      const preset = (typeof args?.[1] === "string" ? args[1] : "rules") as SidePreset;
      return React.createElement(RuleSide, {
        variant: "float",
        type: preset,
        direction,
        title: headingText(ctx),
        content: ctx.content,
        sourcePath: ctx.file,
      });
    },
  },

  /**
   * Callout side block — in-flow ornate certificate. Extra arg: type.
   *
   *   `@[[rules/combat]].callout(grapple)`          — default type: rules
   *   `@[[rules/combat]].callout(grapple, warning)` — type=warning
   */
  callout: {
    mode: "args",
    render: (ctx, args) => {
      const preset = (typeof args?.[0] === "string" ? args[0] : "rules") as SidePreset;
      return React.createElement(RuleSide, {
        variant: "callout",
        type: preset,
        title: headingText(ctx),
        content: ctx.content,
        sourcePath: ctx.file,
      });
    },
  },

  /**
   * Commentary side block — gutter-only italic aside.
   * Extra args: direction (left|right), type (preset name).
   *
   *   `@[[rules/combat]].commentary(grapple)`              — defaults: right, no preset
   *   `@[[rules/combat]].commentary(grapple, left)`         — direction=left
   *   `@[[rules/combat]].commentary(grapple, right, quote)` — type=quote
   */
  commentary: {
    mode: "args",
    render: (ctx, args) => {
      const direction = args?.[0] === "left" ? "left" : "right";
      const preset = (typeof args?.[1] === "string" ? args[1] : undefined) as SidePreset | undefined;
      return React.createElement(RuleSide, {
        variant: "commentary",
        type: preset,
        direction,
        content: ctx.content,
        sourcePath: ctx.file,
      });
    },
  },

  /**
   * Table — renders a complete `<table>` with headers (from field names)
   * and one `<tr>` per matching block. Args are frontmatter field names.
   *
   *   `@[[combat]].row(name, contest)`  — full table, all blocks
   *   `@[[combat]].row(grapple, name, contest)` — single-row table
   */
  row: {
    mode: "args",
    wrapper: "table",
    render: (ctx, args) => {
      const fields = (args ?? []).map((arg) => String(arg));
      const cells = fields.map((f) => {
        if (f === "name") return headingText(ctx) ?? "";
        if (f === "link") {
          const label = headingText(ctx) ?? ctx.name;
          return React.createElement("a", {
            className: "internal-link",
            href: ctx.file,
            "data-href": ctx.file,
          }, label);
        }
        const v = resolvePath(ctx.frontmatter as Record<string, unknown>, f);
        const text = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
        if (/\[\[/.test(text)) {
          return renderWikilinks(text);
        }
        return text;
      });
      return React.createElement(
        "tr",
        { className: "rpg-view rpg-view--row" },
        cells.map((cell, i) => React.createElement("td", { key: i }, cell))
      );
    },
  },

  /**
   * Tab view — renders each file as a tab in a TabGroupView.
   * Folder calls produce all tabs at once; single-file calls merge
   * with adjacent `.tab()` calls.
   *
   * Frontmatter fields: `tab-name`, `tab-icon`, `tab-color`, `tab-order`.
   *
   *   `@[[class-features/]].tab()`  → folder: all files as tabs
   *   `@[[Fighter]].tab()`          → single tab, merges with neighbors
   */
  tab: {
    mode: "join",
    wrapper: "tab-group",
    render: (ctx) => {
      return React.createElement(Markdown, { source: ctx.content, sourcePath: ctx.file });
    },
  },

  /**
   * Full-bleed banner image that breaks out of the content column.
   * Pulls image from the target file's frontmatter (`image:` or `banner:`).
   *
   * Args: height preset (short|normal|tall), position (top|center|bottom).
   *
   *   `@[[dragon-lair]].banner()`            → normal height, center
   *   `@[[dragon-lair]].banner(tall)`        → tall, center
   *   `@[[dragon-lair]].banner(short, top)`  → short, top-aligned
   */
  banner: {
    mode: "args",
    render: (ctx, args) => {
      const { height, position } = parseBannerArgs(args);
      const fm = ctx.frontmatter as Record<string, unknown>;
      const rawImage = fm.image ?? fm.banner ?? null;
      // If target file itself is an image (no frontmatter image field), use it directly
      const src = rawImage
        ? resolveVaultImage(rawImage, ctx.file)
        : resolveVaultImage(ctx.file, ctx.file);
      if (!src) {
        return React.createElement(
          "div",
          { className: "rpg-view rpg-view--banner rpg-view--banner--error" },
          `[banner: could not resolve image for [[${ctx.name}]]]`
        );
      }
      return React.createElement(
        "figure",
        { className: `rpg-view rpg-view--banner rpg-view--banner--${height}` },
        React.createElement("img", {
          src,
          alt: ctx.name,
          style: { objectPosition: position },
        })
      );
    },
  },

  /**
   * Statblock import: renders a `stat.vehicle` (or other stat.*) block
   * from the target file inline.
   *
   *   `@[[Galley]].stat()`            → default view from the file
   *   `@[[Galley]].stat(desc-before)` → description before statblock
   *   `@[[Galley]].stat(desc-after)`  → description after statblock
   */
  stat: {
    mode: "join",
    render: (ctx, args) => {
      const fenceRe = /```+\s*rpg\s+stat\.(\w+)\s*\n([\s\S]*?)```+/;
      const m = fenceRe.exec(ctx.content);
      if (!m) return null;
      const raw = m[2];
      const sepIdx = raw.indexOf("\n---\n");
      const sepEnd = raw.indexOf("\n---");
      const effectiveSep = sepIdx >= 0 ? sepIdx : (sepEnd >= 0 && sepEnd + 4 >= raw.length ? sepEnd : -1);
      let yamlText: string;
      let bodyText: string | undefined;
      if (effectiveSep >= 0) {
        yamlText = raw.slice(0, effectiveSep);
        bodyText = raw.slice(effectiveSep + 4).replace(/^\n+/, "").replace(/\n+$/, "") || undefined;
      } else {
        yamlText = raw;
      }
      let parsed: Record<string, unknown> = {};
      try {
        const { parse } = require("yaml");
        const result = parse(yamlText);
        if (result && typeof result === "object" && !Array.isArray(result)) parsed = result;
      } catch { /* ignore */ }

      const viewOverride = typeof args?.[0] === "string" ? args[0] : undefined;
      const view = viewOverride ?? (typeof parsed.view === "string" ? parsed.view : undefined);

      return React.createElement(StatblockCall, {
        parsed,
        body: bodyText,
        view,
        sourcePath: ctx.file,
      });
    },
  },

  /**
   * Magic item import: renders an `item.magic` block from the target file.
   *
   *   `@[[Sentinel Shield]].magic()`
   */
  magic: {
    mode: "join",
    render: (ctx) => {
      const blocks = extractItemMagicBlocks(ctx.content);
      if (blocks.length === 0) return null;
      const data = blocks[0];
      if (!data.name) data.name = ctx.name;
      return React.createElement(ItemMagicCard, {
        data,
        renderMarkdown: (src: string) => React.createElement(Markdown, { source: src, sourcePath: ctx.file }),
      });
    },
  },
};
