/**
 * A short, deterministic digest of a party configuration: everything the
 * simulator reads of the PCs. When it changes, the fit of every catalog entry is
 * out of date. Pure TypeScript (no node:crypto), so it runs in Obsidian too.
 */

import { ABILITY_KEYS, type AbilityKey, type CombatActor, type TrialRules } from "../encounter-sim/types";

/** JSON with every object's keys sorted and undefined left out, so insertion order never matters. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`);
  return `{${parts.join(",")}}`;
}

/** FNV-1a (32 bit) over the string's UTF-16 units, two bytes each, from the given offset basis. */
function fnv1a32(text: string, basis: number, reverse: boolean): number {
  let hash = basis >>> 0;
  const n = text.length;
  for (let i = 0; i < n; i += 1) {
    const unit = text.charCodeAt(reverse ? n - 1 - i : i);
    hash ^= unit & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= unit >>> 8;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const hex8 = (n: number): string => n.toString(16).padStart(8, "0");

/** The 16-hex-digit stamp of a canonical string: two FNV-1a lanes with different bases and directions. */
function digest(text: string): string {
  return hex8(fnv1a32(text, 0x811c9dc5, false)) + hex8(fnv1a32(text, 0x9747b28c, true));
}

/**
 * What the stamp reads of an actor: every field that decides a fight, so a
 * changed rider, defence, reaction or movement speed re-checks the catalog.
 * Left out: `key` (a note path or instance id) and `side`, which the engine
 * does not play, and of an ability the raw score (only modifiers are rolled).
 * The `-?` mapped type makes the literal below name every other field of
 * CombatActor, so a new one fails the type check until it is stamped here or
 * consciously added to the exclusion.
 */
type StampedActor = {
  [K in Exclude<keyof CombatActor, "key" | "side" | "abilities">]-?: CombatActor[K];
} & {
  abilities: Array<{ key: AbilityKey; modifier: number | undefined; saveModifier: number | undefined }>;
};

/**
 * The stamp of a party: its actors in order, each with everything the
 * simulator reads of it, plus the rules the trials ran by. Fields an actor
 * does not carry vanish in `canonical`, so a plain party keeps its old stamp.
 */
export function partyStamp(actors: CombatActor[], rules?: TrialRules): string {
  const shape: StampedActor[] = actors.map((actor) => ({
    name: actor.name,
    level: actor.level,
    proficiencyBonus: actor.proficiencyBonus,
    armorClass: actor.armorClass,
    maxHp: actor.maxHp,
    initiativeModifier: actor.initiativeModifier,
    abilities: ABILITY_KEYS.map((key) => ({
      key,
      modifier: actor.abilities[key]?.modifier,
      saveModifier: actor.abilities[key]?.saveModifier,
    })),
    slots: actor.slots,
    actions: actor.actions,
    riders: actor.riders,
    defences: actor.defences,
    reaction: actor.reaction,
    legendaryResistance: actor.legendaryResistance,
    legendary: actor.legendary,
    speed: actor.speed,
    fly: actor.fly,
    flyby: actor.flyby,
    bonusMoves: actor.bonusMoves,
    bonusActions: actor.bonusActions,
    stealth: actor.stealth,
    passivePerception: actor.passivePerception,
    lair: actor.lair,
    reactions: actor.reactions,
  }));
  // The rules a fit was simulated by (space, a lair): another --distance or --lair is another fit. None given, the
  // stamp is the party's alone, as it was before the rules.
  return digest(canonical(rules && Object.keys(rules).length ? { party: shape, rules } : shape));
}
