import * as React from "react";
import { Component, MarkdownRenderer } from "obsidian";
import { EntityBlock, Level, Pill, Progress, Title, Button, Header, Line, Lucide } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { PillDetails } from "../../entities/character.common";
import { HeaderProps } from "./header.types";

/** Strip wikilink delimiters from a `[[Foo]]` value when present so the
 *  pill label reads as `Foo` rather than `[[Foo]]`. YAML parses unquoted
 *  `[[Foo]]` as a nested flow array (`[["Foo"]]`), so unwrap that shape
 *  before pulling the bare link. Plain strings pass through. */
function bareLink(value: unknown): string {
  let raw: unknown = value;
  while (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== "string") return "";
  return raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
}

/** Inline-render a snippet of markdown into a span via Obsidian's renderer
 *  so wikilinks (`[[Foo]]`) inside header pill comments resolve to live
 *  internal-links. Strips the `<p>` wrapper Obsidian wraps prose in so the
 *  output stays inline next to its sibling pill. */
function CommentMarkdown({ source }: { source: string }) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.empty?.();
    el.innerHTML = "";
    if (!source) return;
    const app = (globalThis as unknown as { app?: unknown }).app as
      | { workspace?: { getActiveFile?: () => { path?: string } | null } }
      | undefined;
    const sourcePath = app?.workspace?.getActiveFile?.()?.path ?? "";
    const comp = new Component();
    comp.load();
    const renderer = MarkdownRenderer as unknown as {
      render?: (a: unknown, md: string, e: HTMLElement, sp: string, c: Component) => Promise<void>;
      renderMarkdown?: (md: string, e: HTMLElement, sp: string, c: Component) => Promise<void>;
    };
    const promise =
      typeof renderer.render === "function"
        ? renderer.render(app, source, el, sourcePath, comp)
        : renderer.renderMarkdown?.(source, el, sourcePath, comp);
    Promise.resolve(promise)
      .then(() => {
        // Unwrap the auto-inserted <p> so the rendered nodes flow inline.
        const p = el.querySelector("p");
        if (p && p.parentElement === el) {
          while (p.firstChild) el.appendChild(p.firstChild);
          p.remove();
        }
      })
      .catch(() => {
        el.textContent = source;
      });
    return () => {
      try { comp.unload(); } catch {}
    };
  }, [source]);
  return <span ref={ref} />;
}

/** Render a labelled Pill.Link with an optional author note rendered as a
 *  small italic span beside it. The pair is wrapped in a single inline-flex
 *  container so flex-wrap keeps pill + comment together when the row runs
 *  out of width. The comment goes through Obsidian's MarkdownRenderer so
 *  embedded wikilinks (`of [[Borelhearth]]`, …) become live internal-links
 *  rather than raw `[[…]]` text. */
function PillRef({ details }: { details: PillDetails }) {
  // Both the link target and the visible label may arrive as nested arrays
  // when the author wrote `file: [[Foo]]` unquoted (YAML's flow-array
  // parsing). Normalize once so Pill.Link always sees a string.
  const link = bareLink(details.file);
  const label = details.text || link;
  return (
    <span aria-details="Pill Reference" className="rpg-pill-ref">
      <Pill.Link link={link}>{label}</Pill.Link>
      {details.comment && (
        <small aria-details="Pill Comment" className="rpg-pill-comment">
          <CommentMarkdown source={details.comment} />
        </small>
      )}
    </span>
  );
}

export const header: EntityBlock<HeaderProps, CharacterEntity> = ({ self, lookup, expressions, trigger }) => (
  <Header.Banner label="Character" background={self.banner} distribution="2 1">
    <hgroup aria-details="Name & Summary">
      <Title />
      <Line.Pills>
        {self.classes && self.classes.map((cls, i) => {
          // Authors may write either `subclass:` (verbose, original) or
          // `sub:` (terse, easier to swap while testing). `sub` wins when
          // both are present.
          const className = bareLink(cls.name);
          const subclass = bareLink(cls.sub ?? cls.subclass);
          return (
            <React.Fragment key={`class-${i}`}>
              <Pill.Link link={className}>
                {className} {cls.level}
              </Pill.Link>
              {subclass && (
                <Pill.Link link={subclass}>
                  {subclass}
                </Pill.Link>
              )}
            </React.Fragment>
          );
        })}

        {/* lineage / heritage / background are single objects in this system */}
        {self.lineage && <PillRef details={self.lineage} />}
        {self.heritage && <PillRef details={self.heritage} />}
        {self.background && <PillRef details={self.background} />}
      </Line.Pills>
    </hgroup>
    <fieldset aria-details="Leveling">
      <Line.BigElements>
        <Line.Buttons>
          <Button.Trigger onClick={() => trigger('short-rest')} aria-label="Short Rest"><Lucide.UtensilsCrossed size={28} strokeWidth={1}/></Button.Trigger>
          <Button.Trigger onClick={() => trigger('long-rest')} aria-label="Long Rest"><Lucide.FlameKindling size={28} strokeWidth={1}/></Button.Trigger>
        </Line.Buttons>
        <Level.Inspirational
          level={expressions.CharacterLevel()}
          inspiration={self.luck}
          maxPoints={5}
          onUpdateInspiration={(value: number) => self.setLuck(value)} />
      </Line.BigElements>
      <Progress.Bar value={self.xp} max={lookup.table.xp[expressions.CharacterLevel()] ?? lookup.table.xp[expressions.CharacterLevel() - 1]} />
    </fieldset>
  </Header.Banner>
);

export default header;
