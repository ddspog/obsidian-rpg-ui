import { applyDefences, immuneTo } from "./defences";
import { averageOf, d20, rollExpr, type Rng } from "./rng";
import type {
  BuffAction,
  BonusMove,
  CombatActor,
  Inflict,
  ModelledCondition,
  HealAction,
  ModelledAction,
  SaveAction,
  SpellAttackAction,
  TrialResult,
  TrialRules,
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
 *  8. A concentrating creature that takes damage: one `d20` (its CON save), after the damage.
 *  9. With `rules.deathSaves`, a PC at 0 HP: one `d20` at the start of its turn; a PC who stabilises an
 *     ally about to die (two failures, no heal at hand): one `d20` (Medicine, WIS) as its action.
 * 10. A creature that hides (a bonus action): one `d20` for its Stealth.
 *
 * The rules (`TrialRules`) and the actor data that turn on the rest (positions, opportunity attacks, flight,
 * bonus moves and bonus actions, lair actions, ammunition, concentration, death saves) are off when absent,
 * and with them off the draws are the ones above, in the same order.
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
  /** The rules beyond the dice (types.ts `TrialRules`); none when absent. */
  rules?: TrialRules;
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
  /** Buffs and debuffs on it, by the spell's name: dice to its attacks and saves, a bonus to its AC. */
  buffs: Map<string, Pick<BuffAction, "attackDie" | "saveDie" | "ac">>;
  /** Legendary action points left this round. */
  legendaryLeft: number;
  /** Its reaction is spent until its next turn. */
  reactionUsed: boolean;
  /** Legendary Resistance uses left. */
  lrLeft: number;
  /** Where it stands on the line (with positions), and whether it is aloft (a flier acting at range). */
  x: number;
  aloft: boolean;
  /** Hidden (a bonus-action Hide): its next attack has advantage. */
  hidden: boolean;
  /** Its bonus action is spent this turn. */
  bonusUsed: boolean;
  /** It took the Disengage action this turn: leaving reach draws no opportunity attack. */
  disengaged: boolean;
  /** Shots left of the actions that have ammunition. */
  ammoLeft: Map<ModelledAction, number>;
  /** What its concentration holds up: each undoes one effect. */
  concentration?: Array<() => void>;
  /** Death saves (a PC at 0 HP, with `rules.deathSaves`). */
  deathFails: number;
  deathSuccesses: number;
  dead: boolean;
  /** The lair action it took last round (not taken two rounds running). */
  lastLair?: ModelledAction;
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

/** The buff an AC reaction that lasts to its next turn leaves (the Shield spell). */
const REACTION_BUFF = "\u0000reaction";

/** A buff's worth when choosing, a target: about what a d4 on every roll or +2 AC saves or adds in a fight. */
const BUFF_WORTH = 3;

function isAvailable(c: Combatant, action: ModelledAction): boolean {
  if (c.spent.has(action)) return false;
  if ((c.ammoLeft.get(action) ?? 1) <= 0) return false;
  const perDay = limitOf(action)?.perDay;
  if (perDay !== undefined && (c.usesLeft.get(action) ?? perDay) <= 0) return false;
  switch (action.kind) {
    case "spell-attack":
    case "save":
    case "heal":
    case "buff":
      return hasSlot(c, action.circle);
    default:
      return true;
  }
}

function circleOf(action: ModelledAction): number {
  return action.kind === "spell-attack" || action.kind === "save" || action.kind === "heal" || action.kind === "buff"
    ? action.circle
    : 0;
}

/** Average damage used to choose an action; accuracy and save outcomes are ignored. */
/**
 * What a condition is worth when choosing an action, in points of damage a target, before the chance it lands
 * (taken as one half): a lost turn most, then advantage against it and disadvantage on its attacks. Tunable
 * heuristics, like the fit's profiles.
 */
const CONDITION_WORTH: Record<ModelledCondition, number> = {
  stunned: 10,
  paralyzed: 10,
  incapacitated: 8,
  restrained: 5,
  blinded: 5,
  prone: 3,
  poisoned: 3,
  frightened: 3,
};

function valueOf(action: ModelledAction, livingEnemies: number): number {
  const damage = damageValueOf(action, livingEnemies);
  if (!("inflicts" in action) || !action.inflicts) return damage;
  const targets = action.kind === "save" && action.area ? Math.min(action.targets ?? livingEnemies, livingEnemies) : 1;
  return damage + 0.5 * CONDITION_WORTH[action.inflicts.condition] * targets;
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

/** The weapon swings an action makes (none for a save, heal or buff). */
function swingsOf(action: ModelledAction): Array<WeaponAttackAction | SpellAttackAction> {
  if (action.kind === "multiattack") return action.swings;
  return action.kind === "weapon" || action.kind === "spell-attack" ? [action] : [];
}

/** Reach, range and opportunity swing are read once per action and actor: a fight asks for them every turn. */
const reachCache = new WeakMap<ModelledAction, { melee: number | undefined; range: number | undefined }>();
function reachOf(action: ModelledAction) {
  let known = reachCache.get(action);
  if (!known) {
    known = { melee: computeMeleeReach(action), range: computeRange(action) };
    reachCache.set(action, known);
  }
  return known;
}
const meleeReach = (action: ModelledAction) => reachOf(action).melee;
const rangeOf = (action: ModelledAction) => reachOf(action).range;

/** The reach a melee action needs, in feet; undefined for one that acts at range (or anywhere). */
function computeMeleeReach(action: ModelledAction): number | undefined {
  const reach = swingsOf(action)
    .map((s) => s.reach?.melee)
    .filter((r): r is number => r !== undefined);
  return reach.length ? Math.min(...reach) : undefined;
}

/**
 * The range of an action that says it acts at range, in feet; undefined for a melee one, and for one whose reach
 * nothing says (it reaches anything, as in the abstract fight, with none of the costs of acting at range).
 */
function computeRange(action: ModelledAction): number | undefined {
  if (computeMeleeReach(action) !== undefined) return undefined;
  if (action.kind === "save" || action.kind === "weapon" || action.kind === "spell-attack") return action.reach?.range;
  if (action.kind === "multiattack") {
    const ranges = action.swings.map((s) => s.reach?.range).filter((r): r is number => r !== undefined);
    return ranges.length ? Math.min(...ranges) : undefined;
  }
  return undefined;
}

const isAttack = (action: ModelledAction) => swingsOf(action).length > 0;
const concentrates = (action: ModelledAction) =>
  (action.kind === "save" || action.kind === "buff" || action.kind === "spell-attack") && !!action.concentration;

const swingCache = new WeakMap<CombatActor, { swing: WeaponAttackAction | SpellAttackAction | undefined }>();
/** The opportunity attack a creature makes: its best melee swing. */
function opportunitySwing(actor: CombatActor): WeaponAttackAction | SpellAttackAction | undefined {
  let known = swingCache.get(actor);
  if (!known) {
    known = { swing: computeOpportunitySwing(actor) };
    swingCache.set(actor, known);
  }
  return known.swing;
}
function computeOpportunitySwing(actor: CombatActor): WeaponAttackAction | SpellAttackAction | undefined {
  let best: WeaponAttackAction | SpellAttackAction | undefined;
  for (const action of actor.actions) {
    for (const s of swingsOf(action)) {
      // A swing with a range only is no melee attack; one with no reach at all reaches anything.
      if (s.reach && s.reach.melee === undefined) continue;
      if (!best || averageOf(s.damage.expr) > averageOf(best.damage.expr)) best = s;
    }
  }
  return best;
}

const EMPTY_AMMO: ReadonlyMap<ModelledAction, number> = new Map();
/** Its actions that spend ammunition and how many shots each has: a fresh map a trial only for those that do. */
function ammoOf(actor: CombatActor): Map<ModelledAction, number> {
  const shots = actor.actions.filter((a) => a.kind === "weapon" && a.ammo !== undefined) as WeaponAttackAction[];
  return shots.length
    ? new Map(shots.map((a) => [a as ModelledAction, a.ammo!]))
    : (EMPTY_AMMO as Map<ModelledAction, number>);
}

const rangeCache = new WeakMap<CombatActor, boolean>();
/** Whether its best action (by average damage) acts at range: it stands back. */
function prefersRange(actor: CombatActor): boolean {
  let known = rangeCache.get(actor);
  if (known === undefined) {
    let best: ModelledAction | undefined;
    for (const a of actor.actions) if (!best || damageValueOf(a, 1) > damageValueOf(best, 1)) best = a;
    known = !!best && meleeReach(best) === undefined && rangeOf(best) !== undefined;
    rangeCache.set(actor, known);
  }
  return known;
}

const NONE: Combatant[] = [];

export function simulateTrial(
  actors: CombatActor[],
  rng: Rng,
  roundCap: number,
  options: TrialOptions = {}
): TrialResult {
  const focus = options.monsterFocus ?? 1;
  const rules = options.rules ?? {};
  const positions = rules.distance !== undefined;
  const distance = Math.max(0, rules.distance ?? 0);

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
    buffs: new Map(),
    legendaryLeft: actor.legendary?.points ?? 0,
    reactionUsed: false,
    lrLeft: actor.legendaryResistance ?? 0,
    x: 0,
    aloft: false,
    hidden: false,
    bonusUsed: false,
    disengaged: false,
    ammoLeft: ammoOf(actor),
    deathFails: 0,
    deathSuccesses: 0,
    dead: false,
  }));

  // Positions: the party at 0 facing the monsters at `distance`; who would rather act at range stands 10 back.
  if (positions) {
    for (const c of state) {
      const atRange = prefersRange(c.actor);
      const back = atRange ? 10 : 0;
      c.x = c.actor.side === "party" ? -back : distance + back;
      // A flier that would rather act at range starts aloft.
      c.aloft = atRange && !!c.actor.fly;
    }
  }

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
  const initiativeOf = rules.lair ? new Map(rolled.map((r) => [r.combatant, r.total])) : undefined;

  const living = (c: Combatant) => c.hp > 0;
  // The living of each side, in initiative order, rebuilt only when someone falls or gets up (`alive` changes).
  let alive = 0;
  const sides = new Map<string, { at: number; list: Combatant[] }>();
  const livingOn = (side: string): Combatant[] => {
    const known = sides.get(side);
    if (known && known.at === alive) return known.list;
    const list = order.filter((o) => o.actor.side === side && living(o));
    sides.set(side, { at: alive, list });
    return list;
  };
  const enemiesOf = (c: Combatant) => livingOn(c.actor.side === "party" ? "monsters" : "party");
  const alliesOf = (c: Combatant) => livingOn(c.actor.side);
  const has = (c: Combatant, set: ReadonlySet<ModelledCondition>) => {
    if (c.conditions.size === 0) return false;
    for (const k of c.conditions.keys()) if (set.has(k)) return true;
    return false;
  };

  // ---- Space -------------------------------------------------------------------------------------------
  const gap = (a: Combatant, b: Combatant) => Math.abs(a.x - b.x);
  const speedOf = (c: Combatant) => Math.max(c.actor.speed ?? 30, c.actor.fly ?? 0);
  /** Within `feet` of it on the ground: an aloft flier is out of a grounded creature's melee. */
  const near = (a: Combatant, b: Combatant, feet: number) =>
    gap(a, b) <= feet && (a.aloft === b.aloft || !!a.actor.fly);
  /** An enemy within 5 feet that can act: a ranged attack has disadvantage, and leaving draws its swing. */
  const engagedBy = (c: Combatant) =>
    positions ? enemiesOf(c).filter((e) => !has(e, NO_TURN) && near(e, c, 5) && near(c, e, 5)) : [];

  /** Where `c` stands to reach `t` with `reach` feet: on its own side of `t`. */
  const spotFor = (c: Combatant, t: Combatant, reach: number) => (c.x <= t.x ? t.x - reach : t.x + reach);
  /** Feet `c` must move to reach `t` with a melee `reach` (Infinity: it cannot, `t` being aloft out of reach). */
  const moveNeeded = (c: Combatant, t: Combatant, reach: number) => {
    if (t.aloft && !c.actor.fly) return Infinity;
    return Math.max(0, gap(c, t) - reach);
  };

  /** Opportunity attacks on `c` leaving the reach of enemies it was next to (unless it disengaged or flies by). */
  const provoke = (c: Combatant, before: Combatant[]) => {
    if (c.disengaged || c.actor.flyby) return;
    for (const e of before) {
      if (!living(e) || !living(c) || e.reactionUsed || has(e, NO_TURN)) continue;
      const swingWith = opportunitySwing(e.actor);
      const reach = swingWith?.reach?.melee ?? 5;
      if (!swingWith || near(e, c, reach)) continue;
      e.reactionUsed = true;
      swing(e, swingWith, c);
    }
  };
  /** Moves `c` to `x` (and up or down), drawing opportunity attacks from the enemies whose reach it leaves. */
  const moveTo = (c: Combatant, x: number, aloft = c.aloft) => {
    if (!positions || (x === c.x && aloft === c.aloft)) return;
    const before = enemiesOf(c).filter((e) => {
      const reach = opportunitySwing(e.actor)?.reach?.melee ?? 5;
      return near(e, c, reach);
    });
    c.x = x;
    c.aloft = aloft;
    provoke(c, before);
  };

  /**
   * The living enemy with the lowest current HP among those `ok` allows (ties go to initiative order). A monster
   * does so for a `monsterFocus` share of its picks; otherwise it takes one of them at random.
   */
  const pickTarget = (c: Combatant, ok: (t: Combatant) => boolean = () => true): Combatant | undefined => {
    const enemies = enemiesOf(c).filter(ok);
    if (c.actor.side === "monsters" && focus < 1 && enemies.length > 1 && rng() >= focus) {
      return enemies[Math.min(enemies.length - 1, Math.floor(rng() * enemies.length))];
    }
    let best: Combatant | undefined;
    for (const enemy of enemies) {
      if (!best || enemy.hp < best.hp) best = enemy;
    }
    return best;
  };

  /** Whether `c` can use `action` on `t` from where it stands (with `budget` feet of movement for melee). */
  const canReach = (c: Combatant, action: ModelledAction, t: Combatant, budget: number): boolean => {
    if (!positions) return true;
    const reach = meleeReach(action);
    if (reach !== undefined) return moveNeeded(c, t, reach) <= budget;
    const range = rangeOf(action);
    return range === undefined || gap(c, t) <= range + budget;
  };

  /** What its buffs add to a roll ("-1d4" takes away); no draws without buffs. */
  const buffRoll = (c: Combatant, which: "attackDie" | "saveDie"): number => {
    let total = 0;
    for (const b of c.buffs.values()) {
      const die = b[which];
      if (!die) continue;
      const negative = die.trim().startsWith("-");
      const roll = rollExpr(die.replace(/^\s*[+-]\s*/, ""), false, rng);
      total += negative ? -roll : roll;
    }
    return total;
  };
  const acOf = (c: Combatant) => c.actor.armorClass + [...c.buffs.values()].reduce((sum, b) => sum + (b.ac ?? 0), 0);

  /** A failed save it turns into a success with Legendary Resistance, while it has uses. */
  const resists = (target: Combatant): boolean => {
    if (target.lrLeft <= 0) return false;
    target.lrLeft -= 1;
    return true;
  };

  // ---- Concentration -----------------------------------------------------------------------------------
  /** The cast being made, when it is a concentration spell: what it leaves is undone with it. */
  let holding: Array<() => void> | undefined;
  const endConcentration = (c: Combatant) => {
    const undo = c.concentration;
    c.concentration = undefined;
    for (const f of undo ?? []) f();
  };
  /** Taking damage while concentrating: a CON save, DC 10 or half the damage, or the spell ends. */
  const checkConcentration = (c: Combatant, taken: number) => {
    if (!c.concentration || taken <= 0) return;
    if (!living(c)) return endConcentration(c);
    const dc = Math.max(10, Math.floor(taken / 2));
    if (d20(rng) + c.actor.abilities.con.saveModifier + buffRoll(c, "saveDie") < dc) endConcentration(c);
  };
  const setCondition = (target: Combatant, condition: ModelledCondition, how: Pick<Inflict, "lasts" | "save">) => {
    target.conditions.set(condition, how);
    if (holding) {
      const entry = target.conditions.get(condition);
      holding.push(() => {
        if (target.conditions.get(condition) === entry) target.conditions.delete(condition);
      });
    }
  };

  /** A condition lands, unless the target makes the save it gives. */
  const inflict = (target: Combatant, how: Inflict | undefined): void => {
    if (!how || !living(target) || immuneTo(target.actor.defences, how.condition)) return;
    if (how.save) {
      let roll = d20(rng);
      // Resistant to a condition: advantage on the save against it.
      if (target.actor.defences?.conditionResistant.includes(how.condition)) roll = Math.max(roll, d20(rng));
      if (roll + target.actor.abilities[how.save.ability].saveModifier + buffRoll(target, "saveDie") >= how.save.dc)
        return;
    }
    setCondition(target, how.condition, { lasts: how.lasts, ...(how.save ? { save: how.save } : {}) });
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

  /**
   * Damage of a type, less what the target's defences take off ("weapon": a weapon's bludgeoning, piercing or
   * slashing is nonmagical). Returns what it took.
   */
  const damage = (target: Combatant, amount: number, type?: string, weapon = false): number => {
    const taken = Math.min(target.hp, applyDefences(amount, type, target.actor.defences, weapon));
    const was = target.hp;
    target.hp -= taken;
    if (was > 0 !== target.hp > 0) alive += 1;
    if (target.hp <= 0) endConcentration(target);
    return taken;
  };

  const monstersDown = () => livingOn("monsters").length === 0;
  const partyDown = () => livingOn("party").length === 0;

  /** d20 + bonus vs AC; a natural 20 always hits and doubles dice, a natural 1 always misses. */
  const swing = (
    attacker: Combatant,
    action: WeaponAttackAction | SpellAttackAction,
    chosen?: Combatant,
    hindered = false
  ): boolean => {
    const target = chosen ?? pickTarget(attacker);
    if (!target) return false;
    const advantage = has(target, EXPOSED) || attacker.hidden;
    const disadvantage = has(attacker, DISADVANTAGED) || hindered;
    attacker.hidden = false;
    let natural = d20(rng);
    if (advantage !== disadvantage) {
      const second = d20(rng);
      natural = advantage ? Math.max(natural, second) : Math.min(natural, second);
    }
    if (attacker.ammoLeft.has(action)) attacker.ammoLeft.set(action, attacker.ammoLeft.get(action)! - 1);
    const total = natural + action.hitBonus + buffRoll(attacker, "attackDie");
    let hit = natural === 20 || (natural !== 1 && total >= acOf(target));
    // A reaction that raises its AC turns a hit it can beat into a miss (not a natural 20), once a round.
    const reaction = target.actor.reaction;
    if (hit && natural !== 20 && reaction && !target.reactionUsed && hasSlot(target, reaction.circle)) {
      if (total < acOf(target) + reaction.ac) {
        target.reactionUsed = true;
        spendSlot(target, reaction.circle);
        if (reaction.untilTurn) target.buffs.set(REACTION_BUFF, { ac: reaction.ac });
        hit = false;
      }
    }
    if (!hit) return false;
    const crit = natural === 20;
    const weapon = action.kind === "weapon";
    let taken = damage(target, rollExpr(action.damage.expr, crit, rng), action.damage.type, weapon);
    // A rider's damage is of its weapon's type ("1d4 origin").
    taken += damage(target, riderDamage(attacker, target, crit), action.damage.type, weapon);
    inflict(target, action.inflicts);
    checkConcentration(target, taken);
    return true;
  };

  const castSave = (caster: Combatant, action: SaveAction): void => {
    const inRange = (t: Combatant) => canReach(caster, action, t, 0);
    const targets = action.area
      ? enemiesOf(caster)
          .filter(inRange)
          .slice(0, action.targets ?? Infinity)
      : [pickTarget(caster, inRange)].filter((t): t is Combatant => !!t);
    // Damage is rolled once per cast and applied to every target (halved per target that saves).
    const rolledDamage = rollExpr(action.damage.expr, false, rng);
    for (const target of targets) {
      const save = d20(rng) + target.actor.abilities[action.ability].saveModifier + buffRoll(target, "saveDie");
      const success = save >= action.dc || resists(target);
      const taken = damage(
        target,
        success ? (action.onSuccess === "half" ? Math.floor(rolledDamage / 2) : 0) : rolledDamage,
        action.damage.type
      );
      // The action's own save decides its condition: it lands on a failure.
      // A fight-long one is saved against each turn with its own save, else the action's.
      if (
        !success &&
        action.inflicts &&
        living(target) &&
        !immuneTo(target.actor.defences, action.inflicts.condition)
      ) {
        const { condition, lasts } = action.inflicts;
        const again = action.inflicts.save ?? { ability: action.ability, dc: action.dc };
        setCondition(target, condition, { lasts, ...(lasts === "fight" ? { save: again } : {}) });
      }
      checkConcentration(target, taken);
    }
  };

  /** Who a buff would land on now: allies or enemies without it, the most hurt (allies) or the first (enemies). */
  const buffTargets = (c: Combatant, action: BuffAction): Combatant[] => {
    const pool = (action.on === "allies" ? alliesOf(c) : enemiesOf(c)).filter((t) => !t.buffs.has(action.name));
    return pool.slice(0, action.targets);
  };
  const castBuff = (c: Combatant, action: BuffAction): void => {
    for (const t of buffTargets(c, action)) {
      if (
        action.save &&
        (d20(rng) + t.actor.abilities[action.save.ability].saveModifier >= action.save.dc || resists(t))
      )
        continue;
      const buff = {
        ...(action.attackDie ? { attackDie: action.attackDie } : {}),
        ...(action.saveDie ? { saveDie: action.saveDie } : {}),
        ...(action.ac ? { ac: action.ac } : {}),
      };
      t.buffs.set(action.name, buff);
      if (holding)
        holding.push(() => {
          if (t.buffs.get(action.name) === buff) t.buffs.delete(action.name);
        });
    }
  };

  /**
   * Resolve an action: the swings on `target` (each swing of a multiattack re-picks among the enemies in reach),
   * a save, a buff. A ranged swing next to an enemy has disadvantage (`hindered`).
   */
  const useDamaging = (c: Combatant, action: ModelledAction, target?: Combatant, hindered = false): void => {
    if (concentrates(action)) {
      endConcentration(c);
      holding = [];
    }
    switch (action.kind) {
      case "weapon":
      case "spell-attack":
        swing(c, action, target, hindered);
        break;
      case "multiattack":
        // Each swing re-picks the lowest-HP living enemy in reach (a swing with none left does nothing).
        for (const s of action.swings) {
          const next =
            positions || target
              ? (pickTarget(c, (t) => canReach(c, s, t, 0)) ?? (target && living(target) ? target : undefined))
              : undefined;
          if (positions && !next) break;
          swing(c, s, next, hindered);
        }
        break;
      case "save":
        castSave(c, action);
        break;
      case "buff":
        castBuff(c, action);
        break;
      default:
        break;
    }
    if (holding) {
      c.concentration = holding;
      holding = undefined;
    }
  };

  // ---- Healing and death saves -------------------------------------------------------------------------
  /** Allies at 0 HP who can still be brought back (with death saves). */
  const fallen = new Map<string, { at: number; list: Combatant[] }>();
  const downAllies = (c: Combatant): Combatant[] => {
    if (!rules.deathSaves) return NONE;
    const side = c.actor.side;
    const known = fallen.get(side);
    // Rebuilt when someone falls or gets up; one who dies since is filtered out.
    if (known && known.at === alive)
      return known.list.some((o) => o.dead) ? known.list.filter((o) => !o.dead) : known.list;
    const list = order.filter((o) => o.actor.side === side && !living(o) && !o.dead);
    fallen.set(side, { at: alive, list });
    return list;
  };

  const healFor = (c: Combatant, bonus = false): HealAction | undefined => {
    const heal = c.actor.actions.find(
      (a): a is HealAction => a.kind === "heal" && !!a.bonus === bonus && isAvailable(c, a)
    );
    if (!heal) return undefined;
    return downAllies(c).length > 0 || alliesOf(c).some((a) => 2 * a.hp < a.actor.maxHp) ? heal : undefined;
  };

  /** Heals an ally who is down first, else the most hurt below half its HP; false when none is. */
  const healAlly = (c: Combatant, heal: HealAction): boolean => {
    let target: Combatant | undefined = downAllies(c)[0];
    let missing = -1;
    if (!target) {
      for (const ally of alliesOf(c)) {
        if (2 * ally.hp >= ally.actor.maxHp) continue;
        const gap = ally.actor.maxHp - ally.hp;
        if (gap > missing || (gap === missing && target && ally.hp < target.hp)) {
          target = ally;
          missing = gap;
        }
      }
    }
    if (!target) return false;
    const was = target.hp;
    target.hp = Math.min(target.actor.maxHp, target.hp + Math.max(0, rollExpr(heal.expr, false, rng)));
    if (was > 0 !== target.hp > 0) alive += 1;
    if (target.hp > 0) {
      target.deathFails = 0;
      target.deathSuccesses = 0;
    }
    spendSlot(c, circleOf(heal));
    return true;
  };

  /** A PC at 0 HP rolls a death save at its turn's start; a natural 20 brings it back with 1 HP. */
  const deathSave = (c: Combatant) => {
    if (c.dead || c.deathSuccesses >= 3) return;
    const roll = d20(rng);
    if (roll === 20) {
      c.hp = 1;
      alive += 1;
      c.deathFails = 0;
      c.deathSuccesses = 0;
      return;
    }
    if (roll >= 10) c.deathSuccesses += 1;
    else c.deathFails += roll === 1 ? 2 : 1;
    if (c.deathFails >= 3) c.dead = true;
  };

  // ---- Choosing and taking a turn ----------------------------------------------------------------------
  const useBonus = (c: Combatant, move: BonusMove) => {
    if (c.bonusUsed || !c.actor.bonusMoves?.includes(move)) return false;
    c.bonusUsed = true;
    return true;
  };

  /** Hide (a bonus action, at range and next to no enemy): Stealth against the best passive Perception. */
  const tryHide = (c: Combatant) => {
    if (!positions || c.bonusUsed || !c.actor.bonusMoves?.includes("hide") || engagedBy(c).length) return;
    c.bonusUsed = true;
    const watch = Math.max(...enemiesOf(c).map((e) => e.actor.passivePerception ?? 10));
    if (d20(rng) + (c.actor.stealth ?? 0) >= watch) c.hidden = true;
  };

  /** What it would do with `action` now: its target, the feet it would move, and how much it is worth. */
  const planFor = (c: Combatant, action: ModelledAction) => {
    const livingEnemies = enemiesOf(c).length;
    const base = action.kind === "buff" ? BUFF_WORTH * buffTargets(c, action).length : valueOf(action, livingEnemies);
    if (!positions) return { value: base, budget: 0 };
    const speed = speedOf(c);
    const canDash = !c.bonusUsed && !!c.actor.bonusMoves?.includes("dash");
    const reach = meleeReach(action);
    if (reach !== undefined) {
      // Melee: a target it can reach with its move (or a bonus Dash).
      if (enemiesOf(c).some((t) => canReach(c, action, t, speed))) return { value: base, budget: speed };
      if (canDash && enemiesOf(c).some((t) => canReach(c, action, t, 2 * speed)))
        return { value: base, budget: 2 * speed, dash: true };
      return { value: -Infinity, budget: speed };
    }
    if (rangeOf(action) === undefined) return { value: base, budget: 0 };
    if (!enemiesOf(c).some((t) => canReach(c, action, t, speed))) return { value: -Infinity, budget: speed };
    // At range next to an enemy: disadvantage, unless it can slip away (a bonus Disengage) first.
    const hindered = isAttack(action) && engagedBy(c).length > 0 && !c.actor.bonusMoves?.includes("disengage");
    return { value: hindered ? base * 0.65 : base, budget: speed };
  };

  /** Runs `action`: moves into reach (melee) or out of the way (at range), then acts. */
  const act = (c: Combatant, action: ModelledAction, plan: ReturnType<typeof planFor>) => {
    spendSlot(c, circleOf(action));
    const limit = limitOf(action);
    if (limit?.recharge !== undefined) c.spent.add(action);
    if (limit?.perDay !== undefined) c.usesLeft.set(action, (c.usesLeft.get(action) ?? limit.perDay) - 1);
    if (!positions) return useDamaging(c, action);

    const reach = meleeReach(action);
    if (reach !== undefined) {
      if (plan.dash) useBonus(c, "dash");
      // Someone already in reach is struck where it stands: walking off to another draws opportunity attacks.
      const inReach = enemiesOf(c).some((t) => canReach(c, action, t, 0));
      const target = pickTarget(c, (t) => canReach(c, action, t, inReach ? 0 : plan.budget));
      if (!target) return;
      const needed = moveNeeded(c, target, reach);
      if (needed > 0) moveTo(c, spotFor(c, target, reach), target.aloft);
      else if (c.aloft && !target.aloft) moveTo(c, c.x, false);
      if (!living(c)) return;
      return useDamaging(c, action, target);
    }
    // Nothing says where it reaches: it reaches anyone, from where it stands.
    if (rangeOf(action) === undefined) return useDamaging(c, action);
    // At range: next to an enemy, it slips away (a bonus Disengage) or steps back and draws their swings
    // when they would cost it less than the disadvantage; a flier rises out of reach.
    const engaged = engagedBy(c);
    let hindered = isAttack(action) && engaged.length > 0;
    if (engaged.length > 0) {
      if (c.actor.bonusMoves?.includes("disengage") && useBonus(c, "disengage")) c.disengaged = true;
      const cost = engaged.reduce((sum, e) => {
        const s = !e.reactionUsed ? opportunitySwing(e.actor) : undefined;
        return sum + (s ? 0.6 * averageOf(s.damage.expr) : 0);
      }, 0);
      const worth = isAttack(action) ? 0.35 * valueOf(action, enemiesOf(c).length) : 0;
      if (c.disengaged || c.actor.flyby || cost < worth || c.actor.fly) {
        const away = c.actor.side === "party" ? -1 : 1;
        moveTo(c, c.x + away * Math.min(speedOf(c), 10), !!c.actor.fly);
        hindered = false;
      }
    } else if (c.actor.fly && !c.aloft) {
      moveTo(c, c.x, true);
    }
    if (!living(c)) return;
    // Out of range: it closes in first.
    const range = rangeOf(action) ?? Infinity;
    const target = pickTarget(c, (t) => canReach(c, action, t, plan.budget));
    if (target && gap(c, target) > range) {
      const toward = target.x > c.x ? 1 : -1;
      moveTo(c, c.x + toward * (gap(c, target) - range));
    }
    if (!living(c)) return;
    if (isAttack(action)) tryHide(c);
    useDamaging(c, action, target, hindered);
    if (living(c)) kite(c, action);
  };

  /**
   * After acting at range, next to no enemy: it backs off from a melee threat that could reach it on its next
   * turn, as far as its speed allows while its target stays in range (it already moved closer, if it had to).
   */
  const kite = (c: Combatant, action: ModelledAction) => {
    if (engagedBy(c).length > 0 || c.aloft) return;
    const threats = enemiesOf(c).filter((e) => {
      const reach = opportunitySwing(e.actor)?.reach?.melee;
      return reach !== undefined && !has(e, NO_TURN) && moveNeeded(e, c, reach) <= 2 * speedOf(e);
    });
    if (!threats.length) return;
    const away = c.actor.side === "party" ? -1 : 1;
    const range = rangeOf(action) ?? Infinity;
    const farthest = Math.max(...enemiesOf(c).map((e) => gap(c, e)));
    const room = Math.max(0, range - farthest);
    const step = Math.min(speedOf(c), room);
    if (step > 0) moveTo(c, c.x + away * step);
  };

  /** No action reaches anyone: it moves toward the nearest enemy (a Dash, as its action). */
  const advance = (c: Combatant) => {
    if (!positions) return;
    let nearest: Combatant | undefined;
    for (const e of enemiesOf(c)) if (!nearest || gap(c, e) < gap(c, nearest)) nearest = e;
    if (!nearest) return;
    const budget = 2 * speedOf(c);
    const spot = spotFor(c, nearest, 5);
    const toward = spot > c.x ? 1 : -1;
    moveTo(c, Math.abs(spot - c.x) <= budget ? spot : c.x + toward * budget, nearest.aloft && !!c.actor.fly);
  };

  /** A bonus action that attacks (a monster's "Bonus Actions"), on an enemy already in reach. */
  const bonusAttack = (c: Combatant) => {
    if (c.bonusUsed || !c.actor.bonusActions?.length || !living(c)) return;
    let best: ModelledAction | undefined;
    let bestValue = 0;
    for (const a of c.actor.bonusActions) {
      if (!isAvailable(c, a) || !enemiesOf(c).some((t) => canReach(c, a, t, 0))) continue;
      const v = valueOf(a, enemiesOf(c).length);
      if (v > bestValue) {
        best = a;
        bestValue = v;
      }
    }
    if (!best) return;
    c.bonusUsed = true;
    const limit = limitOf(best);
    if (limit?.recharge !== undefined) c.spent.add(best);
    if (limit?.perDay !== undefined) c.usesLeft.set(best, (c.usesLeft.get(best) ?? limit.perDay) - 1);
    const target = positions ? pickTarget(c, (t) => canReach(c, best!, t, 0)) : undefined;
    useDamaging(
      c,
      best,
      target,
      positions && isAttack(best) && meleeReach(best) === undefined && engagedBy(c).length > 0
    );
  };

  const takeTurn = (c: Combatant): boolean => {
    // Recharge rolls first: a d6 for each spent action, back on its number or more.
    for (const action of c.actor.actions) {
      if (!c.spent.has(action)) continue;
      if (Math.floor(rng() * 6) + 1 >= (limitOf(action)?.recharge ?? 7)) c.spent.delete(action);
    }
    // A bonus-action heal comes on top of the action; an action heal takes the turn.
    const bonusHeal = healFor(c, true);
    if (bonusHeal && !c.bonusUsed && healAlly(c, bonusHeal)) c.bonusUsed = true;
    const heal = healFor(c);
    if (heal && healAlly(c, heal)) return false;
    // An ally about to die (two failed death saves) and no heal at hand: a Medicine check (DC 10) to stabilise.
    const dying = downAllies(c).find((a) => a.deathFails >= 2 && a.deathSuccesses < 3);
    if (dying && c.actor.side === "party") {
      if (d20(rng) + c.actor.abilities.wis.modifier >= 10) dying.deathSuccesses = 3;
      return false;
    }

    let best: ModelledAction | undefined;
    let bestPlan: ReturnType<typeof planFor> | undefined;
    for (const action of c.actor.actions) {
      if (action.kind === "heal" || !isAvailable(c, action)) continue;
      const plan = planFor(c, action);
      if (plan.value === -Infinity) continue;
      if (!bestPlan || plan.value > bestPlan.value) {
        best = action;
        bestPlan = plan;
      }
    }
    if (!best || !bestPlan) {
      advance(c);
      return false; // nothing in reach, damaging or healing: it closes in or passes
    }
    act(c, best, bestPlan);
    bonusAttack(c);
    return true;
  };

  const result = (outcome: TrialResult["outcome"], rounds: number): TrialResult => ({
    outcome,
    rounds,
    partyHpRemaining: state.reduce((sum, c) => sum + (c.actor.side === "party" ? c.hp : 0), 0),
    knockedOut: state.filter((c) => c.actor.side === "party" && !living(c)).map((c) => c.actor.name),
    ...(rules.deathSaves
      ? { dead: state.filter((c) => c.actor.side === "party" && c.dead).map((c) => c.actor.name) }
      : {}),
  });

  /** Its turn begins: what lasts to its turn's start ends; true when a condition takes its turn. */
  const startTurn = (c: Combatant): boolean => {
    c.riderDone = false;
    c.legendaryLeft = c.actor.legendary?.points ?? 0;
    c.reactionUsed = false;
    c.bonusUsed = false;
    c.disengaged = false;
    c.buffs.delete(REACTION_BUFF);
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

  /**
   * After another creature's turn, a legendary creature may spend its points: the affordable legendary action
   * worth the most a point, once a turn, until its points run out (they come back at its own turn). True when
   * one was taken.
   */
  const legends = order.filter((c) => c.actor.legendary);
  const legendaryAfter = (just: Combatant): boolean => {
    let acted = false;
    for (const m of legends) {
      if (m === just || !living(m) || m.legendaryLeft <= 0 || has(m, NO_TURN)) continue;
      const livingEnemies = enemiesOf(m).length;
      let best: { action: ModelledAction; cost: number } | undefined;
      let bestRate = 0;
      for (const option of m.actor.legendary!.actions) {
        if (option.cost > m.legendaryLeft || !isAvailable(m, option.action)) continue;
        if (positions && !enemiesOf(m).some((t) => canReach(m, option.action, t, 0))) continue;
        const rate = valueOf(option.action, livingEnemies) / option.cost;
        if (rate > bestRate) {
          best = option;
          bestRate = rate;
        }
      }
      if (!best) continue;
      m.legendaryLeft -= best.cost;
      const target = positions ? pickTarget(m, (t) => canReach(m, best!.action, t, 0)) : undefined;
      useDamaging(m, best.action, target);
      acted = true;
    }
    return acted;
  };

  /**
   * The lair acts on initiative 20 (losing ties): its owner's lair action worth the most, not the one it took
   * last round. Lair actions reach anywhere in the lair. True when one was taken.
   */
  const lairTurn = (): boolean => {
    const owner = order.find((c) => living(c) && c.actor.lair?.length);
    if (!owner) return false;
    const livingEnemies = enemiesOf(owner).length;
    let best: ModelledAction | undefined;
    let bestValue = 0;
    for (const a of owner.actor.lair!) {
      if (a === owner.lastLair && owner.actor.lair!.length > 1) continue;
      const v = valueOf(a, livingEnemies);
      if (v > bestValue) {
        best = a;
        bestValue = v;
      }
    }
    if (!best) return false;
    owner.lastLair = best;
    useLair(owner, best);
    return true;
  };
  /** A lair action: a save on its targets, or an attack, reaching anywhere in the lair. */
  const useLair = (owner: Combatant, action: ModelledAction) => {
    if (action.kind === "save") {
      const targets = action.area
        ? enemiesOf(owner).slice(0, action.targets ?? Infinity)
        : [pickTarget(owner)].filter((t): t is Combatant => !!t);
      const rolledDamage = rollExpr(action.damage.expr, false, rng);
      for (const target of targets) {
        const save = d20(rng) + target.actor.abilities[action.ability].saveModifier + buffRoll(target, "saveDie");
        const success = save >= action.dc || resists(target);
        const taken = damage(
          target,
          success ? (action.onSuccess === "half" ? Math.floor(rolledDamage / 2) : 0) : rolledDamage,
          action.damage.type
        );
        if (
          !success &&
          action.inflicts &&
          living(target) &&
          !immuneTo(target.actor.defences, action.inflicts.condition)
        )
          target.conditions.set(action.inflicts.condition, { lasts: action.inflicts.lasts });
        checkConcentration(target, taken);
      }
    } else if (action.kind === "weapon" || action.kind === "spell-attack") {
      swing(owner, action, pickTarget(owner));
    }
  };

  const ended = (): TrialResult["outcome"] | undefined => (monstersDown() ? "win" : partyDown() ? "tpk" : undefined);

  for (let round = 1; round <= roundCap; round++) {
    let lairDone = !rules.lair;
    for (const c of order) {
      if (!lairDone && (initiativeOf?.get(c) ?? 0) < 20) {
        lairDone = true;
        if (lairTurn()) {
          const end = ended();
          if (end) return result(end, round);
        }
      }
      if (!living(c)) {
        if (rules.deathSaves && c.actor.side === "party") deathSave(c);
        if (!living(c)) continue;
      }
      const lost = startTurn(c);
      const acted = !lost && takeTurn(c);
      endTurn(c);
      if (acted) {
        const end = ended();
        if (end) return result(end, round);
      }
      if (legendaryAfter(c)) {
        const end = ended();
        if (end) return result(end, round);
      }
    }
    if (!lairDone && lairTurn()) {
      const end = ended();
      if (end) return result(end, round);
    }
  }
  return result("stalemate", roundCap);
}
