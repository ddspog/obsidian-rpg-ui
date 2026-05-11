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
import type { AttackAspect, DamageSpec } from "../features/attack";

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
  /** One ammo type (string) or a list of types (string[]) the
   *  container is dedicated to. Quiver accepts `[[Arrows]]` +
   *  `[[Crossbow Bolts]]`; Pouch may declare a single `[[Sling Bullets]]`.
   *  Ammo-tracking render mode fires whenever `contents:` holds only
   *  entries whose name matches ONE of the declared types. */
  for_ammo?: string | string[];
  /** Max count of `for_ammo` the container can hold. Renders as
   *  `<carried> / <cap>` in the inventory's stat column. */
  ammo_cap?: number;
  /** When true, the container contributes only its own weight to the
   *  carrier's encumbrance — contents weight is ignored. Set by
   *  Bag-of-Holding-style magic overlays to model extradimensional
   *  interiors. */
  weight_fixed?: boolean;
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

// ─── Magic items ─────────────────────────────────────────────────────────────

/** Which kinds of `item.element` this magic template can overlay.
 *  `families` is an optional tighter whitelist matched by bare file
 *  stem (`"[[Longsword]]" → "Longsword"`). */
export interface ItemMagicAppliesTo {
  kinds?: Array<"shield" | "armor" | "weapon" | "ammunition" | "wondrous" | "potion" | "staff">;
  families?: string[];
}

/** One tier of a multi-variant magic template (`+1` / `+2` / `+3`,
 *  Potion of Healing's Common / Uncommon / Rare / Very Rare). Authored
 *  fields override the template-level ones when the personal item
 *  picks this variant. */
export interface ItemMagicVariant {
  rarity?: string;
  cost?: string;
  bonus?: string;
  damage_bonus?: number;
  extra_damage?: DamageSpec[];
  text?: string;
  traits?: Record<string, string[]>;
}

/**
 * `rpg item.magic` fence body. A reusable magic effect template that a
 * `rpg item.personal` can overlay onto a base `rpg item.element`.
 *
 * Static mechanical effects live inline (`bonus`, `damage_bonus`,
 * `traits`). Feature-driven effects (reactions, passive abilities,
 * curses) are authored as sibling `rpg feature.details` fences in the
 * same file — the compendium card hides them; the character features
 * resolver picks them up whenever a personal item referencing this
 * template is equipped.
 */
export interface ItemMagicData {
  /** Display name; falls back to the file stem when absent. */
  name?: string;
  rarity?: string;
  /** True when the item grants its effects only once attuned. No
   *  enforcement today — the character sheet shows an `Attunement X/3`
   *  readout so the player can keep the count in mind. */
  attunement?: boolean;
  cost?: string;
  image?: string;
  /** Compendium prose. Rendered as markdown. */
  text?: string;
  applies_to?: ItemMagicAppliesTo;
  /** Trait grants merged into the owner's feature-view traits when the
   *  magic is active. Same taxonomy as class / heritage traits. */
  traits?: Record<string, string[]>;
  /** Flat bonus added to attack AND damage rolls for weapons. */
  bonus?: string;
  /** Flat +N damage stacked onto the weapon's base damage. */
  damage_bonus?: number;
  /** Additional damage dice, each rolled alongside the base. */
  extra_damage?: DamageSpec[];
  /** Override the effective element's own weight. Bag of Holding sets
   *  this to `"15 lb."` so the bag always weighs 15 regardless of
   *  contents. Pairs with `weight_fixed` below so the inventory
   *  resolver skips contents weight for encumbrance. */
  weight?: string | number;
  /** Override the container's `weight_cap`. Bag of Holding's 500-lb
   *  interior replaces the base sack's 30-lb cap. */
  weight_cap?: string;
  /** When true, the container's row contributes only its own weight
   *  to the carrier — contents weight is ignored. Models extradim-
   *  ensional-space magic items like Bag of Holding / Handy Haversack. */
  weight_fixed?: boolean;
  /** Multi-tier templates. Keyed by a variant label the personal item
   *  picks via its `variants:` map (`{ "<template>": "<key>" }`). */
  variants?: Record<string, ItemMagicVariant>;
}

/** Parse a single `rpg item.magic` fence body. */
export function parseItemMagic(yamlSource: string): ItemMagicData | null {
  if (!yamlSource || !yamlSource.trim()) return {};
  try {
    const parsed = parseYAML(yamlSource);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ItemMagicData;
    }
  } catch {
    return null;
  }
  return null;
}

/** Extract every `rpg item.magic` fence from a doc's body text.
 *  Mirrors `extractItemElementBlocks` shape so the item entity can
 *  build the `$magic` library at system load. */
export function extractItemMagicBlocks(contents: string): ItemMagicData[] {
  const out: ItemMagicData[] = [];
  if (!contents) return out;
  const re = /```+\s*rpg\s+item\.magic\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const parsed = parseItemMagic(m[1]);
    if (parsed) out.push(parsed);
  }
  return out;
}

// ─── Personal items ──────────────────────────────────────────────────────────

/**
 * `rpg item.personal` fence body. A character-owned instance of an
 * item, composing:
 *   - `base` — the underlying `rpg item.element` (Shield, Glaive, …).
 *   - `magic[]` — zero-or-more `rpg item.magic` templates, overlaid
 *     onto the base in author order.
 *   - `variants{}` — for each magic template whose file has variants,
 *     the key to pick (`{ "Weapon, +1, +2 or +3": "+1" }`).
 *   - `attuned` — player attunement state; contributes to the sheet's
 *     `Attunement X/Y` readout.
 *   - `rarity` — display-only override; the card shows this in the
 *     stripline alongside type / cost / weight so the player sees the
 *     item's overall rarity (which may differ from any single magic
 *     template's rarity when multiple are layered).
 *   - `image` — optional override displayed at the bottom of the card.
 *
 * The inventory resolver follows personal → base + magic at read time
 * to produce the effective item the UI renders (weight sums with base,
 * weapon overlays stack from the magic bonuses, etc.).
 *
 * Lore fields like `notes`, `history`, and `discovered` are NOT part
 * of this schema — they live as plain markdown outside the fence so
 * they can carry full Obsidian formatting without passing through YAML.
 */
export interface ItemPersonalData {
  name?: string;
  base?: string;
  magic?: string[];
  variants?: Record<string, string>;
  attuned?: boolean;
  rarity?: string;
  image?: string;
  /** List of card sub-blocks to hide. Currently understood:
   *  - `"base.desc"` — hide the base element's description body so only
   *    the magic-template texts narrate the item. Designed as an array
   *    so future keys (`"base.image"`, `"magic.text"`, …) can opt out
   *    of individual sections without flag explosion. */
  hide?: string[];
}

export function parseItemPersonal(yamlSource: string): ItemPersonalData | null {
  if (!yamlSource || !yamlSource.trim()) return {};
  try {
    const parsed = parseYAML(yamlSource);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ItemPersonalData;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractItemPersonalBlocks(contents: string): ItemPersonalData[] {
  const out: ItemPersonalData[] = [];
  if (!contents) return out;
  const re = /```+\s*rpg\s+item\.personal\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const parsed = parseItemPersonal(m[1]);
    if (parsed) out.push(parsed);
  }
  return out;
}

// ─── Container items ─────────────────────────────────────────────────────────

/**
 * One named bundle inside a container. Sections are optional — a plain
 * container can declare a flat top-level `items:` list instead. When
 * both are present `sections:` wins; `items:` is treated as a trailing
 * unnamed section.
 *
 * The `items` list reuses the character-inventory YAML entry shape
 * (name, qty, notes, nested contents, …) so the container pipeline
 * hands straight through to the same resolver that backs
 * `rpg character.inventory`.
 */
export interface ItemContainerSection {
  name?: string;
  items?: ItemContainerEntry[];
}

/**
 * Container content entries. Mirror of `YamlItemEntry` from
 * `lib/domains/inventory/schema.ts` — kept as a sibling interface so
 * items/* doesn't take a hard dependency on the inventory module.
 */
export interface ItemContainerEntry {
  name: string;
  qty?: number;
  notes?: string;
  /** Marks this item as set aside for sale. The carrier's inventory
   *  aggregates these into its `To Sell` row even when the entry
   *  lives inside a referenced container file (Kowyn's Bag, Guild
   *  Chest); toggling the `$` button on a row inside an expanded
   *  external container patches THIS field on the container file
   *  itself so the flag is shared across every character carrying
   *  that container. */
  for_sale?: boolean;
  contents?: ItemContainerEntry[];
}

/**
 * `rpg item.container` fence body. A standalone container that is
 * attached to the world (a guild chest, a campaign stash, a party
 * shared bag) — NOT owned by a specific character. Composes like
 * `rpg item.personal`:
 *   - `base`      — the underlying `rpg item.element` whose volume /
 *                   weight_cap / rarity / image apply as defaults.
 *   - `magic[]`   — zero-or-more `rpg item.magic` overlays. For
 *                   containers these can declare weight reduction,
 *                   capacity expansion, or traits that flow to whoever
 *                   has the container equipped.
 *   - `sections[]` — optional content grouping the container renders
 *                   as collapsible sub-tables. When a character's
 *                   inventory references this file, the same sections
 *                   flow into the inventory row.
 *
 * Lore / history / discovery notes live OUTSIDE the fence as plain
 * markdown, matching the `rpg item.personal` convention.
 */
export interface ItemContainerData {
  name?: string;
  base?: string;
  magic?: string[];
  variants?: Record<string, string>;
  image?: string;
  sections?: ItemContainerSection[];
  items?: ItemContainerEntry[];
  /** Coin purse held inside the container. Same shape the character
   *  inventory uses so the world-stash can carry party loot or guild
   *  treasury totals on its own page. */
  currency?: { pp?: number; gp?: number; ep?: number; sp?: number; cp?: number };
  /** List of card sub-blocks to hide. Currently understood:
   *  - `"base.desc"` — hide the base element's description body so only
   *    the magic-template texts narrate the container. Designed as an
   *    array so future keys (`"base.image"`, `"magic.text"`, …) can
   *    opt out of individual sections without flag explosion. */
  hide?: string[];
}

export function parseItemContainer(yamlSource: string): ItemContainerData | null {
  if (!yamlSource || !yamlSource.trim()) return {};
  try {
    const parsed = parseYAML(yamlSource);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ItemContainerData;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractItemContainerBlocks(contents: string): ItemContainerData[] {
  const out: ItemContainerData[] = [];
  if (!contents) return out;
  const re = /```+\s*rpg\s+item\.container\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const parsed = parseItemContainer(m[1]);
    if (parsed) out.push(parsed);
  }
  return out;
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
