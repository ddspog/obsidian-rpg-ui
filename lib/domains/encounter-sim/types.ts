/**
 * Shapes of the encounter simulator: combatants, the actions the engine can
 * model, the fidelity records that say what was and was not modelled, and what
 * one trial reports. Pure data, no Obsidian and no I/O.
 */

/** The 3-letter ability keys a combatant carries. */
export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AbilityKey = (typeof ABILITY_KEYS)[number];

export interface AbilityStat {
  score?: number;
  modifier: number;
  saveModifier: number;
}

/** A damage roll: a dice expression (or a plain flat number) and its type. */
export interface DamageSpec {
  expr: string;
  type?: string;
}

/** How often a monster's action comes round: "(Recharge 5-6)" (back on a d6 of `recharge` or more at the start of its turn) or "(2/Day)". */
export interface UseLimit {
  recharge?: number;
  perDay?: number;
}

/** One weapon attack: `+hitBonus` against AC, then `damage`. */
export interface WeaponAttackAction {
  kind: "weapon";
  name: string;
  hitBonus: number;
  damage: DamageSpec;
  limit?: UseLimit;
}

/** A multiattack: several weapon swings taken as one action. */
export interface MultiattackAction {
  kind: "multiattack";
  name: string;
  swings: WeaponAttackAction[];
}

/** A spell attack roll. `circle` 0 is a costless cantrip. */
export interface SpellAttackAction {
  kind: "spell-attack";
  name: string;
  hitBonus: number;
  damage: DamageSpec;
  circle: number;
}

/** A save-based effect, area or single-target. */
export interface SaveAction {
  kind: "save";
  name: string;
  dc: number;
  ability: AbilityKey;
  damage: DamageSpec;
  onSuccess: "half" | "none";
  area: boolean;
  /**
   * How many creatures an area catches, from its size by the usual table (a cone: its length / 10; a cube
   * or square: its side / 5; a sphere, cylinder or radius: its radius / 5; a line: its length / 30; rounded
   * up). Absent: every living enemy.
   */
  targets?: number;
  circle: number;
  limit?: UseLimit;
}

/** A healing option; `expr` is the full roll including the casting modifier. */
export interface HealAction {
  kind: "heal";
  name: string;
  expr: string;
  circle: number;
}

export type ModelledAction = WeaponAttackAction | MultiattackAction | SpellAttackAction | SaveAction | HealAction;

export type CombatSide = "party" | "monsters";

export interface CombatActor {
  key: string;
  name: string;
  side: CombatSide;
  level: number;
  proficiencyBonus: number;
  armorClass: number;
  maxHp: number;
  initiativeModifier: number;
  abilities: Record<AbilityKey, AbilityStat>;
  /** Slots per circle; index 0 is the first circle. */
  slots: number[];
  /** In fixed order: weapon attacks, slotted spells, cantrips (PCs); feature order (monsters). */
  actions: ModelledAction[];
}

export const SKIP_REASONS = [
  "monster-spellcasting",
  "control-spell",
  "buff",
  "utility-spell",
  "unsupported-feature",
  "no-damaging-action",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export interface FidelityRecord {
  name: string;
  owner: string;
  status: "modelled" | "skipped";
  reason?: SkipReason;
}

export type TrialOutcome = "win" | "tpk" | "stalemate";

export interface TrialResult {
  outcome: TrialOutcome;
  rounds: number;
  /** Sum of living party HP at trial end. */
  partyHpRemaining: number;
  /** Names of party members at 0 HP at trial end. */
  knockedOut: string[];
}

/** An action that deals damage (as opposed to a heal). */
export function isDamaging(action: ModelledAction): boolean {
  return action.kind !== "heal";
}
