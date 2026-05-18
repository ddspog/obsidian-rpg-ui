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
import { Markdown, RuleSide } from "rpg-ui-toolkit";
// @ts-ignore — resolved at runtime
import type { RuleViewCtx, RuleViewEntry, RuleViewMap, SidePreset } from "rpg-ui-toolkit";
import * as React from "react";

/** Heading text: use explicit `name` from frontmatter, or undefined if absent. */
function headingText(ctx: RuleViewCtx): string | undefined {
  const fm = ctx.frontmatter as Record<string, unknown>;
  if (typeof fm.name === "string" && fm.name) return fm.name;
  return undefined;
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
          ? `**${name}.** ${ctx.content.slice(0, firstNl)}\n${ctx.content.slice(firstNl)}`
          : `**${name}.** ${ctx.content}`;
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
        const v = (ctx.frontmatter as Record<string, unknown>)[f];
        return v == null ? "" : String(v);
      });
      return React.createElement(
        "tr",
        { className: "rpg-view rpg-view--row" },
        cells.map((cell, i) => React.createElement("td", { key: i }, cell))
      );
    },
  },
};
