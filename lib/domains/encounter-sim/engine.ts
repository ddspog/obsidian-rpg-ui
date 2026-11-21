import { averageOf, d20, rollExpr, type Rng } from "./rng";
import type {
  CombatActor,
  HealAction,
  ModelledAction,
  SaveAction,
  SpellAttackAction,
  TrialResult,
  WeaponAttackAction,
} from "./types";

/**
 * One combat, played to a result. The actors are never touched: every trial
 * copies their HP and slots into fresh state.
 *
 * RNG draws, in order (a fixed count wherever the count does not depend on the
 * dice themselves):
 *  1. Initiative: for each actor in the order given, one `d20` draw and then one
 *     tiebreak draw (`rng()` itself).
 *  2. Each turn, in initiative order, per action:
 *     - heal: the heal expression's dice (none for a flat expression);
 *     - weapon / spell attack, per swing: one `d20`; on a hit, the damage dice
 *       (doubled on a natural 20; none for a flat amount);
 *     - save: the damage dice once (rolled once per cast and applied to every
 *       target, halved per target that saves), then one `d20` per target, in
 *       initiative order (a non-area save has one target).
 */

interface Combatant {
  actor: CombatActor;
  hp: number;
  slots: number[];
}

/** A slotted action (circle above 0) is only available while a slot remains. */
function hasSlot(c: Combatant, circle: number): boolean {
  return circle <= 0 || (c.slots[circle - 1] ?? 0) > 0;
}

function spendSlot(c: Combatant, circle: number): void {
  if (circle > 0) c.slots[circle - 1] = (c.slots[circle - 1] ?? 0) - 1;
}

function isAvailable(c: Combatant, action: ModelledAction): boolean {
  switch (action.kind) {
    case "spell-attack":
    case "save":
    case "heal":
      return hasSlot(c, action.circle);
    default:
      return true;
  }
}

function circleOf(action: ModelledAction): number {
  return action.kind === "spell-attack" || action.kind === "save" || action.kind === "heal" ? action.circle : 0;
}

/** Average damage used to choose an action; accuracy and save outcomes are ignored. */
function valueOf(action: ModelledAction, livingEnemies: number): number {
  switch (action.kind) {
    case "weapon":
    case "spell-attack":
      return averageOf(action.damage.expr);
    case "multiattack":
      return action.swings.reduce((sum, swing) => sum + averageOf(swing.damage.expr), 0);
    case "save":
      return averageOf(action.damage.expr) * (action.area ? livingEnemies : 1);
    default:
      return 0;
  }
}

export function simulateTrial(actors: CombatActor[], rng: Rng, roundCap: number): TrialResult {
  // Fresh state: full HP, a copy of the slots.
  const state: Combatant[] = actors.map((actor) => ({
    actor,
    hp: actor.maxHp,
    slots: [...actor.slots],
  }));

  // Initiative: one d20 then one tiebreak draw per combatant, in actor order.
  const rolled = state.map((combatant, index) => {
    const d = d20(rng);
    const tiebreak = rng();
    return {
      combatant,
      index,
      total: d + combatant.actor.initiativeModifier,
      modifier: combatant.actor.initiativeModifier,
      tiebreak,
    };
  });
  rolled.sort((a, b) => b.total - a.total || b.modifier - a.modifier || a.tiebreak - b.tiebreak || a.index - b.index);
  const order = rolled.map((r) => r.combatant);

  const living = (c: Combatant) => c.hp > 0;
  const enemiesOf = (c: Combatant) => order.filter((o) => o.actor.side !== c.actor.side && living(o));
  const alliesOf = (c: Combatant) => order.filter((o) => o.actor.side === c.actor.side && living(o));

  /** The living enemy with the lowest current HP; ties go to initiative order. */
  const pickTarget = (c: Combatant): Combatant | undefined => {
    let best: Combatant | undefined;
    for (const enemy of enemiesOf(c)) {
      if (!best || enemy.hp < best.hp) best = enemy;
    }
    return best;
  };

  const damage = (target: Combatant, amount: number) => {
    target.hp = Math.max(0, target.hp - amount);
  };

  const monstersDown = () => order.every((c) => c.actor.side !== "monsters" || !living(c));
  const partyDown = () => order.every((c) => c.actor.side !== "party" || !living(c));

  /** d20 + bonus vs AC; a natural 20 always hits and doubles dice, a natural 1 always misses. */
  const swing = (attacker: Combatant, action: WeaponAttackAction | SpellAttackAction): boolean => {
    const target = pickTarget(attacker);
    if (!target) return false;
    const natural = d20(rng);
    const hit = natural === 20 || (natural !== 1 && natural + action.hitBonus >= target.actor.armorClass);
    if (!hit) return false;
    damage(target, rollExpr(action.damage.expr, natural === 20, rng));
    return true;
  };

  const castSave = (caster: Combatant, action: SaveAction): void => {
    const targets = action.area ? enemiesOf(caster) : [pickTarget(caster)].filter((t): t is Combatant => !!t);
    // Damage is rolled once per cast and applied to every target (halved per target that saves).
    const rolledDamage = rollExpr(action.damage.expr, false, rng);
    for (const target of targets) {
      const save = d20(rng) + target.actor.abilities[action.ability].saveModifier;
      const success = save >= action.dc;
      damage(target, success ? (action.onSuccess === "half" ? Math.floor(rolledDamage / 2) : 0) : rolledDamage);
    }
  };

  /** Resolve a damaging action. */
  const useDamaging = (c: Combatant, action: ModelledAction): void => {
    switch (action.kind) {
      case "weapon":
      case "spell-attack":
        swing(c, action);
        break;
      case "multiattack":
        // Each swing re-picks the lowest-HP living enemy (a swing with none left does nothing).
        for (const s of action.swings) swing(c, s);
        break;
      case "save":
        castSave(c, action);
        break;
      default:
        break;
    }
  };

  const healFor = (c: Combatant): HealAction | undefined => {
    const heal = c.actor.actions.find((a): a is HealAction => a.kind === "heal" && isAvailable(c, a));
    if (!heal) return undefined;
    return alliesOf(c).some((a) => 2 * a.hp < a.actor.maxHp) ? heal : undefined;
  };

  /** Take one action; true when it was a damaging one (win and TPK are checked after those). */
  const takeTurn = (c: Combatant): boolean => {
    const heal = healFor(c);
    if (heal) {
      let target: Combatant | undefined;
      let missing = -1;
      for (const ally of alliesOf(c)) {
        if (2 * ally.hp >= ally.actor.maxHp) continue;
        const gap = ally.actor.maxHp - ally.hp;
        if (gap > missing || (gap === missing && target && ally.hp < target.hp)) {
          target = ally;
          missing = gap;
        }
      }
      if (target) {
        target.hp = Math.min(target.actor.maxHp, target.hp + rollExpr(heal.expr, false, rng));
        spendSlot(c, circleOf(heal));
        return false;
      }
    }

    const livingEnemies = enemiesOf(c).length;
    let best: ModelledAction | undefined;
    let bestValue = -Infinity;
    for (const action of c.actor.actions) {
      if (action.kind === "heal" || !isAvailable(c, action)) continue;
      const value = valueOf(action, livingEnemies);
      if (value > bestValue) {
        best = action;
        bestValue = value;
      }
    }
    if (!best) return false; // nothing damaging or healing: pass
    spendSlot(c, circleOf(best));
    useDamaging(c, best);
    return true;
  };

  const result = (outcome: TrialResult["outcome"], rounds: number): TrialResult => ({
    outcome,
    rounds,
    partyHpRemaining: state.reduce((sum, c) => sum + (c.actor.side === "party" ? c.hp : 0), 0),
    knockedOut: state.filter((c) => c.actor.side === "party" && !living(c)).map((c) => c.actor.name),
  });

  for (let round = 1; round <= roundCap; round++) {
    for (const c of order) {
      if (!living(c)) continue;
      if (!takeTurn(c)) continue;
      if (monstersDown()) return result("win", round);
      if (partyDown()) return result("tpk", round);
    }
  }
  return result("stalemate", roundCap);
}
