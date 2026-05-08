import * as React from "react";
import type { ResolvedItem, ResolvedSection } from "lib/domains/inventory";
import { SECTION_LABELS } from "lib/domains/inventory";
import { ItemRow } from "./ItemRow";

interface SectionProps {
  section: ResolvedSection;
  /** Hide the section entirely when it has no items. Defaults to true. */
  hideWhenEmpty?: boolean;
  onToggleEquip?: (item: ResolvedItem) => void;
  onToggleForSale?: (item: ResolvedItem) => void;
}

export function Section({ section, hideWhenEmpty = true, onToggleEquip, onToggleForSale }: SectionProps) {
  if (hideWhenEmpty && section.items.length === 0) return null;

  return (
    <section
      className="rpg-inventory-block__section"
      data-section={section.id}
    >
      <h5 className="rpg-inventory-block__section-title">
        {SECTION_LABELS[section.id]}
      </h5>
      <div className="rpg-inventory-block__section-body">
        {section.items.length === 0 ? (
          <div className="rpg-inventory-block__section-empty">—</div>
        ) : (
          section.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              sectionId={section.id}
              onToggleEquip={onToggleEquip}
              onToggleForSale={onToggleForSale}
            />
          ))
        )}
      </div>
    </section>
  );
}
