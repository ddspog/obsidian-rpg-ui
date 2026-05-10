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

  // Fall back to the section's `id` when it's not a known character-
  // inventory bucket. The container card reuses this component with
  // arbitrary author-named sections (`"Ritual Supplies"`,
  // `"Trade Goods"`) — without the fallback those render with an
  // empty heading.
  const label = SECTION_LABELS[section.id as keyof typeof SECTION_LABELS] ?? section.id;

  return (
    <section
      className="rpg-inventory-block__section"
      data-section={section.id}
    >
      <h5 className="rpg-inventory-block__section-title">
        {label}
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
