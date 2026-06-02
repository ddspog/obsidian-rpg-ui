/**
 * `<SpellCard>` — the React rendering of a `rpg spell` fence body.
 *
 * Single source of truth for the spell card, shared by:
 *   - the standalone `rpg spell` code block (`renderSpellBlock` mounts this)
 *   - the `@[[…]].spell()` import view (system config)
 *
 * Body payload is the source of truth (same convention as
 * `rpg feature.details`):
 *
 *   ```rpg spell
 *   circle: Cantrip
 *   source: [[[Arcane]], [[Wyrd]]]
 *   school: Conjuration
 *   casting: 1 action
 *   range: 30 ft.
 *   components: [V, S]
 *   duration: 1 minute
 *   summary: Magical hand for simple tasks.
 *   image: "![[mage-hand.webp|384]]"
 *   ---
 *   A spectral, floating hand …
 *   ```
 *
 * Standalone blocks omit the title (the host note's H1 is the heading);
 * imports pass `title` so each card identifies its spell.
 */

import * as React from "react";
import { Markdown } from "./markdown";

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

/** Flatten a `source` (magic source) value into a list of bare stems
 *  suitable for emitting as Obsidian internal-links. Handles the
 *  nested-array shape YAML produces for unquoted `[[Foo]]`. */
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

export interface SpellBody {
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
   *  emphasis, paragraphs via blank lines). */
  text?: string;
  /** Markdown image ref (`![[bane.webp|384]]`). */
  image?: string;
  /** Optional override for the auto-derived title. */
  name?: string;
}

export interface SpellCardProps {
  body: SpellBody;
  /** Path used to resolve relative wikilinks in the description / image. */
  sourcePath: string;
  /**
   * When provided, renders the spell name as a card header. Standalone
   * `rpg spell` blocks omit it (the host note's H1 already serves as the
   * heading); `.spell()` imports pass the spell name so a stack of cards
   * stays identifiable.
   */
  title?: string;
}

/** Stripline: circle, magic-source internal-links, then `(School)`. */
function Stripline({ body }: { body: SpellBody }): React.ReactElement | null {
  const refs = normaliseMagicSource(body.source);
  if (!body.circle && refs.length === 0 && !body.school) return null;

  const parts: React.ReactNode[] = [];
  const pushSep = () => {
    if (parts.length > 0) parts.push(<React.Fragment key={`sep${parts.length}`}>, </React.Fragment>);
  };
  if (body.circle) {
    parts.push(<React.Fragment key="circle">{body.circle}</React.Fragment>);
  }
  refs.forEach((ref, i) => {
    pushSep();
    parts.push(
      <a key={`src${i}`} className="internal-link" href={ref} data-href={ref}>
        {ref}
      </a>
    );
  });

  return (
    <p className="rpg-spell-stripline">
      {parts}
      {body.school ? ` (${body.school})` : null}
    </p>
  );
}

export function SpellCard({ body, sourcePath, title }: SpellCardProps): React.ReactElement {
  const stats: Array<[string, string]> = [];
  const addStat = (label: string, value: unknown) => {
    const str = typeof value === "string" ? value.trim() : joinLabels(value);
    if (str) stats.push([label, str]);
  };
  addStat("Casting Time", body.casting);
  addStat("Range", body.range);
  addStat("Components", body.components);
  addStat("Duration", body.duration);
  if (body.style) {
    const styleLabel = joinLabels(body.style);
    if (styleLabel) addStat("Suitable for", `${styleLabel} style`);
  }

  const text = typeof body.text === "string" ? body.text : "";
  const image = typeof body.image === "string" ? body.image : "";

  return (
    <article className="rpg-spell-card">
      {title ? (
        <header className="rpg-spell-card__header">
          <h3>{title}</h3>
        </header>
      ) : null}

      <div className="rpg-spell-body">
        <Stripline body={body} />

        {stats.length > 0 ? (
          <dl className="rpg-spell-stats">
            {stats.map(([dt, dd], i) => (
              <React.Fragment key={i}>
                <dt>{dt}</dt>
                <dd>{dd}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}

        {body.summary ? <p className="rpg-spell-summary">{body.summary}</p> : null}

        {text.trim() ? (
          <div className="rpg-spell-desc">
            <Markdown source={text} sourcePath={sourcePath} />
          </div>
        ) : null}

        {image.trim() ? (
          <figure className="rpg-spell-figure">
            <Markdown source={image} sourcePath={sourcePath} />
          </figure>
        ) : null}
      </div>
    </article>
  );
}

export default SpellCard;
