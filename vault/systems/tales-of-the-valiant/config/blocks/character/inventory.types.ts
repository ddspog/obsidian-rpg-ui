/**
 * Props shape for the `rpg character.inventory` entity block.
 *
 * Mirrors the standalone `rpg inventory` YAML schema (flat `items:` list
 * with optional nested `contents:`, currency, encumbrance overrides) so
 * authors can move between the two without rewriting.
 */

export type InventorySectionId =
  | "weapons"
  | "armor"
  | "tools"
  | "visible"
  | "main_containers"
  | "other_containers";

export type InventoryEquipSlot =
  | "main_hand"
  | "off_hand"
  | "armor"
  | "shield"
  | "attuned";

export interface InventoryCurrency {
  pp?: number;
  gp?: number;
  ep?: number;
  sp?: number;
  cp?: number;
}

export interface InventoryEncumbrance {
  strength?: number | string;
  encumbered?: number;
  heavy?: number;
  carry?: number;
  push?: number;
}

export interface InventoryItemEntry {
  name: string;
  qty?: number;
  section?: InventorySectionId;
  container?: "main" | "other";
  slot?: InventoryEquipSlot;
  equipped?: boolean;
  for_sale?: boolean;
  notes?: string;
  contents?: InventoryItemEntry[];
}

export interface InventoryProps {
  /** Flat list of items. Wikilinks resolve via the character entity's
   *  `lookup.$items` map. Items nest via `contents:`. */
  items?: InventoryItemEntry[];
  /** Coin purse. Accepts both short (gp) and long (gold) keys. */
  currency?: InventoryCurrency;
  /** Optional encumbrance thresholds. Anything not set falls back to
   *  STR-based auto-derivation (STR × 5 / × 10 / × 15 / × 30). */
  encumbrance?: InventoryEncumbrance;
  /** Open-ended frontmatter-style passthrough so the block type satisfies
   *  the entity-block `Record<string, unknown>` constraint. */
  [key: string]: unknown;
}
