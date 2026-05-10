import * as React from "react";
import {
  EntityBlock,
  ItemPersonalCard,
  Markdown,
  resolvePersonalItem,
  type ItemElementData,
  type ItemMagicData,
  type ItemPersonalData,
} from "rpg-ui-toolkit";
import type { ItemEntity } from "../../entities/item.types";

/**
 * `rpg item.personal` block — the owning character's view of a
 * specific magic-item instance. Walks `base + magic[] + variants{}`
 * through the overlay composer to produce the effective element that
 * renders as an inline item card, plus the lore sections (notes,
 * history, discovered).
 *
 * Mechanical overlays (weight, damage, AC, traits) land in the
 * character inventory / attack / feature pipeline via their separate
 * `lookup.$personal` path — this block is purely display.
 */
const personal: EntityBlock<ItemPersonalData, ItemEntity> = ({ self, lookup }) => {
  const elements = (lookup?.$items ?? {}) as Record<string, ItemElementData>;
  const magicLib = (lookup?.$magic ?? {}) as Record<string, ItemMagicData>;
  const resolution = resolvePersonalItem(self, { elements, magic: magicLib });
  return (
    <ItemPersonalCard
      data={self}
      resolution={resolution}
      renderMarkdown={(src) => <Markdown source={src} />}
    />
  );
};

export default personal;
