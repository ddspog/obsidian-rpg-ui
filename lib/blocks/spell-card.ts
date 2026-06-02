/**
 * `rpg spell` block — renders the fence-body YAML as a compact
 * compendium card via the shared {@link SpellCard} React component.
 *
 * The card markup itself lives in `lib/components/SpellCard.tsx` so the
 * standalone block and the `@[[…]].spell()` import view stay in sync.
 * This module owns the fence-body parsing + mount, and the index-time
 * `extractSpellBlocks` harvester used by the character spell index.
 */

import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  parseYaml,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { splitFenceBody } from "lib/utils/fence-split";
import { SpellCard, type SpellBody } from "lib/components/SpellCard";

export { SpellCard } from "lib/components/SpellCard";
export type { SpellBody } from "lib/components/SpellCard";

/** Parse a `rpg spell` fence body into a {@link SpellBody}. The body
 *  after a `---` separator becomes `text` when not set explicitly. */
function parseSpellBody(source: string): SpellBody | null {
  if (!source || !source.trim()) return {};
  try {
    const { yaml, text } = splitFenceBody(source);
    const parsed = parseYaml(yaml);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const body = parsed as SpellBody;
      if (text !== undefined && !("text" in body)) {
        (body as Record<string, unknown>).text = text;
      }
      return body;
    }
    return {};
  } catch {
    return null;
  }
}

/**
 * Public entry point — registered on the plugin side. Parses the fence
 * body as YAML and mounts {@link SpellCard}. The host note's H1 serves
 * as the heading, so no title is passed here.
 */
export function renderSpellBlock(
  _app: App,
  el: HTMLElement,
  source: string,
  _ctx: MarkdownPostProcessorContext
): MarkdownRenderChild {
  el.empty();

  const body = parseSpellBody(source);
  if (body === null) {
    el.createEl("div", {
      cls: "notice",
      text: "rpg spell: unable to parse fence body as YAML",
    });
    return new (class extends MarkdownRenderChild {
      onunload(): void {}
    })(el);
  }

  const root = ReactDOM.createRoot(el);
  root.render(React.createElement(SpellCard, { body, sourcePath: _ctx.sourcePath }));

  return new (class extends MarkdownRenderChild {
    onunload(): void {
      try {
        root.unmount();
      } catch {
        /* ignore */
      }
    }
  })(el);
}

/**
 * Extract every `rpg spell` fence body from a doc and return them as
 * parsed YAML objects. Used by the character entity loader to build
 * the spell index (tags keyed by `source` / `circle`) without having
 * to render anything.
 */
export function extractSpellBlocks(contents: string): SpellBody[] {
  const out: SpellBody[] = [];
  if (!contents) return out;
  const re = /```+\s*rpg\s+spell\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const raw = m[1];
    const { yaml, text } = splitFenceBody(raw);
    try {
      const parsed = parseYaml(yaml);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const body = parsed as SpellBody;
        if (text && !("text" in body)) {
          (body as Record<string, unknown>).text = text;
        }
        out.push(body);
      }
    } catch {
      // Skip malformed fence; keep scanning.
    }
  }
  return out;
}
