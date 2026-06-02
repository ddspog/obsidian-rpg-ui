/**
 * React renderers for `rpg rule.content` and `rpg rule.side`.
 *
 * Mounted into a `MarkdownRenderChild` by the plugin's code-block dispatcher.
 *
 * `rule.content` with `kind: commentary` renders as a semi-transparent
 * `<aside>` that visually reads as a comment on the preceding paragraph —
 * no id/about matching, just proximity in the document flow.
 *
 * Other `rule.content` blocks render as `<section>`. If frontmatter carries
 * any of `source` (block override), `tags`, `revision`, `replaces`, the
 * block is marked "special": corner brackets bracket the text, and one or
 * more tiny icon badges appear in the top-right with hover tooltips
 * explaining the kind of metadata attached.
 *
 * `rule.side` renders a floated callout-style aside with title/icon/color.
 * When the block's resolved source differs from the file's context tuple
 * (or both are missing), the `rpg-rule-homebrew` modifier class is added.
 */

import { App, MarkdownRenderChild, setIcon } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import { resolveSource, isHomebrewForFile } from "./source";
import { SIDE_PRESETS } from "./parse-rule-block";
import { SPREAD_ITEM_CLASS, scheduleSpreadMerge } from "./render-spread-group";
import type { RuleContentBlock, RuleSideBlock, SidePreset } from "./types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Marker {
  icon: string;
  label: string;
}

function describeSource(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return String(raw);
  const r = raw as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.system === "string") parts.push(r.system);
  if (typeof r.book === "string") parts.push(r.book);
  if (typeof r.company === "string") parts.push(r.company);
  return parts.length ? parts.join(" · ") : JSON.stringify(raw);
}

function collectMarkers(fm: Record<string, unknown>): Marker[] {
  const out: Marker[] = [];
  if (fm.source) {
    out.push({ icon: "pen-line", label: `Homebrew — ${describeSource(fm.source)}` });
  }
  if (Array.isArray(fm.tags) && fm.tags.length > 0) {
    out.push({ icon: "tag", label: `Tags: ${fm.tags.join(", ")}` });
  }
  if (fm.tier && typeof fm.tier === "string") {
    out.push({ icon: "layers", label: `Tier: ${fm.tier}` });
  }
  if (fm.revision && typeof fm.revision === "object") {
    const rev = fm.revision as Record<string, unknown>;
    const parts: string[] = [];
    if (rev.author) parts.push(String(rev.author));
    if (rev.date) parts.push(String(rev.date));
    const reason = rev.reason ? `: ${rev.reason}` : "";
    out.push({
      icon: "history",
      label: `Revised${parts.length ? " by " + parts.join(" on ") : ""}${reason}`,
    });
  }
  if (fm.replaces) {
    out.push({ icon: "arrow-right-left", label: `Replaces: ${String(fm.replaces)}` });
  }
  return out;
}

function MarkerBadge({ icon, label }: Marker) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.empty?.();
    el.innerHTML = "";
    try {
      setIcon(el, icon);
    } catch {
      el.textContent = icon;
    }
  }, [icon]);
  return (
    <span
      ref={ref}
      className="rpg-rule-content__marker"
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

function RuleContentView({
  block,
  sourcePath,
  homebrew,
}: {
  block: RuleContentBlock;
  sourcePath: string;
  homebrew: boolean;
}) {
  const fm = block.frontmatter;
  const markers = collectMarkers(fm);
  const cls = ["rpg-rule-content"];
  if (homebrew) cls.push("rpg-rule-homebrew");
  if (markers.length > 0) cls.push("rpg-rule-content--special");

  // `view` property: controls own-page rendering format. Default "bare"
  // (just the body markdown). When imported via @[[file]].fn(), the
  // caller's view function takes over — this property is ignored.
  const viewProp = typeof fm.view === "string" ? fm.view : "bare";
  const blockName =
    (typeof fm.name === "string" && fm.name) ||
    (typeof fm.id === "string" && fm.id ? capitalize(fm.id) : undefined);

  const body = <Markdown source={block.body} sourcePath={sourcePath} />;
  const markersEl = markers.length > 0 ? (
    <div className="rpg-rule-content__markers" aria-hidden={false}>
      {markers.map((m, i) => (
        <MarkerBadge key={`${m.icon}-${i}`} icon={m.icon} label={m.label} />
      ))}
    </div>
  ) : null;

  // Heading views: h1–h6
  const headingMatch = viewProp.match(/^h([1-6])$/);
  if (headingMatch && blockName) {
    const Tag = `h${headingMatch[1]}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <section className={cls.join(" ")} data-rpg-rule="content">
        {markersEl}
        <Tag>{blockName}</Tag>
        {body}
      </section>
    );
  }

  if (viewProp === "p" && blockName) {
    const firstNl = block.body.indexOf("\n");
    const inlined = firstNl >= 0
      ? `_**${blockName}.**_ ${block.body.slice(0, firstNl)}\n${block.body.slice(firstNl)}`
      : `_**${blockName}.**_ ${block.body}`;
    return (
      <section className={cls.join(" ")} data-rpg-rule="content">
        {markersEl}
        <Markdown source={inlined} sourcePath={sourcePath} />
      </section>
    );
  }

  if (viewProp === "inline" && blockName) {
    const firstNl = block.body.indexOf("\n");
    const inlined = firstNl >= 0
      ? `**${blockName}.** ${block.body.slice(0, firstNl)}\n${block.body.slice(firstNl)}`
      : `**${blockName}.** ${block.body}`;
    return (
      <span className={[...cls, "rpg-rule-content--inline"].join(" ")} data-rpg-rule="content">
        {markersEl}
        <Markdown source={inlined} sourcePath={sourcePath} />
      </span>
    );
  }

  if (viewProp === "item" && blockName) {
    const firstNl = block.body.indexOf("\n");
    const inlined = firstNl >= 0
      ? `**${blockName}.** ${block.body.slice(0, firstNl)}\n${block.body.slice(firstNl)}`
      : `**${blockName}.** ${block.body}`;
    return (
      <section className={cls.join(" ")} data-rpg-rule="content">
        {markersEl}
        <Markdown source={inlined} sourcePath={sourcePath} />
      </section>
    );
  }

  // Default: "bare" — just the body, no heading or name prefix.
  return (
    <section className={cls.join(" ")} data-rpg-rule="content">
      {markersEl}
      {body}
    </section>
  );
}

/** Render an icon string into a ref. Lucide name → setIcon; else text/emoji. */
function IconSlot({ name }: { name: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.empty?.();
    el.innerHTML = "";
    // Heuristic: if it's a single grapheme (emoji) or contains non-ASCII,
    // render literally. Otherwise treat as a Lucide icon name.
    const looksLikeLucide = /^[a-z][a-z0-9-]*$/i.test(name);
    if (looksLikeLucide) {
      try {
        setIcon(el, name);
      } catch {
        el.textContent = name;
      }
    } else {
      el.textContent = name;
    }
  }, [name]);
  return <span ref={ref} className="rpg-rule-side__icon" aria-hidden="true" />;
}

function RuleSideCommentary({
  block,
  sourcePath,
}: {
  block: RuleSideBlock;
  sourcePath: string;
}) {
  const asideRef = React.useRef<HTMLElement>(null);
  usePaneEscape(asideRef);

  const cls = ["rpg-rule-side", "rpg-rule-side--commentary", `rpg-rule-side--dir-${block.direction}`];
  if (block.preset) cls.push(`rpg-rule-side--${block.preset}`);

  const style: React.CSSProperties = {};
  if (block.color) (style as Record<string, string>)["--rpg-rule-side-color"] = block.color;

  // Plain text for the collapsed tooltip (strip basic markdown formatting).
  const plainText = block.content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

  // Icon name: use the preset's icon, or fallback to "message-square".
  const iconName = block.icon ?? (block.preset ? SIDE_PRESETS[block.preset]?.icon : undefined) ?? "message-square";

  return (
    <aside
      ref={asideRef}
      className={cls.join(" ")}
      data-rpg-rule="side"
      data-rpg-side-kind="commentary"
      style={style}
      aria-label={plainText}
    >
      {/* Full form: shown when width is sufficient */}
      {block.icon || block.title ? (
        <header className="rpg-rule-side__header rpg-rule-side--commentary__full">
          {block.icon ? <IconSlot name={block.icon} /> : null}
          {block.title ? <strong className="rpg-rule-side__title">{block.title}</strong> : null}
        </header>
      ) : null}
      {block.content ? (
        <div className="rpg-rule-side__body rpg-rule-side--commentary__full">
          <Markdown source={block.content} sourcePath={sourcePath} />
        </div>
      ) : null}

      {/* Collapsed form: icon-only, shown when too narrow */}
      <span className="rpg-rule-side--commentary__collapsed">
        <IconSlot name={iconName} />
      </span>
    </aside>
  );
}

/*
 * Shared hook for both callout and commentary side variants.
 *
 * Publishes ONE clean single-length CSS variable on the aside:
 *   --rpg-file-margins-clean : the first token of `--file-margins`
 *                              parsed to px. Obsidian sets `--file-margins`
 *                              as a 2-axis shorthand (e.g. `32px 32px`)
 *                              which is invalid as a single length inside
 *                              CSS `max()`/`calc()` — the whole expression
 *                              collapses to 0. We parse here and publish
 *                              a value any calc can use.
 *
 * Everything else (escape distance, padding) is computed in CSS via
 * container queries (`100cqi`) — that way the values stay LIVE as the
 * pane resizes, instead of going stale when ResizeObserver doesn't fire
 * for asides that have moved in/out of Obsidian's virtualized DOM.
 *
 * The pane-lookup walks through known wrappers; the only purpose of
 * locating the pane is to read its computed `--file-margins` once.
 */
function usePaneEscape(asideRef: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const findPane = (): HTMLElement => {
      const found = aside.closest(
        ".markdown-preview-view, .markdown-reading-view, .markdown-source-view, .cm-editor, .workspace-leaf-content"
      ) as HTMLElement | null;
      return found ?? document.body;
    };

    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const parsePx = (raw: string): number => {
      const first = raw.trim().split(/\s+/)[0];
      const m = first.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      const u = m[2].toLowerCase();
      if (u === "px" || u === "") return n;
      if (u === "rem") return n * rootFontSize;
      if (u === "em") return n * rootFontSize;
      return n;
    };

    const measure = () => {
      const pane = findPane();
      const cs = getComputedStyle(pane);
      const fileMargins = parsePx(cs.getPropertyValue("--file-margins"));
      aside.style.setProperty("--rpg-file-margins-clean", `${fileMargins}px`);
    };

    measure();
    // No ResizeObserver needed — container queries handle live pane-size
    // updates. We only re-measure if the user changes file-margins
    // (theme/snippet swap), which is rare; a metadataCache event would
    // be the right hook for that, but punting for now.
  }, [asideRef]);
}

function RuleSideFloat({
  block,
  sourcePath,
}: {
  block: RuleSideBlock;
  sourcePath: string;
}) {
  const asideRef = React.useRef<HTMLElement>(null);
  usePaneEscape(asideRef);

  const cls = ["rpg-rule-side", "rpg-rule-side--float", `rpg-rule-side--dir-${block.direction}`];
  if (block.preset) cls.push(`rpg-rule-side--${block.preset}`);

  const style: React.CSSProperties = {};
  if (block.color) (style as Record<string, string>)["--rpg-rule-side-color"] = block.color;

  return (
    <aside ref={asideRef} className={cls.join(" ")} data-rpg-rule="side" data-rpg-side-kind="float" style={style}>
      <header className="rpg-rule-side__header">
        {block.icon ? <IconSlot name={block.icon} /> : null}
        {block.title ? <strong className="rpg-rule-side__title">{block.title}</strong> : null}
      </header>
      {block.content ? (
        <div className="rpg-rule-side__body">
          <Markdown source={block.content} sourcePath={sourcePath} />
        </div>
      ) : null}
    </aside>
  );
}

function RuleSideCallout({
  block,
  sourcePath,
}: {
  block: RuleSideBlock;
  sourcePath: string;
}) {
  const cls = ["rpg-rule-side", "rpg-rule-side--callout"];
  if (block.preset) cls.push(`rpg-rule-side--${block.preset}`);

  const style: React.CSSProperties = {};
  if (block.color) (style as Record<string, string>)["--rpg-rule-side-color"] = block.color;

  return (
    <aside className={cls.join(" ")} data-rpg-rule="side" data-rpg-side-kind="callout" style={style}>
      <header className="rpg-rule-side__header">
        {block.icon ? <IconSlot name={block.icon} /> : null}
        {block.title ? <strong className="rpg-rule-side__title">{block.title}</strong> : null}
      </header>
      {block.content ? (
        <div className="rpg-rule-side__body">
          <Markdown source={block.content} sourcePath={sourcePath} />
        </div>
      ) : null}
    </aside>
  );
}

function RuleSideSpread({
  block,
  sourcePath,
}: {
  block: RuleSideBlock;
  sourcePath: string;
}) {
  const cls = ["rpg-rule-side", "rpg-rule-side--spread", SPREAD_ITEM_CLASS];
  if (block.preset) cls.push(`rpg-rule-side--${block.preset}`);

  const style: React.CSSProperties = {};
  if (block.color) (style as Record<string, string>)["--rpg-rule-side-color"] = block.color;

  return (
    <article className={cls.join(" ")} data-rpg-rule="side" data-rpg-side-kind="spread" style={style}>
      {block.title ? (
        <header className="rpg-rule-side--spread__header">
          <strong className="rpg-rule-side--spread__title">{block.title}</strong>
        </header>
      ) : null}
      {block.subtitle ? (
        <div className="rpg-rule-side--spread__subtitle">
          <Markdown source={block.subtitle} sourcePath={sourcePath} />
        </div>
      ) : null}
      {block.content ? (
        <div className="rpg-rule-side__body">
          <Markdown source={block.content} sourcePath={sourcePath} />
        </div>
      ) : null}
    </article>
  );
}

function RuleSideView({
  block,
  sourcePath,
}: {
  block: RuleSideBlock;
  sourcePath: string;
}) {
  if (block.variant === "commentary") {
    return <RuleSideCommentary block={block} sourcePath={sourcePath} />;
  }
  if (block.variant === "callout") {
    return <RuleSideCallout block={block} sourcePath={sourcePath} />;
  }
  if (block.variant === "spread") {
    return <RuleSideSpread block={block} sourcePath={sourcePath} />;
  }
  return <RuleSideFloat block={block} sourcePath={sourcePath} />;
}

/**
 * Public wrapper component — used by per-system view authors to render
 * an arbitrary string as a rule.side block from inside a `RuleViewMap`
 * entry. Construct a synthetic `RuleSideBlock` from props (applying
 * preset defaults for missing title/icon/color) and delegate.
 *
 * Exposed through the `rpg-ui-toolkit` runtime so vault TypeScript can
 * import it as a regular React component:
 *
 *   import { RuleSide } from "rpg-ui-toolkit";
 *   <RuleSide variant="float" type="rules" title="Player Advice" content={ctx.content} />
 */
export interface RuleSideProps {
  /** Structural variant. Default `float`. */
  variant?: "float" | "callout" | "commentary" | "spread";
  /** Heading title (commentary may omit). */
  title?: string;
  /** Subtitle line (only used by spread variant). */
  subtitle?: string;
  /** Markdown body. */
  content: string;
  /** Preset (note/tip/warning/rules/etc.) — applies default color/icon/title
   *  unless overridden by explicit props. */
  type?: SidePreset;
  /** Override accent color. */
  color?: string;
  /** Override icon (Lucide name or single emoji). */
  icon?: string;
  /** Float side — only meaningful for variant=float. Default right. */
  direction?: "left" | "right";
  /** Source path passed to the inner Markdown renderer for wikilink resolution. */
  sourcePath?: string;
}

export function RuleSide(props: RuleSideProps) {
  const variant = props.variant ?? "float";
  const preset = props.type;
  const defaults = preset ? SIDE_PRESETS[preset] : undefined;

  const block: RuleSideBlock = {
    kind: "side",
    variant,
    title: props.title ?? defaults?.title ?? "",
    subtitle: props.subtitle,
    content: props.content,
    preset,
    icon: props.icon ?? defaults?.icon,
    color: props.color ?? defaults?.color,
    direction: props.direction ?? "right",
  };

  return <RuleSideView block={block} sourcePath={props.sourcePath ?? ""} />;
}

export class RuleContentRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly app: App,
    private readonly block: RuleContentBlock | RuleSideBlock,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    const fm = this.app.metadataCache.getCache(this.sourcePath)?.frontmatter as
      | Record<string, unknown>
      | undefined;
    const resolved =
      this.block.kind === "content"
        ? resolveSource(this.block.frontmatter, fm)
        : resolveSource({ source: this.block.source }, fm);
    // Context here is the file's own source tuple: when the block carries
    // the same source as its host file it's canonical. When it differs (or
    // is missing entirely) it's flagged homebrew. When the system declares
    // official sources, that setting decides instead (see isHomebrewForFile).
    const contextSource = fm ? resolveSource({}, fm) : undefined;
    const homebrew = isHomebrewForFile(resolved, contextSource, this.sourcePath);

    this.root = ReactDOM.createRoot(this.containerEl);
    if (this.block.kind === "side") {
      this.root.render(<RuleSideView block={this.block} sourcePath={this.sourcePath} />);
      if (this.block.variant === "spread") {
        this.containerEl.classList.add(SPREAD_ITEM_CLASS);

        // If inside a callout body, make the parent wrapper flex
        const sideBody = this.containerEl.closest(".rpg-rule-side__body") as HTMLElement | null;
        if (sideBody) {
          const mdWrapper = this.containerEl.parentElement;
          if (mdWrapper && mdWrapper !== sideBody) {
            mdWrapper.style.setProperty("display", "flex", "important");
            mdWrapper.style.setProperty("flex-wrap", "wrap");
            mdWrapper.style.setProperty("gap", "1rem 1.5rem");
          }
          this.containerEl.style.setProperty("flex", "1 1 calc(50% - 0.75rem)");
          this.containerEl.style.setProperty("min-width", "340px");
        } else {
          scheduleSpreadMerge(this.containerEl);
        }
      }
    } else {
      this.root.render(
        <RuleContentView block={this.block} sourcePath={this.sourcePath} homebrew={homebrew} />
      );
    }
  }

  onunload(): void {
    if (this.root) {
      try {
        this.root.unmount();
      } catch (e) {
        console.error("rpg rule.*: unmount failed", e);
      }
      this.root = null;
    }
  }
}

