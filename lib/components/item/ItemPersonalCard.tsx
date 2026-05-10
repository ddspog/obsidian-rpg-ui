import * as React from "react";
import type { PersonalResolution } from "lib/domains/items/magic-overlay";
import type { ItemPersonalData } from "lib/domains/items/schema";

interface ItemPersonalCardProps {
  data: ItemPersonalData;
  resolution: PersonalResolution | null;
  renderMarkdown?: (source: string) => React.ReactNode;
}

/**
 * `rpg item.personal` card — the player's view of a specific magic
 * item they own. Reuses the same stripline + kind-specific table +
 * image layout as `ItemElementCard`, but slips every applied magic
 * template's text between the stripline and the base item's own
 * description so the player reads the enchantments first, then the
 * base's rules, then sees the stat table and the art.
 *
 * The host note's H1 heading already titles the entry, and lore
 * sections (notes / history / campaign reveals) live as plain markdown
 * outside the fence — this card is strictly mechanical + descriptive.
 */
export function ItemPersonalCard({
  data,
  resolution,
  renderMarkdown,
}: ItemPersonalCardProps) {
  const element = resolution?.effectiveElement;
  const magicTexts = resolution?.magicTexts ?? [];
  const hasWeapon = element?.weapon != null;
  const hasArmor = element?.armor != null;

  return (
    <article className="rpg-item-personal-card">
      {element && (
        <dl className="rpg-item-card__stripline">
          {element.type && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Type</dt>
              <dd>{parseTypeTokens(element.type)}</dd>
            </div>
          )}
          {element.cost && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Cost</dt>
              <dd>{element.cost}</dd>
            </div>
          )}
          {element.weight != null && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Weight</dt>
              <dd>
                {typeof element.weight === "number" ? `${element.weight} lb.` : element.weight}
              </dd>
            </div>
          )}
          {element.rarity && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Rarity</dt>
              <dd>{element.rarity}</dd>
            </div>
          )}
        </dl>
      )}

      {magicTexts.map((text, i) => (
        <div key={i} className="rpg-item-personal-card__magic-text">
          {renderMarkdown ? renderMarkdown(text) : <p>{text}</p>}
        </div>
      ))}

      {element?.desc && (
        <div className="rpg-item-card__desc">
          {renderMarkdown ? renderMarkdown(element.desc) : <p>{element.desc}</p>}
        </div>
      )}

      {hasWeapon && (
        <div className="el-table rpg-table-wrapper">
          <table className="rpg-table rpg-item-card__kind-table">
            <thead>
              <tr>
                <th>Damage</th>
                <th>Properties</th>
                {(element!.weapon!.options?.length ?? 0) > 0 && <th>Weapon Options</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="rpg-item-card__damage">
                  {[element!.weapon!.damage, element!.weapon!.bonus].filter(Boolean).join(" ")}
                </td>
                <td>
                  {element!.weapon!.properties && element!.weapon!.properties.length > 0 ? (
                    <InlineLinkList values={element!.weapon!.properties} />
                  ) : (
                    "—"
                  )}
                </td>
                {(element!.weapon!.options?.length ?? 0) > 0 && (
                  <td>
                    <InlineLinkList values={element!.weapon!.options!} />
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
                <td className="rpg-item-card__ac">{element!.armor!.ac ?? "—"}</td>
                <td>
                  {element!.armor!.properties && element!.armor!.properties.length > 0 ? (
                    <InlineLinkList values={element!.armor!.properties} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {element?.image && (
        <figure className="rpg-item-card__figure">
          {renderMarkdown ? renderMarkdown(element.image) : <span>{element.image}</span>}
        </figure>
      )}
    </article>
  );
}

/** Split a `"[[Martial]] [[Melee]] Weapons"`-style string into a mix
 *  of plain-text and internal-link spans so `[[Shields]]` reads as a
 *  real link in the stripline. Mirrors the parser in `ItemElementCard`
 *  so both cards render the type line identically. */
function parseTypeTokens(raw: string): React.ReactNode {
  return renderMixed(raw, "type");
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

function renderMixed(value: string, keyBase: string | number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\[\[[^\]]+\]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > cursor) {
      parts.push(
        <React.Fragment key={`${keyBase}-t-${cursor}`}>
          {value.slice(cursor, match.index)}
        </React.Fragment>,
      );
    }
    parts.push(renderWikilink(match[0], `${keyBase}-l-${match.index}`));
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    parts.push(
      <React.Fragment key={`${keyBase}-t-${cursor}-tail`}>
        {value.slice(cursor)}
      </React.Fragment>,
    );
  }
  return <>{parts}</>;
}

function renderWikilink(raw: string, key: number | string): React.ReactNode {
  const match = raw.match(/^\[\[(.+?)\]\]$/);
  if (!match) return <React.Fragment key={key}>{raw}</React.Fragment>;
  const target = match[1].split("|")[0];
  const inner = match[1];
  const pipe = inner.indexOf("|");
  const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
  return (
    <a
      key={key}
      className="internal-link"
      href={target}
      data-href={target}
    >
      {label}
    </a>
  );
}
