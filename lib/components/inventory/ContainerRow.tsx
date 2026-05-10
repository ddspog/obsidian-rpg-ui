import * as React from "react";
import type { ResolvedItem } from "lib/domains/inventory";
import { ItemRow, formatWeight } from "./ItemRow";

interface ContainerRowProps {
  item: ResolvedItem;
  /** When provided, the container summary + each nested row render the
   *  `$` toggle. The container itself is flaggable (sell the whole bag)
   *  separately from its contents. */
  onToggleForSale?: (item: ResolvedItem) => void;
}

export function ContainerRow({ item, onToggleForSale }: ContainerRowProps) {
  const [open, setOpen] = React.useState(true);

  // Weight readout — split across the row's stat column (col 4) and
  // weight column (col 5) so each value sits inside its own grid slot
  // and the right-edge stays flush with ordinary item rows.
  //   - Weight-fixed containers (Bag of Holding):
  //       stat   → `(<carried> lb. / <cap> lb.)`
  //       weight → `<true wt> lb.`
  //     Trailing number is the weight that adds to the carrier's
  //     encumbrance (15 lb for a Bag of Holding regardless of contents);
  //     the parens expose the actual interior load so the player can
  //     see when they're approaching the magic cap.
  //   - Regular containers:
  //       stat   → empty
  //       weight → `<total wt> lb. [/ <cap> lb.]`
  const hasCapacity = item.meta.containerCapacity != null;
  const weightFixed = item.meta.weightFixed === true;
  const statReadout = weightFixed && hasCapacity
    ? `(${formatWeight(item.contentsWeightRaw)} lb. / ${formatWeight(item.meta.containerCapacity!)} lb.)`
    : "";
  const weightReadout = weightFixed
    ? (item.totalWeight > 0 ? `${formatWeight(item.totalWeight)} lb.` : "")
    : item.totalWeight > 0
      ? hasCapacity
        ? `${formatWeight(item.totalWeight)} lb. / ${formatWeight(item.meta.containerCapacity!)} lb.`
        : `${formatWeight(item.totalWeight)} lb.`
      : "";

  const canSell = !!onToggleForSale;

  return (
    <details
      className="rpg-inventory-block__container"
      data-for-sale={item.forSale ? "true" : undefined}
      open={open}
      onToggle={(e) => {
        // `toggle` bubbles in React's synthetic-event system, so a
        // nested <details> firing toggle would also run this handler
        // with the child as `e.target` and wreck the parent's `open`
        // state (collapsing the whole Kowyn's Bag when you just
        // collapse a Backpack inside it). Gate on currentTarget so
        // each container's state stays tied to its own summary.
        if (e.target !== e.currentTarget) return;
        setOpen((e.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary className="rpg-inventory-block__container-summary">
        <span className="rpg-inventory-block__item-sell">
          {canSell && (
            <button
              type="button"
              className="rpg-inventory-block__sell-btn"
              data-for-sale={item.forSale ? "true" : "false"}
              onClick={(e) => {
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
        <span className="rpg-inventory-block__container-caret" aria-hidden="true" />
        <span className="rpg-inventory-block__container-name">
          {item.link ? (
            <a
              className="internal-link"
              href={item.linkTarget ?? item.label}
              data-href={item.linkTarget ?? item.label}
              onClick={(e) => e.stopPropagation()}
            >
              {item.label}
            </a>
          ) : (
            item.label
          )}
        </span>
        {/* Column 4 (stat) — carries the `(carried / cap)` readout for
         *  weight-fixed containers; empty for ordinary ones. The slot
         *  is reserved either way so the 6-col grid lands at the same
         *  right edge as item rows. */}
        <span className="rpg-inventory-block__item-stat">
          {statReadout}
        </span>
        <span className="rpg-inventory-block__container-weight">
          {weightReadout}
        </span>
        {/* Column 6 placeholder (equip action on item rows) — reserved
         *  so the container's right edge aligns with item rows. */}
        <span className="rpg-inventory-block__item-action" aria-hidden="true" />
      </summary>
      <div className="rpg-inventory-block__container-contents">
        {item.contents.length === 0 ? (
          <div className="rpg-inventory-block__container-empty">(empty)</div>
        ) : (
          item.contents.map((child) => (
            <ItemRow
              key={child.id}
              item={child}
              nested
              onToggleForSale={onToggleForSale}
            />
          ))
        )}
      </div>
    </details>
  );
}
