/**
 * `rpg sim run`: the party against the named monster groups, simulated many
 * times with a seeded generator, reported as one JSON document (the keys and
 * their order are the contract: the same inputs give the same bytes).
 */

import {
  addCr,
  formatDifficulty,
  labelEncounter,
  mulCr,
  parseCr,
  type Rational,
} from "lib/domains/encounter-sim/difficulty";
import { runMonteCarlo } from "lib/domains/encounter-sim/montecarlo";
import {
  ABILITY_KEYS,
  type AbilityKey,
  type CombatActor,
  type FidelityRecord,
  type ModelledAction,
} from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import type { SimHandler } from "./dispatch";
import { UsageError, type SimOptions } from "./flags";
import { loadMonster, type LoadedMonster } from "./monsters";
import { DEFAULT_PARTY, loadParty } from "./party";
import { fitByDifficulty, groupRef, noteRef, skippedByOwner } from "./brief";

interface AbilitySummary {
  score?: number;
  modifier: number;
  save: number;
}

/** One modelled action in short numeric form; the keys depend on its kind. */
type ActionSummary = Record<string, string | number | boolean>;

/** The expression and (when written) type of a damage roll. */
function damageOf(damage: { expr: string; type?: string }): Record<string, string> {
  return { damage: damage.expr, ...(damage.type ? { damageType: damage.type } : {}) };
}

/** A modelled action as its name, kind and the numbers that drive it, with its condition, use limit and area size. */
function summariseAction(action: ModelledAction): ActionSummary {
  const base = summariseBase(action);
  const extra: ActionSummary = {};
  if ("inflicts" in action && action.inflicts) {
    const { condition, save, lasts } = action.inflicts;
    extra.inflicts = `${condition} (${lasts}${save ? `, ${save.ability.toUpperCase()} ${save.dc}` : ""})`;
  }
  if ("limit" in action && action.limit?.recharge !== undefined) extra.recharge = action.limit.recharge;
  if ("limit" in action && action.limit?.perDay !== undefined) extra.perDay = action.limit.perDay;
  if (action.kind === "save" && action.targets !== undefined) extra.targets = action.targets;
  return { ...base, ...extra };
}

function summariseBase(action: ModelledAction): ActionSummary {
  switch (action.kind) {
    case "weapon":
      return { name: action.name, kind: action.kind, hitBonus: action.hitBonus, ...damageOf(action.damage) };
    case "multiattack":
      return {
        name: action.name,
        kind: action.kind,
        swings: action.swings.length,
        hitBonus: action.swings[0]?.hitBonus ?? 0,
        damage: action.swings.map((s) => s.damage.expr).join(" + "),
      };
    case "spell-attack":
      return {
        name: action.name,
        kind: action.kind,
        circle: action.circle,
        hitBonus: action.hitBonus,
        ...damageOf(action.damage),
      };
    case "save":
      return {
        name: action.name,
        kind: action.kind,
        circle: action.circle,
        dc: action.dc,
        ability: action.ability,
        ...damageOf(action.damage),
        onSuccess: action.onSuccess,
        area: action.area,
      };
    case "heal":
      return { name: action.name, kind: action.kind, circle: action.circle, heal: action.expr };
  }
}

function summariseAbilities(actor: CombatActor): Record<AbilityKey, AbilitySummary> {
  const out = {} as Record<AbilityKey, AbilitySummary>;
  for (const key of ABILITY_KEYS) {
    const stat = actor.abilities[key];
    out[key] = {
      ...(stat.score !== undefined ? { score: stat.score } : {}),
      modifier: stat.modifier,
      save: stat.saveModifier,
    };
  }
  return out;
}

function summariseParty(actor: CombatActor) {
  return {
    note: actor.key,
    name: actor.name,
    level: actor.level,
    proficiencyBonus: actor.proficiencyBonus,
    armorClass: actor.armorClass,
    maxHp: actor.maxHp,
    initiative: actor.initiativeModifier,
    abilities: summariseAbilities(actor),
    actions: actor.actions.map(summariseAction),
    ...(actor.riders?.length
      ? {
          riders: actor.riders.map(
            (r) => `${r.name}: +${r.damage} (${r.kind}${r.uses !== undefined ? `, ${r.uses} uses` : ""})`
          ),
        }
      : {}),
  };
}

function summariseGroup(monster: LoadedMonster, count: number) {
  const { actor } = monster;
  return {
    note: monster.note,
    name: monster.name,
    count,
    cr: monster.cr,
    ac: actor.armorClass,
    hp: actor.maxHp,
    speed: monster.speed,
    initiative: actor.initiativeModifier,
    abilities: summariseAbilities(actor),
    actions: actor.actions.map(summariseAction),
  };
}

/** A monster's CR as a rational, failing naming the note when it is not a number or a fraction. */
function crOf(monster: LoadedMonster): Rational {
  try {
    return parseCr(monster.cr);
  } catch (err) {
    throw new Error(`Monster "${monster.note}": ${(err as Error).message}`);
  }
}

async function loadGroups(ctx: Ctx, options: SimOptions): Promise<Array<{ monster: LoadedMonster; count: number }>> {
  const cache = new Map<string, LoadedMonster>();
  const groups: Array<{ monster: LoadedMonster; count: number }> = [];
  for (const { note, count } of options.monsters) {
    let monster = cache.get(note);
    if (!monster) {
      monster = await loadMonster(ctx, note);
      cache.set(note, monster);
    }
    groups.push({ monster, count });
  }
  return groups;
}

export const simRun: SimHandler = async (ctx, options) => {
  if (options.monsters.length === 0) {
    throw new UsageError('--monster is required: name at least one monster note ("Note" or "Note:3").');
  }

  // Monsters first: a misspelt monster note is reported without loading the whole party.
  const groups = await loadGroups(ctx, options);
  const refs = options.pc.length > 0 ? options.pc : DEFAULT_PARTY;
  const party = await loadParty(ctx, refs);
  if (party.actors.length === 0) {
    throw new UsageError("--pc: the party is empty; name at least one PC note.");
  }

  const summary = runMonteCarlo({
    party: party.actors,
    monsters: groups.map(({ monster, count }) => ({ actor: monster.actor, count })),
    seed: options.seed,
    trials: options.trials,
    roundCap: options.rounds,
  });

  let totalCr: Rational = { num: 0, den: 1 };
  for (const { monster, count } of groups) totalCr = addCr(totalCr, mulCr(crOf(monster), { num: count, den: 1 }));
  const difficulty = formatDifficulty(
    labelEncounter(
      party.actors.map((a) => a.level),
      totalCr
    )
  );

  const fidelity: Record<string, FidelityRecord[]> = { ...party.fidelity };
  for (const { monster } of groups) {
    if (!(monster.note in fidelity)) fidelity[monster.note] = monster.fidelity;
  }

  if (options.brief) {
    return {
      doc: {
        monsters: groups.map(({ monster, count }) => groupRef(ctx, monster.note, count)),
        party: party.actors.map((a) => a.name),
        seed: options.seed,
        trials: options.trials,
        winRate: summary.winRate,
        tpkRate: summary.tpkRate,
        stalemateRate: summary.stalemateRate,
        avgRounds: summary.avgRounds,
        avgHpLost: summary.avgHpLost,
        koRate: summary.koRate,
        difficulty,
        fit: fitByDifficulty(summary),
        skipped: skippedByOwner(fidelity, (owner) => (/\.md$/i.test(owner) ? noteRef(ctx, owner) : owner)),
      },
    };
  }

  return {
    doc: {
      party: party.actors.map(summariseParty),
      monsters: groups.map(({ monster, count }) => summariseGroup(monster, count)),
      seed: options.seed,
      trials: options.trials,
      roundCap: options.rounds,
      winRate: summary.winRate,
      tpkRate: summary.tpkRate,
      stalemateRate: summary.stalemateRate,
      avgRounds: summary.avgRounds,
      roundsPerTrial: summary.roundsPerTrial,
      hpRemainingPerTrial: summary.hpRemainingPerTrial,
      koRate: summary.koRate,
      difficulty,
      fidelity,
    },
  };
};
