import * as React from "react";
import {
  EntityBlock,
  InventoryBlock as InventoryBlockComponent,
  resolveContainer,
  resolveInventory,
  resolvePersonalItem,
  type ItemContainerData,
  type ItemContainerEntry,
  type ItemElementData,
  type ItemMagicData,
  type ItemPersonalData,
  type LookupFn,
  type NewInventoryBlock,
  type ResolvedItem,
} from "rpg-ui-toolkit";
import type { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";
import type { InventoryEquipSlot, InventoryItemEntry, InventoryProps } from "./inventory.types";

/**
 * `rpg character.inventory` entity block.
 *
 * Wraps the shared `InventoryBlock` React component, feeding it resolved
 * item data drawn from the character entity's `lookup.$items` table
 * (built at system load from every `.md` under `worldbuilding/items/**`).
 *
 * STR comes from the sibling `rpg character.stats` block (folding in any
 * ability-score-improvement picks via `expressions.ModifierTotal`), with
 * an inline `encumbrance.strength` override if the author specifies one.
 */
export const inventory: EntityBlock<InventoryProps, CharacterEntity> = ({ self, blocks, lookup, expressions }) => {
  const rawItems = Array.isArray(self.items) ? self.items : [];
  const items = normaliseItems(rawItems);

  const itemsByName = (lookup?.$items ?? {}) as Record<string, ItemElementData>;
  const magicByName = (lookup?.$magic ?? {}) as Record<string, ItemMagicData>;
  const personalByName = (lookup?.$personal ?? {}) as Record<string, ItemPersonalData>;
  const containersByName = (lookup?.$containers ?? {}) as Record<string, ItemContainerData>;
  const containerPaths = (lookup?.$containerPaths ?? {}) as Record<string, string>;

  // Expand any inventory row that links to an `rpg item.container`
  // stash into the container's own sections. The container file wins
  // over the character's local `contents:` — the carrier's sheet shows
  // the authoritative party/stash breakdown without duplication.
  //
  // Each expansion also yields a provenance map: every synthesised
  // child gets the container stem + a locator describing where it
  // lives inside the container's YAML. The toggle-for-sale handler
  // uses this to write back to the right file (the carrier's own
  // YAML for top-level rows; the container's YAML for nested rows).
  const provenanceById = new Map<string, ContainerProvenance>();
  const expandedItems = items.map((entry, idx) => {
    const expansion = expandContainerEntry(entry, {
      containersByName,
      containerPaths,
    });
    if (expansion.provenances.length > 0) {
      for (const p of expansion.provenances) {
        provenanceById.set([String(idx), ...p.pathSegments].join("."), p.info);
      }
    }
    return expansion.entry;
  });

  const block: NewInventoryBlock = {
    items: expandedItems,
    currency: normaliseCurrency(self.currency),
    encumbrance: self.encumbrance,
  };

  const strength = resolveStrength(self, blocks, expressions);

  // The inventory resolver calls `lookupFn(name)` expecting a flat
  // item-element shape. For a compendium base item we return it
  // directly; for a personal item we compose base + magic overlays on
  // the fly; for a container we return the composed effective element
  // so weight / type reflect the base container's properties (plus
  // any magic-overlaid rarity / cost / image).
  const lookupFn: LookupFn = (target) => {
    if (!target) return undefined;
    const stem = target.split("/").pop()!;
    const personal = personalByName[target] ?? personalByName[stem];
    if (personal) {
      const resolution = resolvePersonalItem(personal, { elements: itemsByName, magic: magicByName }, stem);
      if (resolution) return resolution.effectiveElement as unknown as Record<string, unknown>;
    }
    const container = containersByName[target] ?? containersByName[stem];
    if (container) {
      const resolution = resolveContainer(container, { elements: itemsByName, magic: magicByName }, stem);
      if (resolution) return resolution.effectiveElement as unknown as Record<string, unknown>;
    }
    if (itemsByName[target]) return itemsByName[target] as unknown as Record<string, unknown>;
    return itemsByName[stem] as unknown as Record<string, unknown> | undefined;
  };

  const data = resolveInventory({
    block,
    lookup: lookupFn,
    strength,
    attunement: resolveAttunement(items, personalByName, blocks, lookup),
  });

  const selfApi = self as unknown as {
    setItems?: (v: InventoryItemEntry[]) => void;
    patchForeignBlock?: (path: string, entity: string, block: string, key: string, value: unknown) => Promise<void>;
  };
  const setItems = selfApi.setItems;
  const patchForeignBlock = selfApi.patchForeignBlock;
  const handleToggleEquip = setItems
    ? (target: ResolvedItem) => {
        setItems(toggleEquip(items, target, lookupFn));
      }
    : undefined;
  const handleToggleForSale = setItems
    ? (target: ResolvedItem) => {
        const provenance = provenanceById.get(target.id);
        if (provenance) {
          // Container-sourced row — write to the container file's
          // fence so the flag is shared across every carrier of the
          // stash. Falls back to a local no-op when the patcher
          // isn't wired up (e.g. Storybook), since editing the
          // character's items would be lost on the next render
          // anyway (expandContainerEntry overwrites contents).
          if (!patchForeignBlock) return;
          patchContainerForSale(patchForeignBlock, containersByName, provenance);
          return;
        }
        setItems(toggleForSale(items, target));
      }
    : undefined;

  return (
    <InventoryBlockComponent data={data} onToggleEquip={handleToggleEquip} onToggleForSale={handleToggleForSale} />
  );
};

// ─── Container expansion + provenance ────────────────────────────────────────

/**
 * Locator pinpointing where a synthesised inventory row lives inside
 * its source container's YAML. `kind: "section"` references one of the
 * named `sections[]` entries; `kind: "items"` references the trailing
 * unnamed `items[]` list. Both flavours can target a top-level entry
 * or a nested one via `subPath` (indices into `contents[]`).
 */
type ContainerLocator =
  | { kind: "items"; index: number; subPath?: number[] }
  | { kind: "section"; sectionIndex: number; itemIndex: number; subPath?: number[] };

interface ContainerProvenance {
  /** File stem (basename) used to look up the container body. */
  stem: string;
  /** Vault path passed to `patchForeignBlock` for the actual write. */
  path: string;
  locator: ContainerLocator;
}

interface ContainerExpansion {
  entry: InventoryItemEntry;
  provenances: Array<{ pathSegments: string[]; info: ContainerProvenance }>;
}

/**
 * When an inventory entry's wikilink targets an `rpg item.container`
 * file, replace its local `contents:` with entries synthesised from
 * the container's sections. Each named section becomes a synthetic
 * wrapper entry (label = section name, no wikilink → no weight
 * lookup, nested `contents:` carries the section's items). Unnamed
 * sections — and the trailing `container.items` shorthand — spread
 * their items directly under the container row so the common case
 * reads as a plain expandable list.
 *
 * The character's own `contents:` on that row is ignored — container
 * file wins per the design contract.
 *
 * Returns the rewritten entry alongside per-row provenance entries
 * keyed by their relative path within the container's contents
 * (e.g. `["0", "2"]` = third item under the first synthetic wrapper).
 * The caller prepends the parent's top-level index to obtain the
 * final ResolvedItem id key.
 */
function expandContainerEntry(
  entry: InventoryItemEntry,
  lookups: {
    containersByName: Record<string, ItemContainerData>;
    containerPaths: Record<string, string>;
  }
): ContainerExpansion {
  const stem = wikiStem(entry.name);
  const container = lookups.containersByName[stem];
  if (!container) return { entry, provenances: [] };
  const path = lookups.containerPaths[stem] ?? "";
  const contents: InventoryItemEntry[] = [];
  const provenances: ContainerExpansion["provenances"] = [];

  const recordChildren = (
    children: InventoryItemEntry[],
    pathPrefix: string[],
    locatorBase: ContainerLocator
  ): void => {
    children.forEach((child, idx) => {
      const childPath = [...pathPrefix, String(idx)];
      provenances.push({
        pathSegments: childPath,
        info: {
          stem,
          path,
          locator: appendSubPath(locatorBase, [idx]),
        },
      });
      if (Array.isArray(child.contents)) {
        recordChildren(child.contents, childPath, appendSubPath(locatorBase, [idx]));
      }
    });
  };

  // Named sections — each gets a synthetic wrapper row whose `contents`
  // are the converted section items. The wrapper itself has NO
  // provenance entry (it's not a real container item; the carrier's
  // toggle handler hides its $ button via the `link === null` gate).
  const sections = Array.isArray(container.sections) ? container.sections : [];
  sections.forEach((section, sectionIndex) => {
    const sectionItems = Array.isArray(section.items) ? section.items : [];
    if (sectionItems.length === 0) return;
    if (section.name) {
      const childContents = sectionItems.map(toInventoryItemEntry).filter((e): e is InventoryItemEntry => e !== null);
      const wrapperIdx = contents.length;
      contents.push({ name: section.name, contents: childContents });
      recordChildren(childContents, [String(wrapperIdx)], {
        kind: "section",
        sectionIndex,
        itemIndex: -1,
      });
    } else {
      sectionItems.forEach((item, itemIndex) => {
        const converted = toInventoryItemEntry(item);
        if (!converted) return;
        const idx = contents.length;
        contents.push(converted);
        provenances.push({
          pathSegments: [String(idx)],
          info: {
            stem,
            path,
            locator: { kind: "section", sectionIndex, itemIndex },
          },
        });
        if (Array.isArray(converted.contents)) {
          recordChildren(converted.contents, [String(idx)], {
            kind: "section",
            sectionIndex,
            itemIndex,
          });
        }
      });
    }
  });

  // Trailing unnamed `container.items[]` shorthand — spread inline.
  const trailing = Array.isArray(container.items) ? container.items : [];
  trailing.forEach((item, index) => {
    const converted = toInventoryItemEntry(item);
    if (!converted) return;
    const idx = contents.length;
    contents.push(converted);
    provenances.push({
      pathSegments: [String(idx)],
      info: { stem, path, locator: { kind: "items", index } },
    });
    if (Array.isArray(converted.contents)) {
      recordChildren(converted.contents, [String(idx)], {
        kind: "items",
        index,
      });
    }
  });

  return { entry: { ...entry, contents }, provenances };
}

/**
 * Append a `contents[]` index path onto a top-level locator. Used when
 * walking nested children of a container item — the locator anchors at
 * the container's section/items entry and grows a `subPath` describing
 * how to reach the specific descendant.
 */
function appendSubPath(base: ContainerLocator, indices: number[]): ContainerLocator {
  const subPath = [...(base.subPath ?? []), ...indices];
  if (base.kind === "items") {
    return { kind: "items", index: base.index, subPath };
  }
  // For wrapper-level locators we don't have an itemIndex yet — those
  // locators only flow through the recordChildren branch where the
  // first index in `indices` IS the itemIndex.
  if (base.itemIndex < 0) {
    const [first, ...rest] = indices;
    return {
      kind: "section",
      sectionIndex: base.sectionIndex,
      itemIndex: first,
      subPath: [...(base.subPath ?? []), ...rest],
    };
  }
  return {
    kind: "section",
    sectionIndex: base.sectionIndex,
    itemIndex: base.itemIndex,
    subPath,
  };
}

/**
 * Toggle `for_sale` on the container entry pointed at by `provenance`
 * and write the updated array back to the container file's
 * `rpg item.container` fence. We re-read the container body each call
 * (instead of caching) so concurrent edits from other open sheets
 * don't get clobbered.
 */
function patchContainerForSale(
  patchForeignBlock: (path: string, entity: string, block: string, key: string, value: unknown) => Promise<void>,
  containersByName: Record<string, ItemContainerData>,
  provenance: ContainerProvenance
): void {
  if (!provenance.path) return;
  const container = containersByName[provenance.stem];
  if (!container) return;

  if (provenance.locator.kind === "items") {
    const items = (Array.isArray(container.items) ? container.items : []) as unknown[];
    const next = withToggledContainer(items, [provenance.locator.index, ...(provenance.locator.subPath ?? [])]);
    if (!next) return;
    void patchForeignBlock(provenance.path, "item", "container", "items", next);
    return;
  }

  // Section-scoped write — we have to rewrite the whole `sections`
  // array since the YAML key is the array, not an individual section.
  // Capture the locator into a local const so its narrowed type
  // (section variant, after the `kind === "items"` early return)
  // survives the .map() closure below — TS drops property-access
  // narrowing across closure boundaries.
  const sectionLocator = provenance.locator;
  const sections = Array.isArray(container.sections) ? container.sections : [];
  if (sectionLocator.sectionIndex >= sections.length) return;
  const targetSection = sections[sectionLocator.sectionIndex];
  const sectionItems = (Array.isArray(targetSection?.items) ? targetSection.items : []) as unknown[];
  const nextSectionItems = withToggledContainer(sectionItems, [
    sectionLocator.itemIndex,
    ...(sectionLocator.subPath ?? []),
  ]);
  if (!nextSectionItems) return;
  const nextSections = sections.map((section, idx) =>
    idx === sectionLocator.sectionIndex ? { ...section, items: nextSectionItems } : section
  );
  void patchForeignBlock(provenance.path, "item", "container", "sections", nextSections);
}

/**
 * Walk a container's `items[]` (or `section.items[]`) to the entry at
 * `path`, flip its `for_sale` flag, and return a new array with ONLY
 * the touched node cloned — every other entry is preserved by
 * reference (and in its original shape, including bare-string YAML
 * shorthand like `- "[[Foo]]"`). Returns null when the path is
 * unreachable so the caller can no-op silently.
 *
 * The string-preservation matters: an earlier version spread
 * `{ ...it }` over every entry to clone the array, which exploded
 * string entries (`"[[Crossbow, light]]"`) into character-keyed
 * objects (`{ "0": "[", "1": "[", "2": "C", ... }`) when written
 * back through `stringifyYaml`. Touching only the target path keeps
 * the rest of the array byte-stable.
 */
function withToggledContainer(items: unknown[], path: number[]): ItemContainerEntry[] | null {
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
    const updated = withToggledContainer(cloned.contents as unknown[], rest);
    if (!updated) return null;
    cloned.contents = updated;
  }
  const next = items.slice() as ItemContainerEntry[];
  next[head] = cloned;
  return next;
}

/**
 * Coerce a container content entry into the inventory's normalised
 * shape. Tolerates bare YAML strings (`"[[Foo]]"`) the same way
 * `normaliseItem` does for the character inventory — without this
 * coercion, `resolveEntry` later calls `wikilinkTarget(undefined)` on
 * the string-shaped value and crashes with `.match` on undefined.
 */
function toInventoryItemEntry(source: unknown): InventoryItemEntry | null {
  if (typeof source === "string") return { name: source };
  if (!source || typeof source !== "object") return null;
  const o = source as ItemContainerEntry & { name?: unknown };
  if (typeof o.name !== "string") return null;
  const out: InventoryItemEntry = { name: o.name };
  if (typeof o.qty === "number") out.qty = o.qty;
  if (typeof o.notes === "string") out.notes = o.notes;
  // Carry the for_sale flag through synthesis — without this the
  // character inventory's sellTotals row ignores items flagged on
  // the container file (the carrier needs to see what's set aside
  // even when the toggle was authored on the stash directly).
  if (o.for_sale === true) out.for_sale = true;
  if (Array.isArray(o.contents)) {
    out.contents = o.contents.map(toInventoryItemEntry).filter((e): e is InventoryItemEntry => e !== null);
  }
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normaliseItems(raw: unknown[]): InventoryItemEntry[] {
  const out: InventoryItemEntry[] = [];
  for (const entry of raw) {
    const normalised = normaliseItem(entry);
    if (normalised) out.push(normalised);
  }
  return out;
}

function normaliseItem(raw: unknown): InventoryItemEntry | null {
  if (typeof raw === "string") return { name: raw };
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // Tolerate YAML's flow-sequence quirk: `name: [[Foo]]` (unquoted)
  // parses as `[["Foo"]]` — rebuild the wikilink from the inner
  // string so authors don't have to remember the quotes.
  let name: string | null = null;
  if (typeof o.name === "string") {
    name = o.name;
  } else if (Array.isArray(o.name)) {
    let v: unknown = o.name;
    while (Array.isArray(v)) v = v[0];
    if (typeof v === "string") name = `[[${v}]]`;
  }
  if (!name) return null;
  const entry: InventoryItemEntry = { name };
  if (typeof o.qty === "number") entry.qty = o.qty;
  else if (typeof o.quantity === "number") entry.qty = o.quantity;
  if (
    o.section === "weapons" ||
    o.section === "armor" ||
    o.section === "tools" ||
    o.section === "visible" ||
    o.section === "main_containers" ||
    o.section === "other_containers"
  ) {
    entry.section = o.section;
  }
  if (o.container === "main" || o.container === "other") entry.container = o.container;
  if (
    o.slot === "main_hand" ||
    o.slot === "off_hand" ||
    o.slot === "armor" ||
    o.slot === "shield" ||
    o.slot === "attuned"
  ) {
    entry.slot = o.slot;
  }
  if (typeof o.equipped === "boolean") entry.equipped = o.equipped;
  if (typeof o.for_sale === "boolean") entry.for_sale = o.for_sale;
  if (typeof o.notes === "string") entry.notes = o.notes;
  if (Array.isArray(o.contents)) entry.contents = normaliseItems(o.contents);
  return entry;
}

function normaliseCurrency(raw: unknown): NewInventoryBlock["currency"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  const map: Array<[string, string[]]> = [
    ["pp", ["pp", "platinum"]],
    ["gp", ["gp", "gold"]],
    ["ep", ["ep", "electrum"]],
    ["sp", ["sp", "silver"]],
    ["cp", ["cp", "copper"]],
  ];
  for (const [target, aliases] of map) {
    for (const k of aliases) {
      const v = o[k];
      if (typeof v === "number") {
        out[target] = v;
        break;
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Resolve the character's Strength score, folding in ASI picks the same
 * way the Stats block does. Falls back to the YAML override, then to 10.
 */
function resolveStrength(self: InventoryProps, blocks: unknown, _expressions: unknown): number {
  const override = self.encumbrance?.strength;
  if (typeof override === "number") return override;
  // Stats block may carry STR as `STR: 14` or `STR: { value: 14, … }`.
  const stats = (blocks as { stats?: Record<string, unknown> })?.stats ?? {};
  const cell = stats.STR;
  if (typeof cell === "number") return cell;
  if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
    return (cell as { value: number }).value;
  }
  return 10;
}

export default inventory;

// ─── Equip toggle ────────────────────────────────────────────────────────────

/**
 * Apply an equip / unequip toggle to the YAML items list. Auto-routes to
 * the correct slot for the item kind, displacing whatever else lives in
 * that slot. Two-handed weapons claim BOTH hands so the off-hand can't
 * carry a shield while the main is two-handed.
 *
 * Targeting is positional — we walk the top-level items list and match
 * by wikilink stem + index. Nested container contents are ignored
 * because the equip UI only renders top-level rows today.
 */
function toggleEquip(items: InventoryItemEntry[], target: ResolvedItem, lookup: LookupFn): InventoryItemEntry[] {
  const targetIdx = parseInt(target.id, 10);
  if (Number.isNaN(targetIdx) || targetIdx < 0 || targetIdx >= items.length) {
    return items;
  }
  // Cheap clone — we only ever mutate the top-level entries we touch.
  const next: InventoryItemEntry[] = items.map((it) => ({ ...it }));
  const entry = next[targetIdx];
  const wasEquipped = entry.equipped === true || entry.slot !== undefined;

  if (wasEquipped) {
    delete entry.slot;
    delete entry.equipped;
    return next;
  }

  const kind = target.equipKind;
  if (kind === "weapon") {
    const isTwoHanded = weaponIsTwoHanded(target, lookup);
    clearSlot(next, "main_hand");
    if (isTwoHanded) clearSlot(next, "off_hand");
    entry.slot = "main_hand";
  } else if (kind === "armor") {
    clearSlot(next, "armor");
    entry.slot = "armor";
  } else {
    entry.equipped = true;
  }
  return next;
}

function clearSlot(items: InventoryItemEntry[], slot: InventoryEquipSlot): void {
  for (const it of items) {
    if (it.slot === slot) delete it.slot;
  }
}

/**
 * Toggle the `for_sale` flag on one item entry — top-level OR nested
 * inside a container's `contents`. Targets by the resolver's dotted
 * positional id (`"3"` for a top-level entry, `"3.1"` for the second
 * child of the fourth). The walker clones every entry along the path so
 * we never mutate the author's original array — the `setSelf` proxy
 * depends on shallow-object identity to detect changes. */
function toggleForSale(items: InventoryItemEntry[], target: ResolvedItem): InventoryItemEntry[] {
  const path = target.id.split(".").map((s) => parseInt(s, 10));
  if (path.some((n) => Number.isNaN(n) || n < 0)) return items;
  return withToggled(items, path);
}

function withToggled(items: InventoryItemEntry[], path: number[]): InventoryItemEntry[] {
  const [head, ...rest] = path;
  if (head == null || head >= items.length) return items;
  const next = items.map((it) => ({ ...it }));
  const entry = next[head];
  if (rest.length === 0) {
    if (entry.for_sale) delete entry.for_sale;
    else entry.for_sale = true;
    return next;
  }
  if (!Array.isArray(entry.contents)) return items;
  entry.contents = withToggled(entry.contents, rest);
  return next;
}

function weaponIsTwoHanded(item: ResolvedItem, lookup: LookupFn): boolean {
  const props = item.meta.properties;
  if (props && props.some(isTwoHandedToken)) return true;
  // Some weapons declare properties only on the fence body's `weapon`
  // sub-object — re-fetch to read them directly.
  if (!item.linkTarget) return false;
  const fm = lookup(item.linkTarget);
  const weapon = fm && typeof fm === "object" ? (fm as { weapon?: unknown }).weapon : undefined;
  if (!weapon || typeof weapon !== "object") return false;
  const wp = (weapon as { properties?: unknown }).properties;
  return Array.isArray(wp) && wp.some((p) => typeof p === "string" && isTwoHandedToken(p));
}

function isTwoHandedToken(raw: string): boolean {
  const bare = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].toLowerCase();
  return bare === "two-handed" || bare === "twohanded";
}

/** Strip a wikilink wrapper / path prefix down to the bare file stem. */
function wikiStem(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim();
}

/**
 * Count actively-attuned magic items + compute the character's
 * attunement cap. Default cap is 3 (5e standard); features can raise
 * it by publishing `Attunement C.` trait entries whose values parse
 * as signed integers (`+1`, `+2`). The `active` side is the number of
 * top-level personal-item entries in inventory whose fence body has
 * `attuned: true`.
 */
function resolveAttunement(
  items: InventoryItemEntry[],
  personalByName: Record<string, { attuned?: boolean } | undefined>,
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined
): { active: number; cap: number } {
  let active = 0;
  for (const entry of items) {
    const stem = wikiStem(entry.name);
    const personal = personalByName[stem];
    if (personal?.attuned) active++;
  }
  // Trait-driven cap bump. Every `Attunement C.` trait value that
  // parses as a number adds to the baseline. Unparseable values are
  // ignored so authors can safely leave comment-style entries.
  let capBonus = 0;
  try {
    const header = (blocks as { header?: unknown })?.header;
    const features = (blocks as { features?: FeaturesBlockData })?.features;
    const view = lookup?.$features?.(header, features?.choices, features?.additional);
    const values = view?.traits?.["Attunement C."] ?? [];
    for (const raw of values) {
      const n = parseInt(String(raw).replace(/^\+/, ""), 10);
      if (Number.isFinite(n)) capBonus += n;
    }
  } catch {
    // Partial state during first render — trait view may be null.
  }
  return { active, cap: 3 + capBonus };
}
