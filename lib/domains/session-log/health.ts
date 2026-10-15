/**
 * Everyone's hit points through a fight — the party's and the foes' alike —
 * so an attack's damage reads as what it left its target with:
 *
 *   @(Kobold, Tinkerer) Parts-Filled Sling → Talon
 *   d: Attack | d20+4=18 vs AC 17 ->            ← Hit
 *   d: Damage | 1d4+2=4                          ← Talon 6/10 HP
 *
 * A creature starts where its page says (a sheet's current HP, a statblock's
 * HP) or where its `[F:…|HP 26]` tag puts it. Each hit then takes its damage
 * from the target the action names (`→ Talon`) — every `Damage` roll in the
 * entry, unless the attack missed. An HP tag written for the target in that
 * entry (`[PC:Talon|HP-4]`, `[F:…|HP-8]`) is the record instead, so nothing is
 * counted twice; HP tags anywhere else move it too.
 *
 * An attack names the AC it's rolled against (`vs AC 17`) — or leaves it to the
 * target: a bare `vs AC`, or an Attack roll with no `vs` at all, is rolled
 * against the target's own AC (from its sheet or statblock).
 */

import type { PersistentTag, RollEntry } from "lib/domains/lonelog/types";
import type { SidebarItem, SidebarRow } from "./prose-model";
import { actionTarget } from "./action-call";
import { matchActor } from "./actors";
import { combatantKey, segmentTags } from "./initiative";
import { countedDice, parseFormula } from "./formula";
import { checkResult } from "./prose-model";
import type { ProseSegment } from "./prose-grouper";

export interface Health {
  current: number;
  max: number;
  /** At 0 HP, how it stands with death — a PC dying (its death saves so far),
   *  stable, or dead; a monster dead. Absent while it has hit points. */
  life?: Life;
}

/**
 * Life at 0 hit points, as Tales of the Valiant has it ("Dropping to 0 Hit
 * Points"): a PC is DYING — a death save each turn, 10 or more a success, a 1
 * two failures, a 20 back at 1 HP; three successes STABLE, three failures DEAD;
 * damage at 0 HP a failure, and damage past its HP maximum (left over on the way
 * down, or taken at 0) death outright. A monster just dies. Healing brings the
 * dying and the stable back; the dead it can't help — only a resurrection can.
 */
export interface Life {
  state: "dying" | "stable" | "dead";
  successes: number;
  failures: number;
  /** A monster's death — it simply drops (`KO`). */
  monster?: boolean;
}

/** What an action did to its target's health. */
export interface HitResult {
  /** The target, as the action names it (`Talon`). */
  target: string;
  /** Whether the attack hit — absent when no attack roll judged it. */
  hit?: boolean;
  /** The damage it took (0 on a miss). */
  damage: number;
  /** The hit points it got back (Nature's Gift), when it healed. */
  healed?: number;
  /** Healing that did nothing: its target is dead. */
  wasted?: boolean;
  /** Its health after, when known. */
  health?: Health;
}

export interface HealthFold {
  /** Each action's effect on its target, by the action's segment. */
  hits: Map<number, HitResult>;
  /** Everyone's health as of an entry (the latest at or before it). */
  at: (id: number, name: string) => Health | undefined;
  /** Everyone's health at the end of the log. */
  now: (name: string) => Health | undefined;
}

/** The target an action line names: `Mining Pick → Lilith`. */
const targetOf = (text: string): string | undefined => actionTarget(text);

/** A roll line's formula, without its `d:` / `d(Name):`. */
const formulaOf = (roll: RollEntry): string => (roll.raw ?? "").replace(/^d(?:\([^)]*\))?:\s*/, "");

/** An attack roll: one against an AC, or one its label calls an attack. */
const isAttack = (label: string | undefined, formula: string) =>
  /\bvs\s+AC\b/i.test(formula) || (/\battack\b/i.test(label ?? "") && !/\bvs\b/i.test(formula));

/** A healing roll (`d: Healing | 2d4=5`) — not one that heals as a side note of damage. */
const isHealing = (label: string | undefined) =>
  /\bheal(?:ing|s|ed)?\b/i.test(label ?? "") && !/damage/i.test(label ?? "");

/** An attack's formula against the target's AC, when it doesn't name one. */
const againstAc = (formula: string) =>
  /\bvs\b/i.test(formula) ? formula : formula.replace(/\s*(->|→)?\s*$/, " vs AC $1").trimEnd();

/**
 * Whether an attack was a critical hit: a natural 20 on its d20 — the die
 * kept, for advantage (`2d20kh1+6=[20,3]=26`) — or a result written as one.
 */
export function isCrit(roll: RollEntry): boolean {
  if (/\bcrit/i.test(roll.result ?? "")) return true;
  const f = parseFormula(formulaOf(roll), {});
  const term = f?.check.kind === "single" ? f.check.term : f?.check.kind === "contest" ? f.check.left : undefined;
  if (!term || term.kind !== "dice" || term.sides !== 20) return false;
  if (term.values.length > 0) return Math.max(...countedDice(term.values, term.selector)) === 20;
  return term.count <= 1 && term.value === 20;
}

/** What a roll came to — its result, as written (`1d4+2=6` → 6). Null while unrolled. */
function rollTotal(roll: RollEntry): number | null {
  const f = parseFormula(formulaOf(roll), {});
  const term = f?.check.kind === "single" ? f.check.term : f?.check.kind === "contest" ? f.check.left : undefined;
  if (!term || term.kind !== "dice") return roll.total ?? null;
  return term.total ?? term.value ?? null;
}

/** An HP change in a tag: a foe's parsed `hp`, a PC's `HP-4` / `HP 7`. */
function hpChange(
  tag: PersistentTag
): { name: string; max?: number; set?: number; delta?: number; stable?: boolean } | null {
  // Stabilized: `[PC:Jacqui|+stable]`, `[F:Kobold, Elite|+stable]`.
  const marks = tag.kind === "pc" ? tag.changes : tag.kind === "foe" ? tag.tags : [];
  if ((tag.kind === "pc" || tag.kind === "foe") && marks.some((c) => /^\+\s*stable$/i.test(c.trim()))) {
    return { name: tag.name, stable: true };
  }
  if (tag.kind === "foe" && tag.hp) return { name: tag.name, ...tag.hp };
  if (tag.kind !== "pc") return null;
  for (const c of tag.changes) {
    const m = c.match(/^HP\s*([+-]?)\s*(\d+)$/i);
    if (!m) continue;
    const n = parseInt(m[2], 10);
    return m[1] ? { name: tag.name, delta: m[1] === "-" ? -n : n } : { name: tag.name, set: n };
  }
  return null;
}

/**
 * Follow everyone's health through the log. `start` gives a creature's health
 * before the log touches it (from its sheet or statblock), when known.
 */
export function foldHealth(
  segments: ProseSegment[],
  start: (name: string) => Health | undefined,
  acOf: (name: string) => number | undefined = () => undefined,
  /** One of the party — dying at 0 HP, where a monster dies. */
  isPc: (name: string) => boolean = () => false
): HealthFold {
  const state = new Map<string, Health>();
  const hits = new Map<number, HitResult>();
  const history: Array<{ id: number; state: Map<string, Health> }> = [];

  const keyOf = (name: string): string => {
    const key = combatantKey(name);
    if (state.has(key)) return key;
    const keys = [...state.keys()];
    const i = matchActor(
      name,
      keys.map((k) => ({ name: k }))
    );
    return i >= 0 ? keys[i] : key;
  };
  const healthOf = (name: string): Health | undefined => {
    const key = keyOf(name);
    if (!state.has(key)) {
      const s = start(name);
      if (s) state.set(key, { ...s });
    }
    return state.get(key);
  };

  // Damage taken, life and death with it.
  const hurt = (name: string, before: Health, damage: number, crit = false): Health => {
    if (damage <= 0 || before.life?.state === "dead") return before;
    const pc = isPc(name);
    if (before.current > 0) {
      const left = damage - before.current;
      if (left < 0) return { current: before.current - damage, max: before.max };
      // Down to 0: a monster dies; a PC dies outright on damage past its maximum, else is dying.
      if (!pc)
        return { current: 0, max: before.max, life: { state: "dead", successes: 0, failures: 0, monster: true } };
      const dead = left >= before.max;
      return { current: 0, max: before.max, life: { state: dead ? "dead" : "dying", successes: 0, failures: 0 } };
    }
    // At 0 already: a failed death save — or death, on damage past its maximum.
    if (!pc) return { current: 0, max: before.max, life: { state: "dead", successes: 0, failures: 0, monster: true } };
    if (damage >= before.max)
      return { current: 0, max: before.max, life: { state: "dead", successes: 0, failures: 0 } };
    const life = before.life?.state === "dying" ? before.life : { state: "dying" as const, successes: 0, failures: 0 };
    // A critical hit at 0 HP is two failures.
    const failures = life.failures + (crit ? 2 : 1);
    return {
      current: 0,
      max: before.max,
      life: failures >= 3 ? { state: "dead", successes: 0, failures } : { ...life, failures },
    };
  };
  // Healing: the dying and the stable come back; the dead stay dead.
  const heal = (before: Health, amount: number): Health =>
    before.life?.state === "dead" || amount <= 0
      ? before
      : { current: Math.min(before.max, before.current + amount), max: before.max };

  for (const seg of segments) {
    // A death save, made by a dying PC at the start of its turn: a d20, 10 or
    // more a success; a 1, two failures; a 20, back at 1 HP.
    if (seg.type === "action-group" && seg.action.actor) {
      for (const r of (seg.rolls ?? []).filter((x) => /death\s*save/i.test(x.label ?? ""))) {
        const key = keyOf(seg.action.actor);
        const was = state.get(key) ?? healthOf(seg.action.actor);
        const roll = rollTotal(r);
        if (!was || was.life?.state !== "dying" || roll == null) continue;
        if (roll >= 20) {
          state.set(key, { current: 1, max: was.max });
          continue;
        }
        const life = { ...was.life };
        if (roll === 1) life.failures += 2;
        else if (roll >= 10) life.successes += 1;
        else life.failures += 1;
        state.set(key, {
          current: 0,
          max: was.max,
          life:
            life.failures >= 3
              ? { state: "dead", successes: life.successes, failures: life.failures }
              : life.successes >= 3
                ? { state: "stable", successes: 0, failures: 0 }
                : life,
        });
      }
    }
    // Its tags — a fight's opening question names its foes too (`? Combat
    // begins. [F:…|HP 26]`), and an action line may carry its own.
    const tags = [
      ...(seg.type === "oracle" ? (seg.question.foes ?? []) : []),
      ...(seg.type === "action-group" ? (seg.action.tags ?? []) : []),
      ...segmentTags(seg),
    ];
    // Its target — or, healing with none named (a hit die spent on a short
    // rest), whoever heals.
    const healsSelf =
      seg.type === "action-group" &&
      !targetOf(seg.action.text) &&
      !!seg.action.actor &&
      (seg.rolls ?? []).some((r) => isHealing(r.label)) &&
      !(seg.rolls ?? []).some((r) => /damage|attack/i.test(r.label ?? ""));
    const target =
      seg.type === "action-group"
        ? (targetOf(seg.action.text) ?? (healsSelf ? seg.action.actor : undefined))
        : undefined;
    const targetKey = target ? keyOf(target) : undefined;
    let tagged = false;

    for (const tag of tags) {
      const ch = hpChange(tag);
      if (!ch) continue;
      const key = keyOf(ch.name);
      if (key === targetKey) tagged = true;
      const was = state.get(key) ?? (ch.max != null || ch.set != null ? undefined : healthOf(ch.name));
      const max = ch.max ?? was?.max ?? ch.set;
      if (max == null) continue;
      // Stabilized (`[PC:Jacqui|+stable]` — a Medicine check, a spell): dying no more.
      if (ch.stable) {
        const was = state.get(key) ?? healthOf(ch.name);
        if (was?.life?.state === "dying")
          state.set(key, { ...was, life: { state: "stable", successes: 0, failures: 0 } });
        continue;
      }
      const base: Health =
        ch.set != null
          ? { current: ch.set, max }
          : ch.max != null && !was
            ? { current: ch.max, max }
            : { ...(was ?? { current: max, max }), max };
      // An HP change is damage or healing as any other: life and death with it.
      const next = ch.delta == null ? base : ch.delta < 0 ? hurt(ch.name, base, -ch.delta) : heal(base, ch.delta);
      state.set(key, next.current < 0 ? { ...next, current: 0 } : next);
    }

    if (seg.type === "action-group" && target) {
      const rolls = seg.rolls ?? [];
      const attack = rolls.find((r) => isAttack(r.label, formulaOf(r)));
      const ac = acOf(target);
      const judged = attack
        ? attack.result?.trim() || checkResult(againstAc(formulaOf(attack)), ac != null ? { vars: { AC: ac } } : {})
        : null;
      const hit = judged ? /^hit$/i.test(judged) : undefined;
      const damage =
        hit === false
          ? 0
          : rolls.filter((r) => /damage/i.test(r.label ?? "")).reduce((sum, r) => sum + (rollTotal(r) ?? 0), 0);
      // A healing roll gives its target hit points back, up to their max.
      const healed = rolls.filter((r) => isHealing(r.label)).reduce((sum, r) => sum + (rollTotal(r) ?? 0), 0);
      if (attack || damage > 0 || healed > 0) {
        const before = healthOf(target);
        const wasted = healed > 0 && before?.life?.state === "dead";
        if (before && !tagged && (damage > 0 || healed > 0)) {
          state.set(
            keyOf(target),
            heal(hurt(target, before, damage, !!attack && hit !== false && isCrit(attack)), healed)
          );
        }
        const after = state.get(keyOf(target));
        hits.set(seg.sourceIndex, {
          target,
          ...(hit != null ? { hit } : {}),
          damage,
          ...(healed > 0 && !wasted ? { healed } : {}),
          ...(wasted ? { wasted: true } : {}),
          ...(after ? { health: { ...after } } : {}),
        });
      }
    }

    history.push({
      id: seg.sourceIndex,
      state: new Map([...state].map(([k, v]) => [k, { ...v, ...(v.life ? { life: { ...v.life } } : {}) }])),
    });
  }

  const lookupIn = (map: Map<string, Health>, name: string): Health | undefined => {
    const key = combatantKey(name);
    if (map.has(key)) return map.get(key);
    const keys = [...map.keys()];
    const i = matchActor(
      name,
      keys.map((k) => ({ name: k }))
    );
    return i >= 0 ? map.get(keys[i]) : undefined;
  };
  return {
    hits,
    at: (id, name) => {
      let found: Map<string, Health> | undefined;
      for (const h of history) {
        if (h.id > id) break;
        found = h.state;
      }
      return found ? lookupIn(found, name) : undefined;
    },
    now: (name) => lookupIn(state, name) ?? start(name),
  };
}

/**
 * What a creature is left with, as the Log says it: `6/10 HP`; at 0, a monster
 * `KO`, a PC `dying (1✓ 2✗)`, `stable` or `dead` — and healing that came too
 * late, `dead — healing can't help`.
 */
export function leftWith(health: Health, wasted?: boolean): string {
  if (wasted) return "dead — healing can't help";
  if (health.current > 0) return `${health.current}/${health.max} HP`;
  const life = health.life;
  if (!life) return "KO";
  if (life.state === "dying")
    return life.successes || life.failures ? `dying (${life.successes}✓ ${life.failures}✗)` : "dying";
  return life.monster ? "KO" : life.state;
}

/** A creature's name as shown: links read as their text. */
const shown = (name: string) =>
  name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();

/**
 * What an entry's damage (or healing) left the target with, on its LAST such row — after
 * every die of it, a rider's too (`Mystic Mark damage | 1d4=3 → Talon 6/10 HP`;
 * at 0, `→ Fat Kobold, A KO`) — once its attack is known to have hit (or when
 * no attack roll judges it).
 */
export function withTargetHealth(
  items: SidebarItem[],
  hits: Map<number, HitResult>,
  at?: (id: number, name: string) => Health | undefined
): SidebarItem[] {
  // A foe's row reads its health as the hits have left it, not only as its tags say.
  const withFoeHealth = (item: SidebarItem): SidebarItem =>
    at && item.rows.some((r) => r.foe)
      ? {
          ...item,
          rows: item.rows.map((r) => {
            const h = r.foe ? at(item.id, r.content) : undefined;
            return h && r.foe ? { ...r, foe: { ...r.foe, current: h.current, max: h.max } } : r;
          }),
        }
      : item;
  return items.map(withFoeHealth).map((item) => {
    const hit = hits.get(item.id);
    if (!hit?.health || hit.hit === false || (hit.damage <= 0 && !hit.healed && !hit.wasted)) return item;
    const isDamage = (row: SidebarRow) =>
      !!row.rollable && (/damage/i.test(row.content.split("|")[0] ?? "") || isHealing(row.content.split("|")[0]));
    const last = item.rows.map(isDamage).lastIndexOf(true);
    if (last < 0) return item;
    const left = leftWith(hit.health!, hit.wasted);
    // The target's own row says it already — the damage row takes its link
    // (`Fat [[Kobold, A]]`, as the log wrote it), with what it's left with.
    const isTarget = (row: SidebarRow) =>
      !!row.foe && shown(row.content).toLowerCase() === shown(hit.target).toLowerCase();
    const named = item.rows.find(isTarget)?.content ?? item.rows[0]?.targetAs ?? hit.target;
    return {
      ...item,
      rows: item.rows
        .map((row, i) => (i === last ? { ...row, leaves: { target: named, left } } : row))
        .filter((row) => !isTarget(row)),
    };
  });
}

/**
 * The Log's attack rows rolled against their target's AC: a bare `vs AC` reads
 * the target's (shown, not edited — the sheet owns it), and an Attack roll
 * that names no AC is given one. Before checks are judged, so they hit or miss.
 */
export function withTargetAc(items: SidebarItem[], acOf: (name: string) => number | undefined): SidebarItem[] {
  return items.map((item) => {
    const target = item.rows[0] ? actionTarget(item.rows[0].content) : undefined;
    const ac = target ? acOf(target) : undefined;
    if (ac == null) return item;
    return {
      ...item,
      rows: item.rows.map((row) => {
        if (!row.rollable) return row;
        const bar = row.content.indexOf("|");
        const label = bar >= 0 ? row.content.slice(0, bar) : "";
        if (!isAttack(label, bar >= 0 ? row.content.slice(bar + 1) : row.content)) return row;
        return { ...row, content: againstAc(row.content), vars: { ...(row.vars ?? {}), AC: ac } };
      }),
    };
  });
}
