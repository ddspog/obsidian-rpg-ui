import * as React from "react";
import type { ItemElementData } from "lib/domains/items/schema";

interface ItemElementCardProps {
  data: ItemElementData;
  /** Renders the item's `image:` markdown + `desc:` prose. When the host
   *  markdown already shows those in the note body, set to false. */
  showDescription?: boolean;
  /** React node for rendering markdown fragments (descriptions, images,
   *  wikilinks). Injected by the entity-block adapter so the card can
   *  stay framework-agnostic. `null` falls back to a plain text render. */
  renderMarkdown?: (source: string) => React.ReactNode;
}

/** Strip wikilink wrapper and pipe alias down to the display label. */
function cleanLabel(raw: string): string {
  const inner = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const pipe = inner.indexOf("|");
  const target = pipe >= 0 ? inner.slice(pipe + 1) : inner;
  return target.split("/").pop()!.trim();
}

function renderWikilink(raw: string, key: number | string): React.ReactNode {
  const match = raw.match(/^\[\[(.+?)\]\]$/);
  if (!match) return <React.Fragment key={key}>{raw}</React.Fragment>;
  const target = match[1].split("|")[0];
  const label = cleanLabel(raw);
  return (
    <a key={key} className="internal-link" href={target} data-href={target}>
      {label}
    </a>
  );
}

/** Split a string into mixed wikilink + plain-text nodes so entries like
 *  `"([[Range]] 150/600)"` surface the `[[Range]]` as a real internal-link
 *  while the surrounding `(… 150/600)` reads as plain text. */
function renderMixed(value: string, keyBase: string | number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\[\[[^\]]+\]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > cursor) {
      parts.push(<React.Fragment key={`${keyBase}-t-${cursor}`}>{value.slice(cursor, match.index)}</React.Fragment>);
    }
    parts.push(renderWikilink(match[0], `${keyBase}-l-${match.index}`));
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    parts.push(<React.Fragment key={`${keyBase}-t-${cursor}-tail`}>{value.slice(cursor)}</React.Fragment>);
  }
  return <>{parts}</>;
}

function InlineLinkList({ values }: { values: string[] }) {
  return (
    <>
      {values.map((v, i) => (
        <React.Fragment key={i}>
          {i > 0 && ", "}
          {renderMixed(v, i)}
        </React.Fragment>
      ))}
    </>
  );
}

export function ItemElementCard({ data, showDescription = true, renderMarkdown }: ItemElementCardProps) {
  const hasWeapon = data.weapon != null;
  const hasArmor = data.armor != null;
  // Container metadata (volume_cap / weight_cap) is authored on
  // containers but rendered elsewhere — it's plumbing for the
  // inventory resolver, not card content.

  return (
    <article className="rpg-item-card">
      {/* Stripline: type, cost, weight, rarity — each lit as an inline dt/dd
          pair so the stripline reads "Type: X · Cost: Y · Weight: Z". The
          host note's own heading serves as the title; `source`, `shop`, and
          auto-title rendering are intentionally omitted here — authors
          surface those in note-body markdown when desired. */}
      <dl className="rpg-item-card__stripline">
        {data.type && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Type</dt>
            <dd>{parseTypeTokens(data.type)}</dd>
          </div>
        )}
        {data.cost && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Cost</dt>
            <dd>{data.cost}</dd>
          </div>
        )}
        {data.weight != null && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Weight</dt>
            <dd>{typeof data.weight === "number" ? `${data.weight} lb.` : data.weight}</dd>
          </div>
        )}
        {data.rarity && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Rarity</dt>
            <dd>{data.rarity}</dd>
          </div>
        )}
      </dl>

      {showDescription && data.desc && (
        <div className="rpg-item-card__desc">{renderMarkdown ? renderMarkdown(data.desc) : <p>{data.desc}</p>}</div>
      )}

      {hasWeapon && (
        <div className="el-table rpg-table-wrapper">
          <table className="rpg-table rpg-item-card__kind-table">
            <thead>
              <tr>
                <th>Damage</th>
                <th>Properties</th>
                {(data.weapon!.options?.length ?? 0) > 0 && <th>Weapon Options</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="rpg-item-card__damage">
                  {[data.weapon!.damage, data.weapon!.bonus].filter(Boolean).join(" ")}
                </td>
                <td>
                  {data.weapon!.properties && data.weapon!.properties.length > 0 ? (
                    <InlineLinkList values={data.weapon!.properties} />
                  ) : (
                    "—"
                  )}
                </td>
                {(data.weapon!.options?.length ?? 0) > 0 && (
                  <td>
                    <InlineLinkList values={data.weapon!.options!} />
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {hasArmor && (
        <div className="el-table rpg-table-wrapper">
          <table className="rpg-table rpg-item-card__kind-table">
            <thead>
              <tr>
                <th>Armor Class</th>
                <th>Properties</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="rpg-item-card__ac">{data.armor!.ac ?? "—"}</td>
                <td>
                  {data.armor!.properties && data.armor!.properties.length > 0 ? (
                    <InlineLinkList values={data.armor!.properties} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showDescription && data.image && (
        <figure className="rpg-item-card__figure">
          {renderMarkdown ? renderMarkdown(data.image) : <span>{data.image}</span>}
        </figure>
      )}
    </article>
  );
}

/** Parse the compound `type:` string — a mix of bracketed wikilinks and
 *  plain words — into clickable link spans. `"[[Martial]] [[Melee]]
 *  Weapons"` → `Martial Melee Weapons` with the first two as links. */
function parseTypeTokens(raw: string): React.ReactNode {
  return renderMixed(raw, "type");
}
