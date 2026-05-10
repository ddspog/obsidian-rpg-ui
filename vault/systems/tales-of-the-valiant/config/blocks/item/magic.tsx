import * as React from "react";
import {
  EntityBlock,
  ItemMagicCard,
  Markdown,
  type ItemMagicData,
} from "rpg-ui-toolkit";
import type { ItemEntity } from "../../entities/item.types";

/**
 * `rpg item.magic` block — renders the compendium card for a magic
 * effect template. Variants, traits, applies-to whitelists and the
 * prose body flow through `ItemMagicCard`. Any sibling
 * `rpg feature.details` fences in the same file are NOT rendered
 * here — they live on the template as hidden feature sources and
 * surface in a character sheet only when a `rpg item.personal`
 * referencing this template is equipped.
 */
const magic: EntityBlock<ItemMagicData, ItemEntity> = ({ self }) => {
  return (
    <ItemMagicCard
      data={self}
      renderMarkdown={(src) => <Markdown source={src} />}
    />
  );
};

export default magic;
