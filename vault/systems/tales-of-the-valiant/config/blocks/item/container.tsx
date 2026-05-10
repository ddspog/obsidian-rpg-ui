import * as React from "react";
import {
  EntityBlock,
  ItemContainerCard,
  Markdown,
  resolveContainer,
  type ItemContainerData,
  type ItemElementData,
  type ItemMagicData,
  type LookupFn,
} from "rpg-ui-toolkit";
import type { ItemEntity } from "../../entities/item.types";

/**
 * `rpg item.container` block — the world-attached stash's own page
 * (guild chest, campaign vault, party shared bag). Composes
 * `base + magic[] + variants{}` through the container overlay
 * composer to produce the effective element + resolved sections, then
 * hands the composed view to `ItemContainerCard` along with a vault
 * lookup so per-row weights and capacity totals render in-line.
 */
const container: EntityBlock<ItemContainerData, ItemEntity> = ({ self, lookup }) => {
  const elements = (lookup?.$items ?? {}) as Record<string, ItemElementData>;
  const magicLib = (lookup?.$magic ?? {}) as Record<string, ItemMagicData>;
  const resolution = resolveContainer(self, { elements, magic: magicLib });
  const lookupFn: LookupFn = (target) => {
    if (!target) return undefined;
    const stem = target.split("/").pop()!;
    if (elements[target]) return elements[target] as unknown as Record<string, unknown>;
    return elements[stem] as unknown as Record<string, unknown> | undefined;
  };
  return (
    <ItemContainerCard
      data={self}
      resolution={resolution}
      lookup={lookupFn}
      renderMarkdown={(src) => <Markdown source={src} />}
    />
  );
};

export default container;
