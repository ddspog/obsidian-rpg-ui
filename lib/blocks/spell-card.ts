/**
 * `rpg spell` block — renders the fence-body YAML as a compact
 * compendium card. Mirrors the feature-card visual shape so spell
 * pages read like class features when surfaced inline.
 *
 * Body payload is the source of truth (same convention as
 * `rpg feature.details`). Example:
 *
 *   ```rpg spell
 *   circle: 1st-Circle
 *   magic_source: [[[Divine]], [[Wyrd]]]
 *   school: Enchantment
 *   casting: 1 action
 *   range: 30 feet
 *   components: [V, S, M (a drop of blood)]
 *   duration: Concentration, up to 1 minute
 *   summary: Foes subtract d4 from rolls.
 *   reference_desc:
 *     - Paragraph 1 …
 *     - Paragraph 2 …
 *   reference_img: "![[bane.webp|384]]"
 *   source: From **Tales of the Valiant** …
 *   ```
 *
 * The host note's filename becomes the title. Everything else comes
 * from the YAML; frontmatter is ignored for display.
 */

import {
  App,
  Component,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  parseYaml,
} from "obsidian";
import { splitFenceBody } from "lib/utils/fence-split";

/** Strip wikilink delimiters / md extension / pipe alias from a ref. */
function bareStem(raw: unknown): string {
  let v: unknown = raw;
  while (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return "";
  return v.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
}

/** Format an array or scalar into a comma-joined label for the stats
 *  row. Each element goes through `bareStem` so `[[Divine]]` renders as
 *  `Divine`. Used by stats fields (components, style) where link
 *  behaviour isn't wanted. */
function joinLabels(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const v of value) {
      const s = bareStem(v);
      if (s) parts.push(s);
      else if (typeof v === "string" && v.trim()) parts.push(v.trim());
    }
    return parts.join(", ");
  }
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

/** Flatten a `magic_source` value into a list of bare stems suitable
 *  for emitting as Obsidian internal-links. Handles the nested-array
 *  shape YAML produces for unquoted `[[Foo]]`. */
function normaliseMagicSource(value: unknown): string[] {
  if (value == null) return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    const stem = bareStem(v);
    if (stem && !out.includes(stem)) out.push(stem);
  };
  if (Array.isArray(value)) {
    for (const v of value) push(v);
  } else {
    push(value);
  }
  return out;
}

interface SpellBody {
  /** Spell circle ("Cantrip" / "1st-Circle" / …). */
  circle?: string;
  /**
   * Magic sources for the spell — the wikilinks (`[[Divine]]`, `[[Wyrd]]`)
   * the caster's pool tags filter by. Array or single value; each entry
   * renders as an internal-link in the stripline.
   */
  source?: unknown;
  school?: string;
  casting?: string;
  range?: string;
  components?: unknown;
  duration?: string;
  style?: unknown;
  /** Italic one-liner shown above the description. */
  summary?: string;
  /** Full spell description, markdown string (inline wikilinks,
   *  emphasis, paragraphs via blank lines — same shape as `text:` on
   *  feature.details). */
  text?: string;
  /** Markdown image ref (`![[bane.webp|384]]`). Rendered centered
   *  below the description, transparent background, no border. */
  image?: string;
  /** Optional override for the auto-derived title. */
  name?: string;
}

/**
 * Public entry point — registered on the plugin side. Parses the
 * fence body as YAML, pulls the title from the host note's filename,
 * and builds the card DOM. Returns a MarkdownRenderChild so Obsidian
 * cleans up attached MarkdownRenderer components on unload.
 */
export function renderSpellBlock(
  app: App,
  el: HTMLElement,
  source: string,
  ctx: MarkdownPostProcessorContext
): MarkdownRenderChild {
  el.empty();
  const cleanupComponents: Component[] = [];

  let body: SpellBody = {};
  if (source && source.trim()) {
    try {
      const { yaml, text } = splitFenceBody(source);
      const parsed = parseYaml(yaml);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as SpellBody;
        if (text !== undefined && !("text" in body)) {
          (body as Record<string, unknown>).text = text;
        }
      }
    } catch {
      // Malformed YAML — render an empty card with a notice.
      el.createEl("div", {
        cls: "notice",
        text: "rpg spell: unable to parse fence body as YAML",
      });
      return new (class extends MarkdownRenderChild {
        onunload(): void {}
      })(el);
    }
  }

  // Card wrapper — holds the stat layout. Title is intentionally omitted
  // because the host note's H1 already serves as the heading.
  const card = el.createEl("article", { cls: "rpg-spell-card" });
  const bodyWrap = card.createEl("div", { cls: "rpg-spell-body" });

  // ── Stripline (circle, magic sources as links, school) ──────────────
  //
  // `source` values like `[[Divine]]` / `[[Wyrd]]` render as real
  // internal-links so the stripline doubles as navigation back to the
  // magic-source notes. Everything else (circle, school) is plain text.
  if (body.circle || body.source || body.school) {
    const stripline = bodyWrap.createEl("p", { cls: "rpg-spell-stripline" });
    let separatorNeeded = false;
    const pushSeparator = () => {
      if (separatorNeeded) stripline.appendText(", ");
      separatorNeeded = true;
    };
    if (body.circle) {
      pushSeparator();
      stripline.appendText(body.circle);
    }
    const sourceRefs = normaliseMagicSource(body.source);
    sourceRefs.forEach((ref) => {
      pushSeparator();
      const a = stripline.createEl("a", { cls: "internal-link", text: ref });
      a.setAttribute("href", ref);
      a.setAttribute("data-href", ref);
    });
    if (body.school) {
      // School sticks to the last source with a space (not a comma) so
      // the stripline reads "… Divine, Wyrd (Enchantment)" rather than
      // "… Divine, Wyrd, (Enchantment)".
      stripline.appendText(` (${body.school})`);
    }
  }

  // ── Stats row (casting / range / components / duration / style) ─────
  const dl = bodyWrap.createEl("dl", { cls: "rpg-spell-stats" });
  const addStat = (label: string, value: unknown) => {
    const str = typeof value === "string" ? value.trim() : joinLabels(value);
    if (!str) return;
    dl.createEl("dt", { text: label });
    dl.createEl("dd", { text: str });
  };
  addStat("Casting Time", body.casting);
  addStat("Range", body.range);
  addStat("Components", body.components);
  addStat("Duration", body.duration);
  if (body.style) {
    const styleLabel = joinLabels(body.style);
    if (styleLabel) addStat("Suitable for", `${styleLabel} style`);
  }

  // ── Summary pill (italic one-liner) ─────────────────────────────────
  if (body.summary) {
    bodyWrap.createEl("p", { cls: "rpg-spell-summary", text: body.summary });
  }

  // ── Description prose — raw markdown string, rendered through
  //    Obsidian's MarkdownRenderer so wikilinks / emphasis / blank-line
  //    paragraphs all flow like a feature.details `text:` block.
  if (typeof body.text === "string" && body.text.trim()) {
    const desc = bodyWrap.createEl("div", { cls: "rpg-spell-desc" });
    const comp = new Component();
    comp.load();
    cleanupComponents.push(comp);
    const renderer = MarkdownRenderer as unknown as {
      render?: (app: unknown, md: string, e: HTMLElement, sp: string, c: Component) => Promise<void>;
      renderMarkdown?: (md: string, e: HTMLElement, sp: string, c: Component) => Promise<void>;
    };
    const promise =
      typeof renderer.render === "function"
        ? renderer.render(app, body.text, desc, ctx.sourcePath, comp)
        : renderer.renderMarkdown?.(body.text, desc, ctx.sourcePath, comp);
    Promise.resolve(promise).catch(() => {
      desc.setText(body.text!);
    });
  }

  // ── Portrait (transparent, no chrome) ───────────────────────────────
  if (typeof body.image === "string" && body.image.trim()) {
    const fig = bodyWrap.createEl("figure", { cls: "rpg-spell-figure" });
    const comp = new Component();
    comp.load();
    cleanupComponents.push(comp);
    const renderer = MarkdownRenderer as unknown as {
      render?: (app: unknown, md: string, e: HTMLElement, sp: string, c: Component) => Promise<void>;
      renderMarkdown?: (md: string, e: HTMLElement, sp: string, c: Component) => Promise<void>;
    };
    const promise =
      typeof renderer.render === "function"
        ? renderer.render(app, body.image, fig, ctx.sourcePath, comp)
        : renderer.renderMarkdown?.(body.image, fig, ctx.sourcePath, comp);
    Promise.resolve(promise).catch(() => {
      fig.setText(body.image!);
    });
  }

  // Book attribution lives OUTSIDE the fence as trailing markdown on
  // the host note (matches how feature compendium docs place their
  // **Source**: line after the `rpg feature.*` fences). The card no
  // longer renders it — Obsidian renders the note's markdown normally.

  return new (class extends MarkdownRenderChild {
    onunload(): void {
      for (const c of cleanupComponents) {
        try {
          c.unload();
        } catch {}
      }
    }
  })(el);
}

/**
 * Extract every `rpg spell` fence body from a doc and return them as
 * parsed YAML objects. Used by the character entity loader to build
 * the spell index (tags keyed by `magic_source` / `circle`) without
 * having to render anything.
 */
export function extractSpellBlocks(contents: string): SpellBody[] {
  const out: SpellBody[] = [];
  if (!contents) return out;
  // Match fenced `rpg spell` blocks. Tolerates 3+ backticks and optional
  // trailing whitespace after the info tag, same tolerance as the
  // plugin's other fence scanners.
  const re = /```+\s*rpg\s+spell\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const yaml = m[1];
    try {
      const parsed = parseYaml(yaml);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        out.push(parsed as SpellBody);
      }
    } catch {
      // Skip malformed fence; keep scanning.
    }
  }
  return out;
}
