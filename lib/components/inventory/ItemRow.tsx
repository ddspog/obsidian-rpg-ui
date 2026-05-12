import * as React from "react";
import type { ResolvedItem } from "lib/domains/inventory";
import type { SectionId } from "lib/domains/inventory";
import { ContainerRow } from "./ContainerRow";

interface ItemRowProps {
  item: ResolvedItem;
  /** Section this row lives under — drives the section-aware "stat" cell
   *  (damage in Weapons, AC in Armor, subtitle elsewhere). */
  sectionId?: SectionId;
  nested?: boolean;
  /** Equip toggle handler. When provided, equippable rows render an
   *  "Equip" / "Unequip" button on the right. */
  onToggleEquip?: (item: ResolvedItem) => void;
  /** For-sale toggle handler. Every non-container row can be flagged
   *  when this is supplied — the button lights up and the item's cost
   *  feeds the "To Sell" totals below the currency chips. */
  onToggleForSale?: (item: ResolvedItem) => void;
}

/** Compose the section-aware "stat" cell. Weapons show damage, armor
 *  shows AC formula, ammo-tracking containers show `<carried>/<cap>
 *  <ammo-link>`, everything else falls back to the meta subtitle so
 *  category info (Tool / Focus / …) still surfaces. Returned as a
 *  React node so the ammo form can include a clickable internal-link
 *  anchor without the caller doing extra work. */
function statCell(item: ResolvedItem, sectionId: SectionId | undefined): React.ReactNode {
  if (item.isAmmoTracking) {
    const cap = item.meta.ammoCap;
    const ammoRaw = pickAmmoLabel(item);
    const target = ammoRaw ? wikiTarget(ammoRaw) : null;
    const label = ammoRaw ? wikiLabel(ammoRaw) : "";
    const capPart = cap ? ` / ${cap}` : "";
    return (
      <>
        {`${item.ammoCarried}${capPart} `}
        {target ? (
          <a className="internal-link" href={target} data-href={target}>
            {label}
          </a>
        ) : (
          label
        )}
      </>
    );
  }
  if (sectionId === "weapons" && item.meta.damage) return item.meta.damage;
  if (sectionId === "armor" && item.meta.acFormula) return item.meta.acFormula;
  return item.meta.subtitle ?? "";
}

/** Choose which declared `for_ammo` entry to display in the stat
 *  cell. When one ammo type is authored we just use it; when several
 *  are authored we fall back to the first content entry's label so
 *  "19 / 20 Crossbow Bolts" reads truthfully even when the container
 *  could also have held Arrows. */
function pickAmmoLabel(item: ResolvedItem): string | undefined {
  const declared = item.meta.forAmmo ?? [];
  if (declared.length === 1) return declared[0];
  if (item.contents.length > 0) return item.contents[0].link ?? item.contents[0].label;
  return declared[0];
}

/** Extract the display label from a raw wikilink / bare name. */
function wikiLabel(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  const pipe = inner.indexOf("|");
  return (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
}

/** Extract the link target (before `|`) from a raw wikilink — falls
 *  back to the label when it's just a bare name. */
function wikiTarget(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  if (!m) return raw;
  return m[1].split("|")[0].trim();
}

export function ItemRow({ item, sectionId, nested = false, onToggleEquip, onToggleForSale }: ItemRowProps) {
  if (item.isContainer) {
    return <ContainerRow item={item} onToggleForSale={onToggleForSale} />;
  }

  const stat = statCell(item, sectionId);
  const weight = item.totalWeight > 0 ? `${formatWeight(item.totalWeight)} lb.` : "";
  // Shields sit in the armor section and feed the AC badge automatically
  // from mere inventory presence — the player never swaps them out via a
  // toggle, so we skip the button for shield rows.
  const canEquip = !!onToggleEquip && (item.equipKind === "weapon" || item.equipKind === "armor");
  const canSell = !!onToggleForSale;

  return (
    <div
      className="rpg-inventory-block__item"
      data-nested={nested ? "true" : undefined}
      data-equipped={item.equipped ? "true" : undefined}
      data-for-sale={item.forSale ? "true" : undefined}
    >
      <span className="rpg-inventory-block__item-sell">
        {canSell && (
          <button
            type="button"
            className="rpg-inventory-block__sell-btn"
            data-for-sale={item.forSale ? "true" : "false"}
            onClick={(e) => {
              // Nested rows live inside a `<details>` — stop the click
              // from climbing up to any ancestor handler that would
              // otherwise swallow it (and, in Chromium, re-trigger the
              // summary toggle when click targeting is ambiguous).
              e.preventDefault();
              e.stopPropagation();
              onToggleForSale!(item);
            }}
            title={item.forSale ? "Don't sell" : "Mark for sale"}
            aria-label={item.forSale ? `Cancel sale of ${item.label}` : `Mark ${item.label} for sale`}
          >
            <span aria-hidden="true">$</span>
          </button>
        )}
      </span>
      <span className="rpg-inventory-block__item-qty">{item.qty}x</span>
      <span className="rpg-inventory-block__item-name">
        {item.link ? (
          <a className="internal-link" href={item.linkTarget ?? item.label} data-href={item.linkTarget ?? item.label}>
            {item.label}
          </a>
        ) : (
          item.label
        )}
        {item.notes && (
          <small className="rpg-inventory-block__item-notes">
            {" · "}
            {renderInlineWikilinks(item.notes, `${item.id}-notes`)}
          </small>
        )}
      </span>
      <span className="rpg-inventory-block__item-stat">{stat}</span>
      <span className="rpg-inventory-block__item-weight">{weight}</span>
      <span className="rpg-inventory-block__item-action">
        {canEquip && (
          <button
            type="button"
            className="rpg-inventory-block__equip-btn"
            data-equipped={item.equipped ? "true" : "false"}
            onClick={() => onToggleEquip!(item)}
            title={item.equipped ? "Unequip" : "Equip"}
            aria-label={item.equipped ? `Unequip ${item.label}` : `Equip ${item.label}`}
          >
            <span aria-hidden="true">{item.equipped ? "●" : "○"}</span>
          </button>
        )}
      </span>
    </div>
  );
}

export function formatWeight(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Split free-text notes into plain-text segments interleaved with
 * Obsidian-style `[[Wikilink]]` anchors. Keeps authored punctuation
 * intact — `"An amulet for [[Lusanda, the Muse]] (Under clothes)"`
 * surfaces the wikilink as a clickable internal link while the
 * surrounding prose reads as-is.
 */
function renderInlineWikilinks(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) {
      parts.push(<React.Fragment key={`${keyPrefix}-t-${cursor}`}>{text.slice(cursor, m.index)}</React.Fragment>);
    }
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    parts.push(
      <a key={`${keyPrefix}-l-${m.index}`} className="internal-link" href={target} data-href={target}>
        {label}
      </a>
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    parts.push(<React.Fragment key={`${keyPrefix}-t-${cursor}-tail`}>{text.slice(cursor)}</React.Fragment>);
  }
  return <>{parts}</>;
}
