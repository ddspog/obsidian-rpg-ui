import {
  CreateEntity,
  extractItemElementBlocks,
  extractItemMagicBlocks,
  extractItemPersonalBlocks,
  extractItemContainerBlocks,
  type ItemContainerData,
  type ItemElementData,
  type ItemMagicData,
  type ItemPersonalData,
} from "rpg-ui-toolkit";
import type { ItemEntity } from "./item.types";
import element from "../blocks/item/element";
import magicBlock from "../blocks/item/magic";
import personalBlock from "../blocks/item/personal";
import containerBlock from "../blocks/item/container";

/**
 * Item entity — publishes four flat lookups the character pipeline
 * consumes at render time:
 *   - `$items`      — `rpg item.element` bodies, keyed by file basename.
 *   - `$magic`      — `rpg item.magic` templates, keyed by file basename.
 *   - `$personal`   — `rpg item.personal` instances the player owns.
 *   - `$containers` — `rpg item.container` stashes attached to the
 *                     world (guild chest, party bag). The character
 *                     inventory follows this map when a row's wikilink
 *                     targets a container file so the stash's own
 *                     sections render inside the inventory row.
 *
 * All four scan the same directory tree (`worldbuilding/items/**`,
 * `worldbuilding/magic-items/**`, `worldbuilding/containers/**`, and
 * `adventurers/**`) so player-owned personals and world stashes live
 * close to their authoring contexts without leaking into the
 * compendium lookups.
 *
 * Library indexing reads each item file's FIRST fence of each kind.
 */
const item = CreateEntity<ItemEntity>(async ({ wiki }) => {
  const compendium = ((await wiki.folder("worldbuilding/items")) as unknown as Array<{
    $name?: string;
    $contents?: string;
  }>) ?? [];
  const magicCompendium = ((await wiki.folder("worldbuilding/magic-items")) as unknown as Array<{
    $name?: string;
    $contents?: string;
  }>) ?? [];
  const containersCompendium = ((await wiki.folder("worldbuilding/containers")) as unknown as Array<{
    $name?: string;
    $contents?: string;
  }>) ?? [];
  const adventurers = ((await wiki.folder("adventurers")) as unknown as Array<{
    $name?: string;
    $contents?: string;
  }>) ?? [];

  const items: Record<string, ItemElementData> = {};
  const magic: Record<string, ItemMagicData> = {};
  const personal: Record<string, ItemPersonalData> = {};
  const containers: Record<string, ItemContainerData> = {};

  const index = (docs: typeof compendium): void => {
    for (const d of docs) {
      const name = d?.$name;
      const contents = typeof d?.$contents === "string" ? d.$contents : "";
      if (!name || !contents) continue;
      const elementBodies = extractItemElementBlocks(contents);
      if (elementBodies.length > 0 && !items[name]) {
        items[name] = elementBodies[0];
      }
      const magicBodies = extractItemMagicBlocks(contents);
      if (magicBodies.length > 0 && !magic[name]) {
        magic[name] = magicBodies[0];
      }
      const personalBodies = extractItemPersonalBlocks(contents);
      if (personalBodies.length > 0 && !personal[name]) {
        personal[name] = personalBodies[0];
      }
      const containerBodies = extractItemContainerBlocks(contents);
      if (containerBodies.length > 0 && !containers[name]) {
        containers[name] = containerBodies[0];
      }
    }
  };

  index(compendium);
  index(magicCompendium);
  index(containersCompendium);
  index(adventurers);

  return {
    lookup: {
      $items: items,
      $magic: magic,
      $personal: personal,
      $containers: containers,
    },
    blocks: {
      element,
      magic: magicBlock,
      personal: personalBlock,
      container: containerBlock,
    },
  };
});

export default item;
