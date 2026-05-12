/**
 * Compose a `rpg item.personal` instance into its effective shape —
 * base element merged with each authored magic template's variant,
 * summing numeric overlays and collecting traits + feature sources
 * the character sheet needs to surface.
 *
 * The resolver is pure: all lookups arrive as pre-built tables, so
 * the same function works in the Obsidian plugin context (backed by
 * entity lookups) and in Vitest fixtures.
 */

import type { DamageSpec } from "../features/roll";
import type { WeaponOverlay } from "./roll";
import type { ItemElementData, ItemMagicData, ItemMagicVariant, ItemPersonalData } from "./schema";

/** The resolved view a personal item produces for the rest of the
 *  character-sheet pipeline to consume. */
export interface PersonalResolution {
  /** Base element merged with magic overlays. Kept as a normal
   *  `ItemElementData` so every downstream consumer (inventory
   *  resolver, attack derivation, card renderer) can treat it the
   *  same as a non-magic element. */
  effectiveElement: ItemElementData;
  /** Weapon-specific overlay ready to hand to `deriveWeaponRolls`.
   *  Sums `bonus` + `damage_bonus` across every applied magic
   *  template / variant; collects `extra_damage` dice into one list. */
  weaponOverlay: WeaponOverlay;
  /** Trait grants merged across every applied template. Same taxonomy
   *  as class / heritage trait maps so the feature-view aggregator can
   *  merge them in directly. */
  traits: Record<string, string[]>;
  /** File stems of the magic templates whose sibling
   *  `rpg feature.details` fences should surface as feature sources
   *  when this personal item is equipped (Item M6 wiring). */
  magicFeatureSources: string[];
  /** Text bodies of each applied magic template (variant text wins
   *  when the personal picks one). The personal card renders these
   *  inline between the stripline and the base item's description. */
  magicTexts: string[];
  /** True when the personal item is marked `attuned: true`. The sheet
   *  uses this to drive its `Attunement X/Y` readout. */
  attuned: boolean;
  /** Display name the player sees — falls back to the personal file
   *  stem when `personal.name` is absent. */
  displayName: string;
}

export interface PersonalResolverLookups {
  /** Compendium `item.element` library keyed by bare file stem. */
  elements: Record<string, ItemElementData>;
  /** Compendium `item.magic` library keyed by bare file stem. */
  magic: Record<string, ItemMagicData>;
}

/**
 * Resolve a personal item into its effective shape. Returns null when
 * the base element can't be located — callers render the personal
 * card's lore/header but skip mechanical overlays.
 */
export function resolvePersonalItem(
  personal: ItemPersonalData,
  lookups: PersonalResolverLookups,
  personalStem?: string
): PersonalResolution | null {
  const baseKey = wikiStem(personal.base ?? "");
  const base = baseKey ? lookups.elements[baseKey] : undefined;
  if (!base) return null;

  const overlay: WeaponOverlay = {};
  const traits: Record<string, string[]> = {};
  const magicFeatureSources: string[] = [];
  const magicTexts: string[] = [];
  // We stamp the summed attack bonus onto `effectiveElement.weapon.bonus`
  // so the card reads the composed value and `deriveWeaponRoll`'s
  // existing `parseWeaponBonus(weapon.bonus)` path picks it up. We do
  // NOT populate `overlay.attackBonus` as well — doing both would
  // double-count the magic inside `deriveWeaponRoll`.
  let attackBonusSum = 0;
  const extraDamage: DamageSpec[] = [];
  // Merged damage_bonus stays as a number we stamp onto `effectiveElement`
  // so the ItemElementCard renders `1d8 +1 slashing` correctly without
  // re-walking the overlay.
  let damageBonusSum = 0;
  // Rarity / cost reflect the active variant's scaling when the author
  // picks one — otherwise the base-element cost carries through.
  let latestRarity: string | undefined;
  let latestCost: string | undefined;
  // First magic template that carries its own image wins when the
  // personal didn't author one — gives the card a sensible default
  // visual without authors repeating the image reference.
  let fallbackImage: string | undefined;

  for (const magicLink of personal.magic ?? []) {
    const stem = wikiStem(magicLink);
    if (!stem) continue;
    const magic = lookups.magic[stem];
    if (!magic) continue;
    magicFeatureSources.push(stem);

    const variantKey = personal.variants?.[stem] ?? personal.variants?.[magic.name ?? ""] ?? undefined;
    const variant = variantKey ? magic.variants?.[variantKey] : undefined;

    // Compose numeric effects — variant's values take precedence over
    // the template-level defaults, matching the usual override shape.
    const bonusStr = variant?.bonus ?? magic.bonus;
    if (bonusStr) {
      const n = parseBonus(bonusStr);
      if (Number.isFinite(n)) attackBonusSum += n;
    }
    const dmgBonus = variant?.damage_bonus ?? magic.damage_bonus;
    if (typeof dmgBonus === "number") damageBonusSum += dmgBonus;
    const extras = variant?.extra_damage ?? magic.extra_damage ?? [];
    for (const d of extras) extraDamage.push(d);

    // Traits: variant overrides template; both merge into the trait map.
    // Values flow through `normalizeTraitMapValue` so the overlay
    // composer handles the same shapes the feature resolver does —
    // bare-flag booleans (`Initiative A.: true` → `[""]`), lists of
    // strings, and the YAML-flow `[[Link]]` quirk.
    const templateTraits = magic.traits ?? {};
    const variantTraits = variant?.traits ?? {};
    for (const source of [templateTraits, variantTraits]) {
      for (const [key, rawValue] of Object.entries(source)) {
        const values = normalizeTraitMapValue(rawValue);
        if (values.length === 0) continue;
        (traits[key] ??= []).push(...values);
      }
    }

    if (variant?.rarity) latestRarity = variant.rarity;
    else if (magic.rarity) latestRarity = magic.rarity;
    if (variant?.cost) latestCost = variant.cost;
    else if (magic.cost) latestCost = magic.cost;

    // Magic text — variant override wins, else the template's body.
    const textForThis = variant?.text ?? magic.text;
    if (textForThis && textForThis.trim()) magicTexts.push(textForThis);

    // First template with an image becomes the fallback for cards
    // where the personal didn't author one of its own.
    if (!fallbackImage && magic.image) fallbackImage = magic.image;
  }

  // Only extra damage dice need the overlay channel — attack / damage
  // flat bonuses already live on `effectiveElement.weapon.bonus` below.
  if (extraDamage.length > 0) overlay.extraDamage = extraDamage;

  // Build the effective element: weapon damage picks up the summed
  // damage_bonus; cost / rarity reflect the picked variants.
  const effectiveElement: ItemElementData = { ...base };
  if (base.weapon) {
    effectiveElement.weapon = {
      ...base.weapon,
      bonus: composeWeaponBonus(base.weapon.bonus, attackBonusSum, damageBonusSum),
    };
  }
  if (latestRarity) effectiveElement.rarity = latestRarity;
  if (personal.rarity) effectiveElement.rarity = personal.rarity;
  if (latestCost) effectiveElement.cost = latestCost;
  // Image preference: personal override → first magic with an image →
  // base's own image. The card's `showDescription` flag decides
  // whether to actually render it.
  if (personal.image) effectiveElement.image = personal.image;
  else if (fallbackImage && !effectiveElement.image) effectiveElement.image = fallbackImage;
  // The personal's display name overrides the base's name on the card.
  effectiveElement.name = personal.name ?? effectiveElement.name;

  return {
    effectiveElement,
    weaponOverlay: overlay,
    traits,
    magicFeatureSources,
    magicTexts,
    attuned: personal.attuned === true,
    displayName: personal.name ?? personalStem ?? "",
  };
}

/** Parse a signed integer out of a bonus string. `"+1"` → 1, `"-2"` → -2,
 *  `"+1d4"` → 1 (we only track the flat numeric part for overlay
 *  summation; authors who want dice use `extra_damage` instead). */
function parseBonus(raw: string): number {
  const m = raw.match(/[+-]?\d+/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Compose the weapon's `bonus:` field to reflect stacked magic. The
 *  authored base `bonus` may already carry a value (rare — usually
 *  base weapons have no bonus); we sum everything and emit the canonical
 *  signed form so the card's damage line reads `1d8 +1 slashing`. */
function composeWeaponBonus(
  existing: string | undefined,
  attackBonus: number,
  damageBonus: number
): string | undefined {
  const base = existing ? parseBonus(existing) : 0;
  // Damage line reflects the damage-side bonus, which is attack
  // bonus + any extra damage_bonus. The attack-roll side adds
  // `attackBonus` separately inside `deriveWeaponRoll`.
  const total = base + attackBonus + damageBonus;
  if (total === 0) return existing;
  return total > 0 ? `+${total}` : String(total);
}

/** Strip a wikilink wrapper down to its bare file stem. Handles
 *  `"[[folder/Item|Alias]]"` and bare labels uniformly. */
function wikiStem(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim();
}

/** Normalize one trait-map value into the string array shape the rest
 *  of the overlay composer expects. Mirrors `normalizeTraitValue` in
 *  the feature resolver so authors can use the same bare-flag / list /
 *  wikilink shapes on magic-item traits:
 *    - `Initiative A.: true`        → `[""]`      (bare flag)
 *    - `Initiative A.: false`       → `[]`        (suppressed)
 *    - `Skill A.: "[[Perception]]"` → `["[[Perception]]"]`
 *    - `Save P.: [STR, WIS]`        → `["STR", "WIS"]`
 *    - `Skill P.: [[Perception]]`   → `["[[Perception]]"]` (YAML flow) */
function normalizeTraitMapValue(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") return [val];
  if (typeof val === "number") return [String(val)];
  if (typeof val === "boolean") return val ? [""] : [];
  if (Array.isArray(val)) {
    if (val.length === 1 && Array.isArray(val[0]) && val[0].length === 1 && typeof val[0][0] === "string") {
      return [`[[${val[0][0]}]]`];
    }
    return val.flatMap(normalizeTraitMapValue);
  }
  return [];
}
