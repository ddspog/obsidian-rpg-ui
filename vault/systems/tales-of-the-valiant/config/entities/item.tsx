import {
  CreateEntity,
  extractItemElementBlocks,
  type ItemElementData,
} from "rpg-ui-toolkit";
import type { ItemEntity } from "./item.types";
import element from "../blocks/item/element";

/**
 * Item entity — registers the four item-side block renderers and
 * publishes a flat `$items` lookup keyed by file basename. The character
 * entity threads this lookup into its own `lookup.$items` so the
 * character-side inventory resolver gets a single source of truth.
 *
 * Library indexing reads each item file's FIRST `rpg item.element`
 * fence. Files that don't contain one drop out of the library (common
 * for pure magic-template files that only have `rpg item.magic`).
 */
const item = CreateEntity<ItemEntity>(async ({ wiki }) => {
  const itemDocs = ((await wiki.folder("worldbuilding/items")) as unknown as Array<{
    $name?: string;
    $contents?: string;
  }>) ?? [];

  const items: Record<string, ItemElementData> = {};
  for (const d of itemDocs) {
    const name = d?.$name;
    const contents = typeof d?.$contents === "string" ? d.$contents : "";
    if (!name || !contents) continue;
    const parsed = extractItemElementBlocks(contents);
    if (parsed.length > 0 && !items[name]) {
      items[name] = parsed[0];
    }
  }

  return {
    lookup: { $items: items },
    blocks: {
      element,
    },
  };
});

export default item;
