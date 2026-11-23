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

/** The conditions the engine plays: what they do to attacks and turns (see engine.ts). */
export const MODELLED_CONDITIONS = [
  "blinded",
  "prone",
  "restrained",
  "poisoned",
  "frightened",
  "stunned",
  "paralyzed",
  "incapacitated",
] as const;
export type ModelledCondition = (typeof MODELLED_CONDITIONS)[number];

/**
 * A condition an action puts on its target: on a hit (or a failed save of the action itself), unless it
 * gives a save of its own. It lasts until the start of the target's next turn ("start": prone, it stands),
 * the end of its next turn ("end"), or the fight ("fight": a save at the end of each of its turns ends it,
 * when it has one).
 */
export interface Inflict {
  condition: ModelledCondition;
  save?: { ability: AbilityKey; dc: number };
  lasts: "start" | "end" | "fight";
}

/**
 * Extra damage a PC's feature adds to its hits: "mark" (Mystic Mark: a use marks the target, and every hit
 * on a marked target deals it), else once a turn on the first hit (a Sneak Attack). `uses` absent: no limit.
 */
export interface DamageRider {
  name: string;
  damage: string;
  kind: "mark" | "once-a-turn";
  uses?: number;
}

/**
 * What a creature shrugs off: damage types it is resistant, immune or vulnerable to ("nonmagical" for
 * bludgeoning, piercing and slashing from weapons), and the conditions it is immune or resistant to
 * (resistant: advantage on the save against it). See defences.ts.
 */
export interface Defences {
  resistant: string[];
  immune: string[];
  vulnerable: string[];
  conditionImmune: string[];
  conditionResistant: string[];
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
  inflicts?: Inflict;
  /** Where it reaches (see `Reach`); absent: anywhere. */
  reach?: Reach;
  /** Shots it has (a bow's arrows, from the sheet's inventory); absent: as many as it needs. */
  ammo?: number;
}

/**
 * Where an action reaches, once the fight has positions (`TrialRules.distance`): a melee action a target
 * within `melee` feet, a ranged one within `range` feet (a self-centred area: its size). Absent: anywhere.
 */
export interface Reach {
  melee?: number;
  range?: number;
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
  inflicts?: Inflict;
  reach?: Reach;
  /** A concentration spell: what it leaves on its targets ends with the caster's concentration. */
  concentration?: boolean;
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
  inflicts?: Inflict;
  reach?: Reach;
  concentration?: boolean;
}

/** A healing option; `expr` is the full roll including the casting modifier. */
export interface HealAction {
  kind: "heal";
  name: string;
  expr: string;
  circle: number;
  /** Cast as a bonus action (Healing Word): it comes on top of the turn's action. */
  bonus?: boolean;
}

/**
 * A buff or a debuff for the fight: a die added to (or, signed "-1d4", taken from) attack rolls and saves, or a
 * bonus to AC, on up to `targets` allies (Bless, Shield of Faith) or enemies (Bane, which a save keeps off).
 */
export interface BuffAction {
  kind: "buff";
  name: string;
  circle: number;
  on: "allies" | "enemies";
  targets: number;
  attackDie?: string;
  saveDie?: string;
  ac?: number;
  /** The save an enemy makes to keep it off. */
  save?: { ability: AbilityKey; dc: number };
  concentration?: boolean;
}

export type ModelledAction =
  | WeaponAttackAction
  | MultiattackAction
  | SpellAttackAction
  | SaveAction
  | HealAction
  | BuffAction;

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
  /** Extra damage its features add to its hits (PCs). */
  riders?: DamageRider[];
  /** Its resistances, immunities and vulnerabilities. */
  defences?: Defences;
  /**
   * A reaction that raises its AC against a hit (Parry: "adds 2 to its AC against one melee attack that would
   * hit it"; the Shield spell: +5 until the start of its next turn, a slot of its circle), once a round.
   */
  reaction?: { name: string; ac: number; untilTurn: boolean; circle: number };
  /** Legendary Resistance: failed saves it turns into successes, a day. */
  legendaryResistance?: number;
  /** Legendary actions: the points it has a round (3) and what each costs. */
  legendary?: { points: number; actions: Array<{ action: ModelledAction; cost: number }> };
  /** Its walking speed and flying speed, in feet (with positions; absent: 30 and none). */
  speed?: number;
  fly?: number;
  /** It leaves an enemy's reach without an opportunity attack (Flyby). */
  flyby?: boolean;
  /** What its bonus action can do besides a bonus heal (Cunning Action, Nimble Escape). */
  bonusMoves?: BonusMove[];
  /** Attacks and other actions its bonus action takes (a monster's "Bonus Actions"). */
  bonusActions?: ModelledAction[];
  /** Its Stealth modifier and passive Perception, for hiding and finding the hidden. */
  stealth?: number;
  passivePerception?: number;
  /** Its lair's actions, used on initiative 20 when the fight is in its lair (`TrialRules.lair`). */
  lair?: ModelledAction[];
}

export type BonusMove = "disengage" | "hide" | "dash";

/**
 * The rules a trial is played by, beyond the dice. Each is off when absent, which is the abstract fight the
 * engine played first (everyone in reach, a PC at 0 HP out).
 */
export interface TrialRules {
  /**
   * Positions: the sides start this many feet apart on a line (creatures that would rather act at range stand
   * 10 feet further back), melee needs its reach and a creature moves its speed, a ranged attack with an enemy
   * within 5 feet has disadvantage or steps back and draws opportunity attacks, a flier acting at range stays
   * aloft out of reach of those that cannot fly.
   */
  distance?: number;
  /** PCs at 0 HP make death saves; damage while down is a failure; three failures and they die. */
  deathSaves?: boolean;
  /** The fight is in a lair: its owner's lair actions come on initiative 20. */
  lair?: boolean;
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
  /** Names of party members who died (three failed death saves), with `deathSaves`. */
  dead?: string[];
}

/** An action that deals damage (as opposed to a heal). */
export function isDamaging(action: ModelledAction): boolean {
  return action.kind !== "heal" && action.kind !== "buff";
}
