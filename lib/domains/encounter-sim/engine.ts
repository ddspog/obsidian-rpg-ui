import { averageOf, d20, rollExpr, type Rng } from "./rng";
import type {
  CombatActor,
  Inflict,
  ModelledCondition,
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
 *       initiative order (a non-area save has one target; an area as many as
 *       its size catches, the first living enemies in initiative order).
 *  3. At the start of a combatant's turn, one `d6` per action of its that is
 *     waiting to recharge, in action order (none for an actor with no
 *     "(Recharge …)" action, so their draws are as before).
 *  4. With advantage or disadvantage on an attack (conditions, below), a second
 *     `d20` right after the first.
 *  5. A condition with a save of its own: one `d20` when it would land, and one
 *     at the end of each of the target's turns while a fight-long one lasts.
 *  6. With `monsterFocus` below 1, a monster picking a target draws once (and
 *     once more for the random target); at 1 (the default) it draws nothing.
 *  7. A rider's damage dice, after its hit's.
 *
 * Conditions (types.ts `Inflict`): blinded, prone, restrained, poisoned and
 * frightened give the creature disadvantage on its attacks; blinded, prone,
 * restrained, stunned and paralyzed give attacks against it advantage; stunned,
 * paralyzed and incapacitated lose it its turns. Advantage and disadvantage
 * cancel.
 */

const DISADVANTAGED: ReadonlySet<ModelledCondition> = new Set([
  "blinded",
  "prone",
  "restrained",
  "poisoned",
  "frightened",
]);
const EXPOSED: ReadonlySet<ModelledCondition> = new Set(["blinded", "prone", "restrained", "stunned", "paralyzed"]);
const NO_TURN: ReadonlySet<ModelledCondition> = new Set(["stunned", "paralyzed", "incapacitated"]);

export interface TrialOptions {
  /**
   * The share of a monster's target picks that go to the party's most hurt member; the rest go to a living
   * PC at random. 1 (the default) is the old focus fire.
   */
  monsterFocus?: number;
}

interface Combatant {
  actor: CombatActor;
  hp: number;
  slots: number[];
  /** Actions used and waiting for their recharge roll. */
  spent: Set<ModelledAction>;
  /** Uses left of the "(N/Day)" actions. */
  usesLeft: Map<ModelledAction, number>;
  /** Conditions on it now, with how they end. */
  conditions: Map<ModelledCondition, Pick<Inflict, "lasts" | "save">>;
  /** Uses left of each rider (by index), and whom a "mark" rider marks. */
  riderUses: number[];
  marked: Array<Combatant | undefined>;
  /** A once-a-turn rider already dealt this turn. */
  riderDone: boolean;
}

const limitOf = (action: ModelledAction) =>
  action.kind === "weapon" || action.kind === "save" ? action.limit : undefined;

/** A slotted action (circle above 0) is only available while a slot remains. */
function hasSlot(c: Combatant, circle: number): boolean {
  return circle <= 0 || (c.slots[circle - 1] ?? 0) > 0;
}

function spendSlot(c: Combatant, circle: number): void {
  if (circle > 0) c.slots[circle - 1] = (c.slots[circle - 1] ?? 0) - 1;
}

function isAvailable(c: Combatant, action: ModelledAction): boolean {
  if (c.spent.has(action)) return false;
  const perDay = limitOf(action)?.perDay;
  if (perDay !== undefined && (c.usesLeft.get(action) ?? perDay) <= 0) return false;
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
/** What a condition adds to an action's worth when choosing: a little, so that at equal damage the one that also hinders is taken. */
const INFLICT_VALUE = 2;

function valueOf(action: ModelledAction, livingEnemies: number): number {
  return damageValueOf(action, livingEnemies) + ("inflicts" in action && action.inflicts ? INFLICT_VALUE : 0);
}

function damageValueOf(action: ModelledAction, livingEnemies: number): number {
  switch (action.kind) {
    case "weapon":
    case "spell-attack":
      return averageOf(action.damage.expr);
    case "multiattack":
      return action.swings.reduce((sum, swing) => sum + averageOf(swing.damage.expr), 0);
    case "save":
      return (
        averageOf(action.damage.expr) * (action.area ? Math.min(action.targets ?? livingEnemies, livingEnemies) : 1)
      );
    default:
      return 0;
  }
}

export function simulateTrial(
  actors: CombatActor[],
  rng: Rng,
  roundCap: number,
  options: TrialOptions = {}
): TrialResult {
  const focus = options.monsterFocus ?? 1;
  // Fresh state: full HP, a copy of the slots.
  const state: Combatant[] = actors.map((actor) => ({
    actor,
    hp: actor.maxHp,
    slots: [...actor.slots],
    spent: new Set<ModelledAction>(),
    usesLeft: new Map<ModelledAction, number>(),
    conditions: new Map(),
    riderUses: (actor.riders ?? []).map((r) => r.uses ?? Infinity),
    marked: (actor.riders ?? []).map(() => undefined),
    riderDone: false,
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

  /**
   * The living enemy with the lowest current HP (ties go to initiative order). A monster does so for a
   * `monsterFocus` share of its picks; otherwise it takes a living PC at random.
   */
  const pickTarget = (c: Combatant): Combatant | undefined => {
    const enemies = enemiesOf(c);
    if (c.actor.side === "monsters" && focus < 1 && enemies.length > 1 && rng() >= focus) {
      return enemies[Math.min(enemies.length - 1, Math.floor(rng() * enemies.length))];
    }
    let best: Combatant | undefined;
    for (const enemy of enemies) {
      if (!best || enemy.hp < best.hp) best = enemy;
    }
    return best;
  };

  const has = (c: Combatant, set: ReadonlySet<ModelledCondition>) => [...c.conditions.keys()].some((k) => set.has(k));

  /** A condition lands, unless the target makes the save it gives. */
  const inflict = (target: Combatant, how: Inflict | undefined): void => {
    if (!how || !living(target)) return;
    if (how.save && d20(rng) + target.actor.abilities[how.save.ability].saveModifier >= how.save.dc) return;
    target.conditions.set(how.condition, { lasts: how.lasts, ...(how.save ? { save: how.save } : {}) });
  };

  /** A feature's extra damage on a hit: a mark (a use marks the target) or once a turn. */
  const riderDamage = (attacker: Combatant, target: Combatant, crit: boolean): number => {
    let total = 0;
    (attacker.actor.riders ?? []).forEach((rider, i) => {
      if (rider.kind === "mark") {
        if (attacker.marked[i] !== target || !living(attacker.marked[i]!)) {
          if (attacker.riderUses[i] <= 0) return;
          attacker.riderUses[i] -= 1;
          attacker.marked[i] = target;
        }
        total += rollExpr(rider.damage, crit, rng);
      } else if (!attacker.riderDone && attacker.riderUses[i] > 0) {
        attacker.riderUses[i] -= 1;
        attacker.riderDone = true;
        total += rollExpr(rider.damage, crit, rng);
      }
    });
    return total;
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
    const advantage = has(target, EXPOSED);
    const disadvantage = has(attacker, DISADVANTAGED);
    let natural = d20(rng);
    if (advantage !== disadvantage) {
      const second = d20(rng);
      natural = advantage ? Math.max(natural, second) : Math.min(natural, second);
    }
    const hit = natural === 20 || (natural !== 1 && natural + action.hitBonus >= target.actor.armorClass);
    if (!hit) return false;
    const crit = natural === 20;
    damage(target, rollExpr(action.damage.expr, crit, rng) + riderDamage(attacker, target, crit));
    inflict(target, action.inflicts);
    return true;
  };

  const castSave = (caster: Combatant, action: SaveAction): void => {
    const targets = action.area
      ? enemiesOf(caster).slice(0, action.targets ?? Infinity)
      : [pickTarget(caster)].filter((t): t is Combatant => !!t);
    // Damage is rolled once per cast and applied to every target (halved per target that saves).
    const rolledDamage = rollExpr(action.damage.expr, false, rng);
    for (const target of targets) {
      const save = d20(rng) + target.actor.abilities[action.ability].saveModifier;
      const success = save >= action.dc;
      damage(target, success ? (action.onSuccess === "half" ? Math.floor(rolledDamage / 2) : 0) : rolledDamage);
      // The action's own save decides its condition: it lands on a failure.
      // A fight-long one is saved against each turn with its own save, else the action's.
      if (!success && action.inflicts && living(target)) {
        const { condition, lasts } = action.inflicts;
        const again = action.inflicts.save ?? { ability: action.ability, dc: action.dc };
        target.conditions.set(condition, { lasts, ...(lasts === "fight" ? { save: again } : {}) });
      }
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
    // Recharge rolls first: a d6 for each spent action, back on its number or more.
    for (const action of c.actor.actions) {
      if (!c.spent.has(action)) continue;
      if (Math.floor(rng() * 6) + 1 >= (limitOf(action)?.recharge ?? 7)) c.spent.delete(action);
    }
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
    const limit = limitOf(best);
    if (limit?.recharge !== undefined) c.spent.add(best);
    if (limit?.perDay !== undefined) c.usesLeft.set(best, (c.usesLeft.get(best) ?? limit.perDay) - 1);
    useDamaging(c, best);
    return true;
  };

  const result = (outcome: TrialResult["outcome"], rounds: number): TrialResult => ({
    outcome,
    rounds,
    partyHpRemaining: state.reduce((sum, c) => sum + (c.actor.side === "party" ? c.hp : 0), 0),
    knockedOut: state.filter((c) => c.actor.side === "party" && !living(c)).map((c) => c.actor.name),
  });

  /** Its turn begins: what lasts to its turn's start ends; true when a condition takes its turn. */
  const startTurn = (c: Combatant): boolean => {
    c.riderDone = false;
    for (const [k, v] of c.conditions) if (v.lasts === "start") c.conditions.delete(k);
    return has(c, NO_TURN);
  };
  /** Its turn ends: what lasts to its end ends, and it saves against what lasts the fight. */
  const endTurn = (c: Combatant): void => {
    for (const [k, v] of c.conditions) {
      if (v.lasts === "end") c.conditions.delete(k);
      else if (v.lasts === "fight" && v.save) {
        if (d20(rng) + c.actor.abilities[v.save.ability].saveModifier >= v.save.dc) c.conditions.delete(k);
      }
    }
  };

  for (let round = 1; round <= roundCap; round++) {
    for (const c of order) {
      if (!living(c)) continue;
      const lost = startTurn(c);
      const acted = !lost && takeTurn(c);
      endTurn(c);
      if (!acted) continue;
      if (monstersDown()) return result("win", round);
      if (partyDown()) return result("tpk", round);
    }
  }
  return result("stalemate", roundCap);
}
