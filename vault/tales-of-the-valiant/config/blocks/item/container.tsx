import * as React from "react";
import {
  EntityBlock,
  ItemContainerCard,
  Markdown,
  resolveContainer,
  type ContainerForSaleLocation,
  type ItemContainerData,
  type ItemContainerEntry,
  type ItemContainerSection,
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
 *
 * The card's `$` toggle on each leaf row writes back through
 * `self.setSections` / `self.setItems` — so the same `for_sale` flag
 * surfaces in any character sheet that carries this container.
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

  const selfApi = self as unknown as {
    setSections?: (v: ItemContainerSection[]) => void;
    setItems?: (v: ItemContainerEntry[]) => void;
  };

  const handleToggleForSale = (loc: ContainerForSaleLocation) => {
    if (loc.source === "section") {
      const sections = Array.isArray(self.sections) ? self.sections : [];
      if (loc.sectionIndex < 0 || loc.sectionIndex >= sections.length) return;
      const target = sections[loc.sectionIndex];
      const currentItems = (Array.isArray(target?.items) ? target.items : []) as unknown[];
      const nextItems = withToggled(currentItems, loc.path);
      if (!nextItems) return;
      const nextSections = sections.map((s, i) => (i === loc.sectionIndex ? { ...s, items: nextItems } : s));
      selfApi.setSections?.(nextSections);
      return;
    }
    const items = (Array.isArray(self.items) ? self.items : []) as unknown[];
    const next = withToggled(items, loc.path);
    if (!next) return;
    selfApi.setItems?.(next);
  };

  const canToggle = !!(selfApi.setSections || selfApi.setItems);

  return (
    <ItemContainerCard
      data={self}
      resolution={resolution}
      lookup={lookupFn}
      renderMarkdown={(src) => <Markdown source={src} />}
      onToggleForSale={canToggle ? handleToggleForSale : undefined}
    />
  );
};

export default container;

/**
 * Walk a YAML items[] array along `path` and flip `for_sale` on the
 * targeted entry. Bare-string entries (`- "[[Foo]]"`) get coerced to
 * `{ name }` only at the touched node — every other entry survives
 * unchanged so `stringifyYaml` keeps the file's authored shorthand
 * intact (mirrors the `withToggledContainer` helper the character
 * inventory block uses for the same job). Returns null when the path
 * is unreachable so the caller can no-op silently.
 */
function withToggled(items: unknown[], path: number[]): ItemContainerEntry[] | null {
  const [head, ...rest] = path;
  if (head == null || head < 0 || head >= items.length) return null;
  const original = items[head];
  let cloned: ItemContainerEntry;
  if (typeof original === "string") {
    cloned = { name: original };
  } else if (original && typeof original === "object") {
    cloned = { ...(original as ItemContainerEntry) };
  } else {
    return null;
  }
  if (rest.length === 0) {
    if (cloned.for_sale) delete cloned.for_sale;
    else cloned.for_sale = true;
  } else {
    if (!Array.isArray(cloned.contents)) return null;
    const updated = withToggled(cloned.contents as unknown[], rest);
    if (!updated) return null;
    cloned.contents = updated;
  }
  const next = items.slice() as ItemContainerEntry[];
  next[head] = cloned;
  return next;
}
