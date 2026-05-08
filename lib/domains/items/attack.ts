/**
 * Derive an `AttackAspect` from a weapon-kind `rpg item.element` body,
 * optionally overlaid with `rpg item.magic` bonuses, and the wielder's
 * ability modifiers.
 *
 * 5e-ish rules baked in:
 *   - Melee weapons add STR mod to attack + damage.
 *   - Ranged weapons add DEX mod to attack + damage.
 *   - Weapons with the `Finesse` property use `max(STR, DEX)` mod.
 *   - Magic weapons (element has `weapon.bonus: "+1"`) add that bonus
 *     to BOTH the attack roll and the damage.
 *
 * The derived aspect's `to_hit` / damage.bonus strings are pre-evaluated
 * numeric totals (not template expressions) because they're computed at
 * aggregation time with the wielder's concrete mods in hand — the
 * renderer just displays them.
 */

import type { AttackAspect, DamageSpec } from "../features/attack";
import type { ItemElementData, ItemWeaponData } from "./schema";

export interface WielderStats {
  /** Ability modifiers — each pre-computed as floor((score - 10) / 2). */
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  /** Proficiency bonus. */
  pb: number;
}

/** Overlay bonuses contributed by one or more `rpg item.magic` templates
 *  stacked on top of the base weapon element. Keep the shape narrow —
 *  only the fields that actually modify the derived attack. */
export interface WeaponOverlay {
  /** Flat +N added to attack AND damage. Stacks additively. */
  attackBonus?: number;
  /** Additional damage dice, e.g. `{ roll: "1d6", type: "fire" }`. */
  extraDamage?: DamageSpec[];
  /** Mark this derivation as the bonus-action off-hand strike of a
   *  two-weapon fighting pair. 5e rule: attack roll still uses the
   *  ability mod, but damage does NOT — unless the mod is negative,
   *  in which case it still applies (penalties don't switch off).
   *  Consumed by `deriveWeaponAttack` / `fillAttackTemplate`. */
  offHand?: boolean;
}

/** Detect a weapon's form from its `type:` string ("Melee" / "Ranged").
 *  Falls back to `"melee"` when the tokens are ambiguous — most mystery
 *  weapons are swung rather than thrown. */
export function deriveWeaponForm(type: string | undefined): "melee" | "ranged" {
  if (!type) return "melee";
  const t = type.toLowerCase();
  if (/\branged\b/.test(t)) return "ranged";
  return "melee";
}

/** Parse a weapon's `damage:` string into one DamageSpec. Handles
 *  versatile notation (`"1d8/1d10 slashing"`) — the slash stays in the
 *  roll; rendering keeps it readable as-is. */
export function parseWeaponDamage(raw: string | undefined): DamageSpec | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Split into `<dice> <type>`. Dice is anything before the last
  // space; type is the trailing word(s). For `"1d8"` alone there's no
  // type — assume "untyped".
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace < 0) return { roll: trimmed, type: "untyped" };
  return {
    roll: trimmed.slice(0, lastSpace).trim(),
    type: trimmed.slice(lastSpace + 1).trim().toLowerCase(),
  };
}

/** Lightweight wikilink test: `"[[Finesse]]"` → `"finesse"`. */
function bareToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].toLowerCase();
}

/** Check whether a weapon carries a named property (case-insensitive). */
function hasProperty(weapon: ItemWeaponData | undefined, name: string): boolean {
  const props = weapon?.properties ?? [];
  const target = name.toLowerCase();
  return props.some((p) => bareToken(p) === target);
}

/** Pick the ability mod this weapon uses for attack + damage. 5e rules:
 *  Finesse → `max(STR, DEX)`; Ranged base weapons → DEX; everything
 *  else (including Thrown melee weapons used at range) → STR. The
 *  decision looks at the weapon's *base* form (its `type:` token),
 *  not the per-attack form, so a javelin's thrown mode keeps STR. */
function pickAbilityMod(
  element: ItemElementData,
  weapon: ItemWeaponData | undefined,
  stats: WielderStats,
): { mod: number; ability: "STR" | "DEX" } {
  if (hasProperty(weapon, "finesse")) {
    return stats.dex > stats.str
      ? { mod: stats.dex, ability: "DEX" }
      : { mod: stats.str, ability: "STR" };
  }
  const baseForm = deriveWeaponForm(element.type);
  if (baseForm === "ranged") return { mod: stats.dex, ability: "DEX" };
  return { mod: stats.str, ability: "STR" };
}

/** Render a signed integer: `+3`, `-1`, `+0`. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return "+0";
}

/** Parse a `weapon.bonus` string (`"+1"`, `"+2"`) into its numeric
 *  value. Falls back to 0 when the string can't be parsed. */
export function parseWeaponBonus(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.match(/-?\d+/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build the attack aspect for this weapon + wielder. When the element
 * has no weapon block or no damage, returns null. Used as the fallback
 * single-attack path when the weapon doesn't declare its own
 * `attacks:` list — authoring convenience for simple weapons that only
 * have one mode.
 */
export function deriveWeaponAttack(
  element: ItemElementData,
  stats: WielderStats,
  overlay?: WeaponOverlay,
  displayName?: string,
): AttackAspect | null {
  const weapon = element.weapon;
  if (!weapon || !weapon.damage) return null;

  const form = deriveWeaponForm(element.type);
  const { mod, ability } = pickAbilityMod(element, weapon, stats);
  const weaponBonus = parseWeaponBonus(weapon.bonus) + (overlay?.attackBonus ?? 0);

  const baseDamage = parseWeaponDamage(weapon.damage);
  const damageMod = offHandDamageMod(mod, overlay);
  const damageParts: DamageSpec[] = [];
  if (baseDamage) {
    damageParts.push({
      ...baseDamage,
      bonus: signed(damageMod + weaponBonus),
    });
  }
  for (const extra of overlay?.extraDamage ?? []) {
    damageParts.push(extra);
  }

  const toHit = signed(stats.pb + mod + weaponBonus);
  const range = form === "ranged"
    ? findRangeInProperties(weapon.properties)
    : hasProperty(weapon, "reach")
      ? "10 ft."
      : "5 ft.";

  return {
    name: displayName,
    form,
    to_hit: `${toHit} (${ability})`,
    range,
    requires: hasProperty(weapon, "two-handed") ? "two_hands" : "one_hand",
    damage: damageParts.length === 1 ? damageParts[0] : damageParts.length > 1 ? damageParts : undefined,
  };
}

/**
 * Build one or more attack aspects for this weapon + wielder.
 *
 * Resolution order:
 *   1. If `weapon.attacks:` is authored, each entry is a template
 *      (author's explicit override — used for magic weapons with
 *      special attack rules). The deriver fills in to-hit / bonus.
 *   2. Else, templates are INFERRED from `weapon.damage` and
 *      `weapon.properties` — Versatile fans out to 1h + 2h, Thrown
 *      fans out to melee + ranged, Two-Handed stays as a single
 *      two-hand attack. Each inferred template carries its own
 *      `requires` so the character.attacks block can filter by
 *      current equipment.
 *
 * Returns an empty array for non-weapon items (or weapons with no
 * declared damage).
 */
export function deriveWeaponAttacks(
  element: ItemElementData,
  stats: WielderStats,
  overlay?: WeaponOverlay,
  displayName?: string,
): AttackAspect[] {
  const weapon = element.weapon;
  if (!weapon) return [];

  // Explicit attacks list wins.
  if (Array.isArray(weapon.attacks) && weapon.attacks.length > 0) {
    return weapon.attacks.map((template, idx) =>
      fillAttackTemplate(template, element, stats, overlay, displayName, idx),
    );
  }

  // Inference from damage + properties.
  const inferred = inferWeaponTemplates(element);
  if (inferred.length > 0) {
    return inferred.map((template, idx) =>
      fillAttackTemplate(template, element, stats, overlay, displayName, idx),
    );
  }

  // Last resort: single attack from `weapon.damage`.
  const single = deriveWeaponAttack(element, stats, overlay, displayName);
  return single ? [single] : [];
}

/**
 * Derive attack templates from a weapon's declared `damage` and
 * `properties`. Handles the common 5e property combinations:
 *   - Versatile "1d8/1d10 slashing" → [1h 1d8, 2h 1d10].
 *   - Two-Handed                     → [2h single attack].
 *   - Thrown (with range in properties) → appends a ranged variant.
 *   - No relevant property           → [1h single attack].
 */
function inferWeaponTemplates(element: ItemElementData): AttackAspect[] {
  const weapon = element.weapon;
  if (!weapon || !weapon.damage) return [];
  const baseForm = deriveWeaponForm(element.type);
  const damage = parseWeaponDamage(weapon.damage);
  if (!damage) return [];

  const versatile = hasProperty(weapon, "versatile");
  const twoHanded = hasProperty(weapon, "two-handed");
  const thrown = hasProperty(weapon, "thrown");
  const reach = hasProperty(weapon, "reach");
  const meleeRange = reach ? "10 ft." : "5 ft.";
  const rangedRange = findRangeInProperties(weapon.properties);
  const baseRange = baseForm === "ranged" ? rangedRange : meleeRange;

  const out: AttackAspect[] = [];

  if (versatile) {
    const [oneHandRoll, twoHandRoll] = damage.roll.split("/");
    out.push({
      form: baseForm,
      range: baseRange,
      damage: { roll: oneHandRoll, type: damage.type },
      requires: "one_hand",
    });
    out.push({
      name: "Two-Handed",
      form: baseForm,
      range: baseRange,
      damage: { roll: twoHandRoll ?? oneHandRoll, type: damage.type },
      requires: "two_hands",
    });
  } else if (twoHanded) {
    out.push({
      form: baseForm,
      range: baseRange,
      damage,
      requires: "two_hands",
    });
  } else {
    out.push({
      form: baseForm,
      range: baseRange,
      damage,
      requires: "one_hand",
    });
  }

  if (thrown) {
    // A Thrown melee weapon fans out to one extra ranged attack using
    // the primary damage die; the ability-pick logic keeps STR (or
    // max(STR,DEX) for Finesse-thrown like daggers) because
    // `pickAbilityMod` keys off the weapon's base type, not per-attack
    // form.
    const primary = out[0];
    const primaryDamage = normaliseTemplateDamage(primary.damage)[0];
    out.push({
      name: "Thrown",
      form: "ranged",
      range: rangedRange,
      damage: primaryDamage ? { ...primaryDamage } : undefined,
      requires: "one_hand",
    });
  }

  return out;
}

/** Pull a range string like `"30/120 ft."`, `"150/600"`, or `"5 ft."`
 *  out of a weapon's `properties:` array. Authors write it inside the
 *  `[[Range]]` parenthesis (`"([[Range]] 30/120 ft.)"` for Javelin,
 *  `"([[Range]] 150/600)"` for Longbow — the `ft.` suffix is optional).
 *  Falls back to undefined when no range is declared. */
function findRangeInProperties(properties: string[] | undefined): string | undefined {
  if (!properties) return undefined;
  for (const p of properties) {
    // First try: explicit "Range NN/NN [ft.]" pattern (handles Longbow's
    // missing-ft authoring as well as Javelin's full form).
    const labelled = p.match(/Range\]?\]?\s+(\d+(?:\/\d+)?(?:\s*ft\.?)?)/i);
    if (labelled) return labelled[1].includes("ft") ? labelled[1] : `${labelled[1]} ft.`;
    // Fallback: any "NN/NN ft." or "NN ft." standalone.
    const bare = p.match(/(\d+(?:\/\d+)?\s*ft\.?)/);
    if (bare) return bare[1];
  }
  return undefined;
}

/** Fill in the wielder-dependent parts of an authored attack template.
 *  Mirrors the math in `deriveWeaponAttack` but uses the template's
 *  declared `form`, damage dice, range, save, and notes verbatim. */
function fillAttackTemplate(
  template: AttackAspect,
  element: ItemElementData,
  stats: WielderStats,
  overlay: WeaponOverlay | undefined,
  displayName: string | undefined,
  index: number,
): AttackAspect {
  const form: AttackAspect["form"] = template.form ?? "melee";
  const weapon = element.weapon;
  const weaponBonus = parseWeaponBonus(weapon?.bonus) + (overlay?.attackBonus ?? 0);

  // Derive the ability mod for melee/ranged forms; spell/save forms
  // leave the template's to-hit / DC intact (the consuming block can
  // overlay the caster's spellcasting mod later when it wires spells).
  let mod = 0;
  let ability: "STR" | "DEX" | null = null;
  if (form === "melee" || form === "ranged") {
    const picked = pickAbilityMod(element, weapon, stats);
    mod = picked.mod;
    ability = picked.ability;
  }

  // Damage: stamp the base mod + weapon bonus onto each declared
  // damage instance. Extras from the overlay get appended verbatim.
  const damageMod = offHandDamageMod(mod, overlay);
  const baseDamage: DamageSpec[] = normaliseTemplateDamage(template.damage).map((d) => ({
    ...d,
    bonus: form === "melee" || form === "ranged" ? signed(damageMod + weaponBonus) : d.bonus,
  }));
  const withOverlay: DamageSpec[] = [...baseDamage, ...(overlay?.extraDamage ?? [])];

  // to-hit: for weapon-style attacks, render the numeric total; for
  // spell/save forms, carry the template's own string through (usually
  // the caster fills it in separately). Template-provided to_hit wins
  // on all forms so GMs can override.
  let toHit = template.to_hit;
  if (!toHit && (form === "melee" || form === "ranged") && ability) {
    toHit = `${signed(stats.pb + mod + weaponBonus)} (${ability})`;
  }

  const name =
    template.name ??
    (index === 0 ? displayName : displayName ? `${displayName} (${index + 1})` : undefined);

  return {
    ...template,
    name,
    form,
    to_hit: toHit,
    damage: withOverlay.length === 1 ? withOverlay[0] : withOverlay.length > 1 ? withOverlay : template.damage,
  };
}

/** Flatten an `AttackAspect.damage` field (scalar or array) into a
 *  canonical array. Templates can author either shape. */
function normaliseTemplateDamage(raw: AttackAspect["damage"]): DamageSpec[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** 5e two-weapon fighting: the bonus off-hand strike doesn't add a
 *  positive ability modifier to damage, but negative mods still apply.
 *  Returns the damage-side mod value the caller should use, which
 *  matches `mod` for the primary attack. */
function offHandDamageMod(mod: number, overlay: WeaponOverlay | undefined): number {
  if (!overlay?.offHand) return mod;
  return mod < 0 ? mod : 0;
}
