import * as React from "react";
import type { ItemMagicData } from "lib/domains/items/schema";

interface ItemMagicCardProps {
  data: ItemMagicData;
  /** Renders the compendium text + image. When the host note shows
   *  the image / prose elsewhere, set this false to suppress the
   *  redundant copy. */
  showDescription?: boolean;
  /** Markdown renderer injected by the entity-block adapter — stays
   *  framework-agnostic so the card works in Storybook with a plain
   *  `<p>` fallback. */
  renderMarkdown?: (source: string) => React.ReactNode;
}

/**
 * `rpg item.magic` compendium card. Shows the template's rarity /
 * attunement / cost stripline, the prose body, the mechanical effect
 * summary (traits chips), the applies-to whitelist (for weapons /
 * armor variants), and — when authored — a variants table laying out
 * each tier's rarity / cost / bonus so readers can scan Potion of
 * Healing Common → Very Rare at a glance.
 *
 * Hidden `feature.details` fences living next to the magic fence in
 * the same file are NOT rendered here; the character feature
 * resolver picks them up only when a `rpg item.personal` referencing
 * this template is equipped.
 */
export function ItemMagicCard({
  data,
  showDescription = true,
  renderMarkdown,
}: ItemMagicCardProps) {
  const appliesTo = formatAppliesTo(data.applies_to);
  const hasVariants = data.variants && Object.keys(data.variants).length > 0;

  return (
    <article className="rpg-item-magic-card">
      <dl className="rpg-item-card__stripline">
        {appliesTo && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Type</dt>
            <dd>{appliesTo}</dd>
          </div>
        )}
        {data.rarity && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Rarity</dt>
            <dd>{data.rarity}</dd>
          </div>
        )}
        {data.attunement && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Attunement</dt>
            <dd>Required</dd>
          </div>
        )}
        {data.cost && (
          <div className="rpg-item-card__stripline-pair">
            <dt>Cost</dt>
            <dd>{data.cost}</dd>
          </div>
        )}
      </dl>

      {showDescription && data.text && (
        <div className="rpg-item-magic-card__text">
          {renderMarkdown ? renderMarkdown(data.text) : <p>{data.text}</p>}
        </div>
      )}

      {data.bonus && !hasVariants && (
        <dl className="rpg-item-magic-card__effects">
          <dt>Bonus</dt>
          <dd>{data.bonus}</dd>
          {typeof data.damage_bonus === "number" && data.damage_bonus !== 0 && (
            <>
              <dt>Extra Damage</dt>
              <dd>{signed(data.damage_bonus)}</dd>
            </>
          )}
        </dl>
      )}

      {/* Traits are mechanical hooks consumed by the character's
       * feature-view aggregator — not display content. The magic
       * card intentionally hides them so the compendium page stays
       * prose-first. */}

      {hasVariants && (
        <div className="el-table rpg-table-wrapper">
          <table className="rpg-table rpg-item-magic-card__variants">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Rarity</th>
                <th>Bonus</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.variants!).map(([key, variant]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{variant.rarity ?? "—"}</td>
                  <td>{variant.bonus ?? (typeof variant.damage_bonus === "number" ? signed(variant.damage_bonus) : "—")}</td>
                  <td>{variant.cost ?? "—"}</td>
                </tr>
              ))}
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

/** Render a signed integer with an explicit plus sign on non-negatives. */
function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return "+0";
}

/** Render the applies-to whitelist as a short sentence — kind tokens
 *  capitalized, families comma-joined when present. */
function formatAppliesTo(raw: ItemMagicData["applies_to"]): string | null {
  if (!raw) return null;
  const parts: string[] = [];
  if (raw.kinds && raw.kinds.length > 0) {
    parts.push(
      raw.kinds
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join(" / "),
    );
  }
  if (raw.families && raw.families.length > 0) {
    parts.push(`(${raw.families.map(cleanWikilink).join(", ")})`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

function cleanWikilink(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  const pipe = inner.indexOf("|");
  return (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
}
