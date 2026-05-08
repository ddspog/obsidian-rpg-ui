import * as React from "react";
import {
  EntityBlock,
  InventoryBlock as InventoryBlockComponent,
  resolveInventory,
  type LookupFn,
  type NewInventoryBlock,
  type ResolvedItem,
} from "rpg-ui-toolkit";
import type { CharacterEntity } from "../../entities/character.types";
import type {
  InventoryEquipSlot,
  InventoryItemEntry,
  InventoryProps,
} from "./inventory.types";

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
export const inventory: EntityBlock<InventoryProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  expressions,
}) => {
  const rawItems = Array.isArray(self.items) ? self.items : [];
  const items = normaliseItems(rawItems);

  const block: NewInventoryBlock = {
    items,
    currency: normaliseCurrency(self.currency),
    encumbrance: self.encumbrance,
  };

  const strength = resolveStrength(self, blocks, expressions);

  const itemsByName = lookup?.$items ?? {};
  const lookupFn: LookupFn = (target) => {
    if (!target) return undefined;
    if (itemsByName[target]) return itemsByName[target];
    // Wikilink like `[[path/Longsword|Alias]]` — reach for the last
    // segment (bare stem). resolveInventory already strips brackets for us
    // but we re-strip here to handle path-qualified targets too.
    const stem = target.split("/").pop()!;
    return itemsByName[stem];
  };

  const data = resolveInventory({ block, lookup: lookupFn, strength });

  const setItems = (self as unknown as { setItems?: (v: InventoryItemEntry[]) => void }).setItems;
  const handleToggleEquip = setItems
    ? (target: ResolvedItem) => {
        setItems(toggleEquip(items, target, lookupFn));
      }
    : undefined;
  const handleToggleForSale = setItems
    ? (target: ResolvedItem) => {
        setItems(toggleForSale(items, target));
      }
    : undefined;

  return (
    <InventoryBlockComponent
      data={data}
      onToggleEquip={handleToggleEquip}
      onToggleForSale={handleToggleForSale}
    />
  );
};

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
  if (typeof o.name !== "string") return null;
  const entry: InventoryItemEntry = { name: o.name };
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
function resolveStrength(
  self: InventoryProps,
  blocks: unknown,
  _expressions: unknown,
): number {
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
function toggleEquip(
  items: InventoryItemEntry[],
  target: ResolvedItem,
  lookup: LookupFn,
): InventoryItemEntry[] {
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
function toggleForSale(
  items: InventoryItemEntry[],
  target: ResolvedItem,
): InventoryItemEntry[] {
  const path = target.id.split(".").map((s) => parseInt(s, 10));
  if (path.some((n) => Number.isNaN(n) || n < 0)) return items;
  return withToggled(items, path);
}

function withToggled(
  items: InventoryItemEntry[],
  path: number[],
): InventoryItemEntry[] {
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
  const bare = raw
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .toLowerCase();
  return bare === "two-handed" || bare === "twohanded";
}
