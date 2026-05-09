/**
 * New inventory block schema.
 *
 * The new block declares a flat `items:` list (optionally nested via `contents:`)
 * and delegates per-item data (weight, cost, damage, AC, …) to the item's
 * compendium note frontmatter, resolved via wikilinks.
 */

import { parse } from "yaml";

export type SectionId =
  | "weapons"
  | "armor"
  | "tools"
  | "visible"
  | "main_containers"
  | "other_containers";

export type EquipSlot =
  | "main_hand"
  | "off_hand"
  | "armor"
  | "shield"
  | "attuned";

export interface CurrencyPurse {
  pp?: number;
  gp?: number;
  ep?: number;
  sp?: number;
  cp?: number;
}

export interface EncumbranceOverrides {
  strength?: number | string;
  encumbered?: number;
  heavy?: number;
  carry?: number;
  push?: number;
}

export interface YamlItemEntry {
  name: string;
  qty?: number;
  section?: SectionId;
  container?: "main" | "other";
  slot?: EquipSlot;
  equipped?: boolean;
  /** Marks this item as being set aside for sale. The inventory block
   *  sums these costs into a `To Sell` row below the currency chips so
   *  the player can plan shop trips at a glance. */
  for_sale?: boolean;
  notes?: string;
  contents?: YamlItemEntry[];
}

export interface NewInventoryBlock {
  state_key?: string;
  items: YamlItemEntry[];
  currency?: CurrencyPurse;
  encumbrance?: EncumbranceOverrides;
}

/**
 * Parse the new inventory YAML. Returns null when the source is the legacy
 * shape (with top-level `sections:` and no `items:`) so the caller can fall
 * back to the legacy renderer.
 */
export function parseNewInventoryBlock(
  yamlString: string,
): NewInventoryBlock | null {
  let parsed: unknown;
  try {
    parsed = parse(yamlString);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return null;

  return {
    state_key: typeof obj.state_key === "string" ? obj.state_key : undefined,
    items: normalizeItems(obj.items),
    currency: normalizeCurrency(obj.currency),
    encumbrance: normalizeEncumbrance(obj.encumbrance),
  };
}

function normalizeItems(raw: unknown[]): YamlItemEntry[] {
  const out: YamlItemEntry[] = [];
  for (const entry of raw) {
    const normalized = normalizeItem(entry);
    if (normalized) out.push(normalized);
  }
  return out;
}

function normalizeItem(raw: unknown): YamlItemEntry | null {
  if (typeof raw === "string") {
    return { name: raw };
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = normaliseItemName(o.name);
  if (!name) return null;
  const entry: YamlItemEntry = { name };
  if (typeof o.qty === "number") entry.qty = o.qty;
  else if (typeof o.quantity === "number") entry.qty = o.quantity;
  if (isSectionId(o.section)) entry.section = o.section;
  if (o.container === "main" || o.container === "other") entry.container = o.container;
  if (isEquipSlot(o.slot)) entry.slot = o.slot;
  if (typeof o.equipped === "boolean") entry.equipped = o.equipped;
  if (typeof o.for_sale === "boolean") entry.for_sale = o.for_sale;
  if (typeof o.notes === "string") entry.notes = o.notes;
  if (Array.isArray(o.contents)) entry.contents = normalizeItems(o.contents);
  return entry;
}

/**
 * Normalise the `name:` field of an item entry, tolerating YAML's
 * flow-sequence quirks:
 *   - `name: "[[Foo]]"`  → `"[[Foo]]"` (normal quoted wikilink)
 *   - `name: Foo`        → `"Foo"`    (plain label)
 *   - `name: [[Foo]]`    → YAML parses as `[["Foo"]]` (nested flow
 *                          sequence); rebuild `"[[Foo]]"` from the
 *                          inner string so authors don't have to
 *                          remember the quotes.
 * Returns null when nothing stringish comes through.
 */
function normaliseItemName(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    let v: unknown = raw;
    while (Array.isArray(v)) v = v[0];
    if (typeof v === "string") return `[[${v}]]`;
  }
  return null;
}

function normalizeCurrency(raw: unknown): CurrencyPurse | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: CurrencyPurse = {};
  // Accept both short ("gp") and long ("gold") keys.
  const map: Array<[keyof CurrencyPurse, string[]]> = [
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

function normalizeEncumbrance(raw: unknown): EncumbranceOverrides | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: EncumbranceOverrides = {};
  if (typeof o.strength === "number" || typeof o.strength === "string") {
    out.strength = o.strength as number | string;
  }
  if (typeof o.encumbered === "number") out.encumbered = o.encumbered;
  if (typeof o.heavy === "number") out.heavy = o.heavy;
  if (typeof o.carry === "number") out.carry = o.carry;
  if (typeof o.push === "number") out.push = o.push;
  return Object.keys(out).length > 0 ? out : undefined;
}

function isSectionId(v: unknown): v is SectionId {
  return (
    v === "weapons" ||
    v === "armor" ||
    v === "tools" ||
    v === "visible" ||
    v === "main_containers" ||
    v === "other_containers"
  );
}

function isEquipSlot(v: unknown): v is EquipSlot {
  return (
    v === "main_hand" ||
    v === "off_hand" ||
    v === "armor" ||
    v === "shield" ||
    v === "attuned"
  );
}

/** Strip `[[…]]` wrapper and prefer the alias after `|` when present. */
export function wikilinkLabel(raw: string): string {
  const inner = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const pipe = inner.indexOf("|");
  const target = pipe >= 0 ? inner.slice(pipe + 1) : inner;
  return target.split("/").pop()!.trim();
}

/** Extract the wikilink target (the path/name before `|`), or null if not a wikilink. */
export function wikilinkTarget(raw: string): string | null {
  const match = raw.match(/^\[\[(.+?)\]\]$/);
  if (!match) return null;
  const inner = match[1];
  const pipe = inner.indexOf("|");
  return (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
}
