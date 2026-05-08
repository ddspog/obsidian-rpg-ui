/**
 * `rpg item.element` block schema + parsing.
 *
 * Item elements are the reference-data definition for a named item
 * (Longsword, Backpack, Leather Armor). The shape is intentionally
 * permissive — authors just include the sub-sections relevant to the
 * kind of item. The character inventory resolver reads common fields
 * (weight, type, cost) and kind-specific fields (weapon.damage,
 * armor.ac, container.weight_cap) directly off this object.
 */

import { parse as parseYAML } from "yaml";
import type { AttackAspect } from "../features/attack";

export interface ItemWeaponData {
  damage?: string;
  properties?: string[];
  options?: string[];
  /** Magical or enchanted bonus that stacks with the base damage. */
  bonus?: string;
  /**
   * Explicit attack templates. When present, they replace the default
   * single-attack auto-derivation — one row per template in
   * `rpg character.attacks`. Each template is a partial `AttackAspect`
   * (form, damage roll + type, range, save, notes); the wielder-
   * dependent `to_hit` and `damage.bonus` fields are filled in at
   * render time from the character's stats + the weapon's `bonus` +
   * any magic-item overlay.
   *
   * Used for versatile weapons (two entries — 1-handed and 2-handed),
   * thrown weapons (melee + ranged modes), and magic weapons that add
   * a secondary attack (e.g. Flame Tongue's ignited strike with
   * extra fire damage).
   */
  attacks?: AttackAspect[];
}

export interface ItemArmorData {
  /** Display formula, e.g. `"+2"`, `"11 + DEX"`, `"14 + DEX (max 2)"`,
   *  `"18"`. The same string drives both rendering and AC computation —
   *  `+N` prefixes are treated as flat bonuses (shields), anything else
   *  is a base AC with an optional `+ DEX [cap]` tail. */
  ac?: string;
  category?: "Light" | "Medium" | "Heavy" | "Shield";
  /** Armor/shield-side descriptive properties (`Cumbersome (STR 13)`,
   *  `Noisy`, `Natural Materials`). Rendered alongside the AC in the
   *  card's stat table. */
  properties?: string[];
}

export interface ItemContainerData {
  volume_cap?: string;
  weight_cap?: string;
}

export interface ItemShopData {
  cheap?: string;
  expensive?: string;
  availability?: string[];
}

/** Fully parsed `rpg item.element` fence body. */
export interface ItemElementData {
  type?: string;
  cost?: string;
  weight?: string | number;
  rarity?: string;
  source?: string;
  image?: string;
  desc?: string;
  weapon?: ItemWeaponData;
  armor?: ItemArmorData;
  container?: ItemContainerData;
  shop?: ItemShopData;
  /** Override the file-basename title when the item has a display name
   *  different from the note's filename. */
  name?: string;
}

/** Parse a single fence body into an `ItemElementData`. Returns null on
 *  malformed YAML — the caller decides whether to surface an error. */
export function parseItemElement(yamlSource: string): ItemElementData | null {
  if (!yamlSource || !yamlSource.trim()) return {};
  try {
    const parsed = parseYAML(yamlSource);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ItemElementData;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract every `rpg item.element` fence from a doc's body text. Used by
 * the item entity's library indexer at system load to key items by their
 * file basename without re-rendering anything.
 *
 * Tolerates 3+ backticks and trailing whitespace after the info tag, the
 * same shape the other fence extractors use.
 */
export function extractItemElementBlocks(contents: string): ItemElementData[] {
  const out: ItemElementData[] = [];
  if (!contents) return out;
  const re = /```+\s*rpg\s+item\.element\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const parsed = parseItemElement(m[1]);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Normalise the item weight to a plain number of pounds. Accepts `3`,
 * `"3"`, `"3 lb."`, `"0.5 lb"`. Returns 0 on unusable input — the
 * inventory block uses this for encumbrance summation.
 */
export function parseItemWeight(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return 0;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Classify whether a resolved item's `type` string names a weapon, armor,
 * shield, or container. Matches the section routing in the inventory
 * resolver so routing decisions and rendering hints stay in lockstep.
 */
export function itemKindFromType(
  type: string | undefined,
): "weapon" | "armor" | "shield" | "container" | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (/weapons?\b/.test(t)) return "weapon";
  if (/\bshields?\b/.test(t)) return "shield";
  if (/\barmor\b/.test(t)) return "armor";
  if (/\bcontainer\b/.test(t)) return "container";
  return null;
}
