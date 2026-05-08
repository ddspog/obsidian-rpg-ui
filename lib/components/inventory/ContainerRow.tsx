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

  const totalLabel =
    item.totalWeight > 0 ? `${formatWeight(item.totalWeight)} lb.` : "";
  const capacityLabel =
    item.meta.containerCapacity != null
      ? ` / ${formatWeight(item.meta.containerCapacity)} lb.`
      : "";

  const canSell = !!onToggleForSale;

  return (
    <details
      className="rpg-inventory-block__container"
      data-for-sale={item.forSale ? "true" : undefined}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
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
        <span className="rpg-inventory-block__container-weight">
          {totalLabel}
          {capacityLabel}
        </span>
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
