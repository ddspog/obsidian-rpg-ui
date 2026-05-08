import * as React from "react";
import type { CurrencyPurse } from "lib/domains/inventory";

interface CurrencyRowProps {
  currency: CurrencyPurse;
  /** When non-empty, a second row renders under the coin chips showing
   *  the summed value per denomination from items flagged `for_sale`. */
  sellTotals?: CurrencyPurse;
}

const DENOMINATIONS: Array<{ key: keyof CurrencyPurse; label: string }> = [
  { key: "pp", label: "PP" },
  { key: "gp", label: "GP" },
  { key: "ep", label: "EP" },
  { key: "sp", label: "SP" },
  { key: "cp", label: "CP" },
];

/**
 * Two-row coin display — row 1 shows the carried purse as chips, row 2
 * (when any item is flagged `for_sale`) shows the summed `+N` totals
 * column-aligned with the matching coin chip.
 *
 * Both rows live inside one CSS Grid with `grid-template-columns: auto
 * repeat(5, 1fr)` so the coin columns share a single track — the `+3`
 * cell under GP can't drift out of column alignment even when numbers
 * get wider than the chip label.
 */
export function CurrencyRow({ currency, sellTotals }: CurrencyRowProps) {
  const hasSell = !!sellTotals && DENOMINATIONS.some(({ key }) => (sellTotals[key] ?? 0) > 0);
  return (
    <section className="rpg-inventory-block__currency" aria-label="Currency">
      <div
        className="rpg-inventory-block__currency-grid"
        data-has-sell={hasSell ? "true" : undefined}
      >
        <span aria-hidden="true" />
        {DENOMINATIONS.map(({ key, label }) => {
          const value = currency[key] ?? 0;
          const empty = value === 0;
          return (
            <span
              key={key}
              className="rpg-inventory-block__currency-coin"
              data-coin={key}
              data-empty={empty ? "true" : undefined}
            >
              <span className="rpg-inventory-block__currency-label">{label}</span>
              <span className="rpg-inventory-block__currency-value">{value}</span>
            </span>
          );
        })}

        {hasSell && (
          <>
            <span className="rpg-inventory-block__sell-label">To Sell</span>
            {DENOMINATIONS.map(({ key }) => {
              const amount = sellTotals![key] ?? 0;
              return (
                <span
                  key={key}
                  className="rpg-inventory-block__sell-cell"
                  data-coin={key}
                  data-empty={amount === 0 ? "true" : undefined}
                >
                  {amount > 0 ? `+${amount}` : ""}
                </span>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
