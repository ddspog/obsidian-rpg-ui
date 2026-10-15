import * as React from "react";
import {
  EntityBlock,
  ItemElementCard,
  Markdown,
  resolvePersonalItem,
  type ItemElementData,
  type ItemMagicData,
  type ItemPersonalData,
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
const element: EntityBlock<ItemElementProps, ItemEntity> = ({ self, lookup }) => {
  let data: ItemElementData = { ...self };
  if (!data.desc && typeof (self as Record<string, unknown>).text === "string") {
    data.desc = (self as Record<string, unknown>).text as string;
  }
  // An item made by its enchantments (`magic:` + `variants:` — a Healing
  // Draft): itself as the base, each template laid over it — its rarity,
  // cost, type and image where it has none, their text (filled from the
  // picked strength) before its own.
  const raw = self as Record<string, unknown>;
  const magic = Array.isArray(raw.magic) ? (raw.magic as string[]) : [];
  if (magic.length > 0) {
    const resolved = resolvePersonalItem(
      {
        base: "[[__self__]]",
        magic,
        ...(raw.variants && typeof raw.variants === "object"
          ? { variants: raw.variants as Record<string, string> }
          : {}),
        ...(data.name ? { name: data.name } : {}),
      } as ItemPersonalData,
      { elements: { __self__: data }, magic: (lookup?.$magic ?? {}) as Record<string, ItemMagicData> }
    );
    if (resolved) {
      const texts = [...resolved.magicTexts, ...(data.desc ? [data.desc] : [])];
      data = { ...resolved.effectiveElement, ...(texts.length ? { desc: texts.join("\n\n") } : {}) };
    }
  }
  return <ItemElementCard data={data} renderMarkdown={(src) => <Markdown source={src} />} />;
};

export default element;
