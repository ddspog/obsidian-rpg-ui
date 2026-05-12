/**
 * Roll aspect — data shape shared by features, items (weapon elements
 * and magic overlays), and spells to describe any dice-rolling action
 * the character can take, well enough for `rpg character.rolls` to
 * aggregate, evaluate, and render every available roll.
 *
 * The aspect covers every form of dice-based action the character can
 * initiate: weapon attacks, spell attacks, save-based effects, rider
 * damage (Mystic Mark / Hex / Divine Smite), plus healing and temp-HP
 * buffs. The common shape is: a `form` that dictates how the row
 * renders + how to-hit / DC are derived; optional `damage` dice; an
 * optional save; explicit effects; free-text notes.
 *
 * Consumed by:
 *   - `rpg character.rolls`    — primary table aggregating every roll.
 *   - `rpg character.inventory` — optional inline display of an
 *     equipped weapon's derived roll (deferred).
 *   - `rpg item.element` weapon block — optional inline roll row on
 *     the item card itself (deferred).
 *
 * Authored on:
 *   - `rpg feature.details` — via the `roll:` aspect key.
 *   - `rpg spell`           — via the optional `roll:` field.
 *   - `rpg item.magic`      — overlays that augment a weapon roll.
 *
 * Weapon elements don't author a roll aspect explicitly; the
 * character-side block DERIVES one from the weapon's `damage:` /
 * `properties:` + the wielder's stats via `deriveWeaponRoll()`.
 */

/** One damage instance on a roll. A roll can produce multiple
 *  (e.g. `1d8 slashing + 1d6 fire` from a flaming longsword; healing
 *  rolls reuse this shape with a semantic `type: "healing"`). */
export interface DamageSpec {
  /** Dice expression — `"1d8"`, `"1d8/1d10"` for versatile, `"2d6"`. */
  roll: string;
  /** Damage type — `"slashing"` / `"piercing"` / `"fire"` / `"radiant"` /
   *  `"healing"` / `"temp HP"` / whatever fits. Lowercase by convention. */
  type: string;
  /** Flat bonus ( `"+1"`, `"+{{STR_MOD}}"`). Rendered alongside the roll
   *  and folded into the total at eval time. */
  bonus?: string;
}

/** Save-based rolls skip the to-hit roll; the target rolls a save
 *  against the DC, and damage is usually halved on a successful save. */
export interface RollSave {
  /** Saving throw attribute: `"STR"` / `"DEX"` / `"WIS"` / … */
  ability: string;
  /** DC expression — literal or formula (`"8 + {{PB}} + {{WIS_MOD}}"`). */
  dc?: string;
  /** Outcome on a successful save — free text (`"half damage"` / `"no effect"`). */
  on_success?: string;
}

/** One entry in the Effects-cell pill list. Either a predefined key the
 *  consumer maps to a glyph (see the system's rolls block for the
 *  vocabulary — e.g. `"prone"` → ⤵), or a custom object declaring the
 *  glyph directly for one-offs that the vocabulary doesn't cover. */
export type RollEffect = string | { icon: string; label?: string };

/** Subset of `RollAspect` fields that any variant mechanism (leveled /
 *  upcast / swapOn) is allowed to override. `form` and the variant
 *  fields themselves are intentionally excluded — a leveled override
 *  cannot change a spell into a melee attack, nor nest its own leveled
 *  map. Values on the override replace the base field wholesale
 *  (shallow merge); partial edits of `damage` / `save` / `effects`
 *  must restate the full sub-structure. */
export type RollOverride = Partial<
  Pick<RollAspect, "name" | "damage" | "to_hit" | "range" | "save" | "effects" | "notes">
>;

/** Automatic scaling by character or class level. Thresholds are
 *  authored as `{ N: override, M: override, ... }`; at runtime the
 *  block picks the entry with the highest key ≤ the current level and
 *  merges it onto the base roll. Entries BELOW the current level are
 *  the progression ladder — the base roll itself serves as the level-1
 *  default, so authors don't need to repeat it under key `1`. */
export interface RollLeveled {
  /** Which level dimension drives scaling.
   *    - `"class"`     → use the feature's source level (e.g. Ranger lv
   *                     for a Ranger class feature). Default for
   *                     `rpg feature.details` rolls.
   *    - `"character"` → use the total character level across all
   *                     classes. Default for `rpg spell` rolls
   *                     (cantrip scaling in 5e is per character level). */
  by?: "class" | "character";
  /** Threshold → override. Keys are level numbers. */
  at: Record<number, RollOverride>;
}

/** Upcast overrides on a leveled spell. Keys are the spell circle the
 *  caster would spend a slot for (≥ the spell's base `circle`); values
 *  are partial overrides merged onto the base roll when that circle is
 *  picked. Interactive — the rolls block turns the form icon into a
 *  button that cycles the caster's chosen circle. */
export type RollUpcast = Record<number, RollOverride>;

/** One option in a `swapOn` selector. `value` is both the displayed
 *  text in the target cell (range / name) and the default for that
 *  field when this option is active. Remaining fields override the
 *  base roll. */
export interface RollSwapOption extends RollOverride {
  value: string;
}

/** User-interactive alternates attached to a single cell. The target
 *  cell becomes a clickable button; clicking cycles to the next option
 *  and rewrites the roll with that option's overrides. Example: a
 *  spell whose range cycles 30 / 60 / 120 ft with different damage. */
export interface RollSwap {
  /** Which cell hosts the selector. Constrained to cells that render a
   *  single scalar value. */
  field: "range" | "name";
  options: RollSwapOption[];
}

/** Resource cost for this roll — hit dice spent, Channel Divinity uses,
 *  Wild Shape uses, class-specific pools like Ki / Sorcery Points, etc.
 *  Rendered in the `Cost` column as "{amount} {glyph}" with a tooltip
 *  naming the resource. When `max` > `amount`, the cell becomes a
 *  click-to-cycle button so the player can dial in how much they want
 *  to spend before rolling. Actual resource-pool state is tracked
 *  elsewhere (features `resource:` / health `hit_dice`); this column
 *  is display + selection only. */
export interface RollCost {
  /** Resource key looked up in the consumer's cost vocabulary
   *  (hit-dice, channel-divinity, wild-shape, mystic-mark, rage, …).
   *  Unknown keys fall back to rendering the string as the glyph. */
  type: string;
  /** Default quantity rendered in the cell — `1` for fixed-cost
   *  features, the user's current pick for variable-cost ones. */
  amount: number;
  /** Upper bound for variable-cost features. Either a literal number
   *  or a formula string evaluated from the character's context:
   *    - `"PB"`          — proficiency bonus
   *    - `"level"`       — total character level
   *    - `"class_level"` — feature's source class level (falls back
   *                        to character level for non-feature rows)
   *  When the resolved max is greater than `amount`, the cost cell
   *  renders as a button cycling 1..max. When omitted, equal to
   *  `amount`, or unresolvable, the cell is a non-interactive label. */
  max?: number | string;
}

/**
 * Full roll aspect. `form` is the only required field because it drives
 * both to-hit derivation and how the row renders:
 *   - `melee` / `ranged` / `spell` — to-hit derived from stats.
 *   - `save`   — no to-hit; DC column shows the save ability + DC.
 *   - `rider`  — damage piggyback (no to-hit, no DC).
 *   - `healing` / `temp` — beneficial dice; no to-hit, no DC.
 */
export interface RollAspect {
  /** Display name for this roll. Falls back to the parent feature /
   *  spell / item name when omitted. */
  name?: string;
  /** `melee` / `ranged` use weapon-style to-hit (PB + STR or DEX mod +
   *  magic bonus). `spell` uses PB + spellcasting ability mod. `save`
   *  targets a saving throw instead. `rider` is a damage piggyback on
   *  another roll (Mystic Mark, Hex, Divine Smite). `healing` restores
   *  HP; `temp` grants temporary HP. */
  form: "melee" | "ranged" | "spell" | "save" | "rider" | "healing" | "temp";
  /** Spell circle this roll is tied to. `0` = cantrip; `1`..`9` =
   *  leveled spells. When set on `form: spell`, the rolls block
   *  renders the form icon as a circled numeral (⓪ ① ② …) instead of
   *  the generic ✨, and — when `upcast` is also declared — turns the
   *  icon into an upcast selector button. */
  circle?: number;
  /** One or more damage / healing dice instances. Most rolls have one;
   *  magic items can stack (`1d8 slashing + 1d6 fire`). Healing rolls
   *  reuse this field with a semantic `type: "healing"`. */
  damage?: DamageSpec | DamageSpec[];
  /** Override the derived to-hit expression. When omitted for melee /
   *  ranged / spell forms, the consumer derives it from `form` + stats. */
  to_hit?: string;
  /** Reach / normal range / long range — free text. */
  range?: string;
  /** Save-based rolls only: DC + outcome on success. */
  save?: RollSave;
  /** Equipment requirement for this roll to be available:
   *    - `none`       → always available (spells, mental abilities,
   *                     healing / temp-HP buffs).
   *    - `one_hand`   → the source weapon must occupy at least one hand
   *                     slot (main_hand or off_hand).
   *    - `two_hands`  → the source weapon must occupy main_hand AND the
   *                     off_hand must be empty (or also hold the weapon).
   *    - `free_hand`  → at least one hand must be empty (unarmed
   *                     attacks like Claws, Monk martial arts).
   *  Omitted → inferred by the consumer (melee/ranged weapons default to
   *  `one_hand`; spell/save/healing/temp forms default to `none`). */
  requires?: "none" | "one_hand" | "two_hands" | "free_hand";
  /** Explicit pill-list for the Effects cell. Each entry is a predefined
   *  condition key ("prone", "poisoned", …) or a custom glyph object.
   *  Authors opt in per roll — nothing is inferred from `notes`. */
  effects?: RollEffect[];
  /** Free-text notes shown on row-hover in the Effects cell. Rendered
   *  verbatim, italic; nothing parsed out of it. */
  notes?: string;
  /** Automatic per-level scaling (cantrip progression, class-feature
   *  dice growth like Mystic Mark d4 → d10). Resolved at row-build
   *  time, no UI affordance. */
  leveled?: RollLeveled;
  /** User-selectable upcast overrides. Interactive — the form icon
   *  cycles the chosen circle. */
  upcast?: RollUpcast;
  /** User-selectable cell-attached alternates (e.g. a spell whose
   *  range cycles between discrete options, each carrying its own
   *  damage). Interactive — the specified cell cycles on click. */
  swapOn?: RollSwap;
  /** Resource cost rendered in the `Cost` column — hit dice, Channel
   *  Divinity uses, Wild Shape uses, etc. Actual pool tracking lives
   *  elsewhere; this is display + player-picked amount. */
  cost?: RollCost;
}
