import type {
  EntityDescriptor,
  ItemContainerData,
  ItemElementData,
  ItemMagicData,
  ItemPersonalData,
} from "rpg-ui-toolkit";

/**
 * Lookup exposed by the item entity at system load. Built from every
 * `.md` under `worldbuilding/items/**`, `worldbuilding/magic-items/**`,
 * `worldbuilding/containers/**` and `adventurers/**` by scanning each
 * doc's fences:
 *   - `rpg item.element`   → `$items` (keyed by basename)
 *   - `rpg item.magic`     → `$magic` (keyed by basename)
 *   - `rpg item.personal`  → `$personal` (keyed by basename)
 *   - `rpg item.container` → `$containers` (keyed by basename)
 *
 * The character entity threads these through its own `lookup.*` so the
 * character-side inventory resolver can chase personal → base + magic
 * and container → base + magic + sections without round-tripping
 * through the vault at render time.
 */
export type ItemLookup = {
  $items: Record<string, ItemElementData>;
  $magic: Record<string, ItemMagicData>;
  $personal: Record<string, ItemPersonalData>;
  $containers: Record<string, ItemContainerData>;
};

/** Element block takes the fence YAML as its `self`. */
export type ItemElementProps = ItemElementData & {
  [key: string]: unknown;
};

export type ItemMagicProps = ItemMagicData & {
  [key: string]: unknown;
};

export type ItemPersonalProps = ItemPersonalData & {
  [key: string]: unknown;
};

export type ItemContainerProps = ItemContainerData & {
  [key: string]: unknown;
};

export type ItemBlocks = {
  element: ItemElementProps;
  magic: ItemMagicProps;
  personal: ItemPersonalProps;
  container: ItemContainerProps;
};

export type ItemExpressions = Record<string, never>;

export type ItemEntity = EntityDescriptor<ItemBlocks, ItemLookup, ItemExpressions>;
