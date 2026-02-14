/**
 * Inventory domain
 * 
 * Handles parsing and logic for the inventory block.
 * Phase 2: Basic structure with minimal functionality.
 */

import { parse } from "yaml";
import * as Utils from "lib/utils/utils";

/**
 * Inventory item
 */
export interface InventoryItem {
  name: string;
  weight?: number;
  quantity?: number;
  tags?: string[];
  description?: string;
  consumable?: boolean;
}

/**
 * Inventory section
 */
export interface InventorySection {
  name: string;
  items: InventoryItem[];
}

/**
 * Currency
 */
export interface Currency {
  gold?: number;
  silver?: number;
  copper?: number;
  platinum?: number;
  electrum?: number;
}

/**
 * Encumbrance configuration
 */
export interface Encumbrance {
  capacity?: string; // Template string like "{{multiply strength 15}}"
}

/**
 * Inventory block definition
 */
export interface InventoryBlock {
  state_key?: string;
  currency?: Currency;
  sections?: InventorySection[];
  encumbrance?: Encumbrance;
}

/**
 * Parse inventory block from YAML
 */
export function parseInventoryBlock(yamlString: string): InventoryBlock {
  const def: InventoryBlock = {
    currency: {},
    sections: [],
  };

  const parsed = parse(yamlString);
  return Utils.mergeWithDefaults(parsed, def);
}

/**
 * Calculate total weight of all items
 */
export function calculateTotalWeight(sections: InventorySection[]): number {
  let total = 0;
  for (const section of sections) {
    for (const item of section.items) {
      const weight = item.weight || 0;
      const quantity = item.quantity || 1;
      total += weight * quantity;
    }
  }
  return total;
}

/**
 * Get total value of currency in copper pieces
 */
export function getCurrencyInCopper(currency: Currency): number {
  const cp = currency.copper || 0;
  const sp = (currency.silver || 0) * 10;
  const gp = (currency.gold || 0) * 100;
  const pp = (currency.platinum || 0) * 1000;
  const ep = (currency.electrum || 0) * 50;
  return cp + sp + gp + pp + ep;
}
