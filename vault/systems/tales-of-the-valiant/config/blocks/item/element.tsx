import * as React from "react";
import {
  EntityBlock,
  ItemElementCard,
  Markdown,
  type ItemElementData,
} from "rpg-ui-toolkit";
import type { ItemEntity, ItemElementProps } from "../../entities/item.types";

/**
 * `rpg item.element` block — renders the item's reference-data card.
 *
 * No auto-generated title or source footer: the host note's own H1
 * heading (authored in markdown) serves as the page title, and the
 * source attribution is likewise a normal markdown line outside the
 * fence. Shop prices (`shop.cheap` / `shop.expensive` / `availability`)
 * stay in the YAML as consumable data but aren't rendered here —
 * downstream blocks (shop ledger, inventory cost rollup) read them via
 * `lookup.$items[name].shop`.
 */
const element: EntityBlock<ItemElementProps, ItemEntity> = ({ self }) => {
  const data: ItemElementData = self;
  return (
    <ItemElementCard
      data={data}
      renderMarkdown={(src) => <Markdown source={src} />}
    />
  );
};

export default element;
