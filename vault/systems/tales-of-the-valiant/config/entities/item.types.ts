import type { EntityDescriptor, ItemElementData } from "rpg-ui-toolkit";

/**
 * Lookup exposed by the item entity at system load. Built from every
 * `.md` under `worldbuilding/items/**` by scanning each doc's
 * `rpg item.element` / `rpg item.magic` fences and keying by file
 * basename. The character entity threads `$items` through its own
 * `lookup.$items` so the character-side inventory resolver keeps its
 * contract (a flat `Record<name, frontmatter-like-object>`).
 */
export type ItemLookup = {
  $items: Record<string, ItemElementData>;
};

/** Element block takes the fence YAML as its `self`. */
export type ItemElementProps = ItemElementData & {
  [key: string]: unknown;
};

export type ItemBlocks = {
  element: ItemElementProps;
};

export type ItemExpressions = Record<string, never>;

export type ItemEntity = EntityDescriptor<ItemBlocks, ItemLookup, ItemExpressions>;
