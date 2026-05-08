/**
 * Attack aspect — data shape shared by features, items (weapon elements
 * and magic overlays), and spells to describe an attack well enough for
 * `rpg character.attacks` to aggregate, evaluate, and render every
 * available attack the character has access to.
 *
 * Consumed by:
 *   - `rpg character.attacks`  — primary table + favorites picker.
 *   - `rpg character.inventory` — optional inline display of an
 *     equipped weapon's derived attack (deferred).
 *   - `rpg item.element` weapon block — optional inline attack row on
 *     the item card itself (deferred).
 *
 * Authored on:
 *   - `rpg feature.details` — via `attack:` aspect key.
 *   - `rpg spell`           — via optional `attack:` field.
 *   - `rpg item.magic`      — overlays that augment a weapon attack.
 *
 * Weapon elements don't author an attack aspect explicitly; the
 * character-side block DERIVES one from the weapon's `damage:` /
 * `properties:` + the wielder's stats via `deriveWeaponAttack()`.
 */

/** One damage instance on an attack. An attack can produce multiple
 *  (e.g. `1d8 slashing + 1d6 fire` from a flaming longsword). */
export interface DamageSpec {
  /** Dice expression — `"1d8"`, `"1d8/1d10"` for versatile, `"2d6"`. */
  roll: string;
  /** Damage type — `"slashing"` / `"piercing"` / `"fire"` / `"radiant"` /
   *  whatever the SRD uses. Lowercase by convention. */
  type: string;
  /** Flat bonus ( `"+1"`, `"+{{STR_MOD}}"`). Rendered alongside the roll
   *  and folded into the total at eval time. */
  bonus?: string;
}

/** Save-based attacks skip the to-hit roll; the target rolls a save
 *  against the DC, and damage is usually halved on a successful save. */
export interface AttackSave {
  /** Saving throw attribute: `"STR"` / `"DEX"` / `"WIS"` / … */
  ability: string;
  /** DC expression — literal or formula (`"8 + {{PB}} + {{WIS_MOD}}"`). */
  dc?: string;
  /** Outcome on a successful save — free text (`"half damage"` / `"no effect"`). */
  on_success?: string;
}

/**
 * Full attack aspect. `form` is the only required field because it drives
 * both to-hit derivation and how the attack renders (save-type attacks
 * show a DC instead of a to-hit; spell-type attacks use the caster's
 * spellcasting ability mod, not STR/DEX).
 */
export interface AttackAspect {
  /** Display name for this attack. Falls back to the parent feature /
   *  spell / item name when omitted. */
  name?: string;
  /** `melee` / `ranged` use weapon-style to-hit (PB + STR or DEX mod +
   *  magic bonus). `spell` uses PB + spellcasting ability mod. `save`
   *  targets a saving throw instead. */
  form: "melee" | "ranged" | "spell" | "save";
  /** One or more damage instances. Most attacks have one; magic items
   *  can stack (`1d8 slashing + 1d6 fire`). */
  damage?: DamageSpec | DamageSpec[];
  /** Override the derived to-hit expression. When omitted for melee /
   *  ranged / spell forms, the consumer derives it from `form` + stats. */
  to_hit?: string;
  /** Reach / normal range / long range — free text. */
  range?: string;
  /** Save-form attacks only: DC + outcome on success. */
  save?: AttackSave;
  /** Equipment requirement for this attack to be available:
   *    - `none`       → always available (spells, mental abilities).
   *    - `one_hand`   → the source weapon must occupy at least one hand
   *                     slot (main_hand or off_hand).
   *    - `two_hands`  → the source weapon must occupy main_hand AND the
   *                     off_hand must be empty (or also hold the weapon).
   *    - `free_hand`  → at least one hand must be empty (unarmed
   *                     attacks like Claws, Monk martial arts).
   *  Omitted → inferred by the consumer (melee/ranged weapons default to
   *  `one_hand`; spell/save forms default to `none`). */
  requires?: "none" | "one_hand" | "two_hands" | "free_hand";
  /** Free-text notes surfaced in the attack row's `Notes` column. */
  notes?: string;
}
