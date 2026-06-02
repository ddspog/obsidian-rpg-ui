import * as React from "react";
import type { ResolvedInventory, ResolvedItem } from "lib/domains/inventory";
import { CurrencyRow } from "./CurrencyRow";
import { Section } from "./Section";
import { EncumbranceBar } from "./EncumbranceBar";

interface InventoryBlockProps {
  data: ResolvedInventory;
  /** Optional handler called when the user clicks Equip / Unequip on a
   *  weapon, armor, or shield row. The entity-block wrapper passes a
   *  closure that mutates YAML via `self.setItems`. */
  onToggleEquip?: (item: ResolvedItem) => void;
  /** Optional handler toggling the `for_sale` flag on an item row.
   *  The entity-block wrapper uses `self.setItems` to persist. */
  onToggleForSale?: (item: ResolvedItem) => void;
}

export function InventoryBlock({ data, onToggleEquip, onToggleForSale }: InventoryBlockProps) {
  const { active, cap } = data.attunement;
  return (
    <div className="rpg-inventory-block">
      <CurrencyRow currency={data.currency} sellTotals={data.sellTotals} />
      {cap > 0 && (
        <div
          className="rpg-inventory-block__attunement"
          aria-label="Magic-item attunement"
          data-over={active > cap ? "true" : undefined}
        >
          <span className="rpg-inventory-block__attunement-label">Attunement</span>
          <span className="rpg-inventory-block__attunement-value">
            {active} <span className="rpg-inventory-block__attunement-sep">/</span> {cap}
          </span>
        </div>
      )}
      {data.sections.map((section) => (
        <Section key={section.id} section={section} onToggleEquip={onToggleEquip} onToggleForSale={onToggleForSale} />
      ))}
      <EncumbranceBar total={data.totalWeight} bands={data.bands} load={data.load} />
    </div>
  );
}
