/**
 * The movement rules a fight's log can be read against — none enforced, each
 * said where the move is written:
 *
 *   MOVE → H6 · 15/30 ft                  feet walked this round, of its speed
 *   MOVE → H8 · 35/30 ft  over speed      past it (a Dash doubles it)
 *   MOVE → J14 · speed 0 (grappled)       a condition that holds it in place
 *   MOVE → J14 · provokes Kobold, Elite   it left a foe's reach — unless it Disengaged
 *
 * Feet: every square entered costs the map's scale (5 ft) — a diagonal too, or
 * on a map that says `diagonals: alternate`, every second diagonal twice; a
 * square of difficult terrain costs double. Speed is the creature's own, and
 * spent across its round — a move before its action and one after share it.
 *
 * An opportunity attack is provoked by stepping from a square within a hostile
 * creature's reach to one outside it (each creature once per move); a creature
 * that's down doesn't threaten, and one that Disengaged this round provokes no one.
 *
 * A move an effect grants — Scurry's "moves up to 15 feet without provoking
 * Opportunity Attacks", a reaction's "up to half your speed" — is held to the
 * effect's own limit, apart from the round's speed, and provokes no one when it
 * says so. A plain move outside the creature's own round, with nothing granting
 * it, is said as such.
 */

import type { Battle, BattlePlacement } from "./battle";
import { squareDistance, type Square, type SquareMap } from "./square-map";
import { combatantKey } from "lib/domains/session-log/initiative";

/** Conditions that leave a creature no speed at all. */
const SPEED_ZERO = new Set(["grappled", "restrained", "paralyzed", "petrified", "stunned", "unconscious"]);

/** What a creature brings to the rules: its speed, its reach, its side. */
export interface MoverInfo {
  /** Walking speed in feet (30). */
  speed?: number;
  /** Melee reach in feet (5; 10 with a reach weapon). */
  reach: number;
  /** On the foes' side. */
  foe: boolean;
}

/** A move an effect grants: how far (feet, or `half` / all its `speed`), and
 *  whether it provokes. */
export interface MoveGrant {
  limit: number | "half" | "speed";
  noProvoke: boolean;
  /** What grants it (`Scurry`). */
  from: string;
}

/**
 * The move a card's text grants: "moves up to 15 feet", "up to half your
 * speed", "up to your speed" — "without provoking" opportunity attacks, or
 * not. (A Dash doubles the round's speed instead — not a move of its own.)
 */
export function parseMoveGrant(name: string, text: string | undefined): MoveGrant | undefined {
  if (!text || /^dash$/i.test(name.trim())) return undefined;
  const noProvoke = /without provoking/i.test(text);
  const feet = text.match(/\bmoves?\s+up\s+to\s+(\d+)\s*(?:feet|ft)/i);
  if (feet) return { limit: parseInt(feet[1], 10), noProvoke, from: name };
  if (/\bup\s+to\s+half\s+(?:your|its|their)\s+speed/i.test(text)) return { limit: "half", noProvoke, from: name };
  if (/\bmoves?\s+up\s+to\s+(?:your|its|their)\s+speed/i.test(text)) return { limit: "speed", noProvoke, from: name };
  return undefined;
}

/** A grant's limit in feet, for a creature of that speed. */
export const grantFeet = (grant: MoveGrant, speed?: number): number | undefined =>
  typeof grant.limit === "number"
    ? grant.limit
    : speed == null
      ? undefined
      : grant.limit === "half"
        ? Math.floor(speed / 2)
        : speed;

/** One move, read against the rules. */
export interface MoveCheck {
  /** Who moved, as placed. */
  name: string;
  /** Feet this move walked. */
  feet: number;
  /** Feet walked in the creature's round so far, this move included. */
  spent: number;
  /** What it may walk this round — its speed, doubled by a Dash. */
  allowance?: number;
  /** A condition that holds it at speed 0 (`grappled`). */
  held?: string;
  /** The hostile creatures whose reach it left. */
  provokes: string[];
  /** Granted by an effect — held to its limit, not the round's speed. */
  granted?: string;
  /** A plain move outside the creature's own round, nothing granting it. */
  offTurn?: boolean;
}

/** Feet a route costs, square by square. */
export function routeFeet(path: Square[], map?: Pick<SquareMap, "scale" | "cells" | "legend" | "diagonals">): number {
  const scale = map?.scale || 5;
  let feet = 0;
  let diagonals = 0;
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const steps = squareDistance(a, b);
    if (steps === 0) continue;
    // A square to square leap over several (`E3` straight from `K12`) costs each square crossed.
    const diagonal = a.col !== b.col && a.row !== b.row;
    let cost = steps * scale;
    if (diagonal && map?.diagonals === "alternate") {
      const diag = Math.min(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
      for (let d = 0; d < diag; d++) if (++diagonals % 2 === 0) cost += scale;
    }
    const key = map?.cells?.[b.row]?.[b.col];
    if (key && map?.legend?.[key]?.difficult) cost *= 2;
    feet += cost;
  }
  return feet;
}

/**
 * The hostile creatures whose reach a route leaves — each step from a square
 * within a creature's reach to one outside it. Those that are down threaten no one.
 */
export function provokedBy(
  path: Square[],
  mover: MoverInfo,
  others: BattlePlacement[],
  info: (name: string) => MoverInfo,
  scale = 5,
  isDown: (name: string) => boolean = () => false
): string[] {
  const out: string[] = [];
  for (const other of others) {
    const them = info(other.name);
    if (them.foe === mover.foe || isDown(other.name)) continue;
    const reach = Math.max(1, Math.round(them.reach / (scale || 5)));
    const left = path.some(
      (sq, i) => i > 0 && squareDistance(path[i - 1], other.at) <= reach && squareDistance(sq, other.at) > reach
    );
    if (left && !out.includes(other.name)) out.push(other.name);
  }
  return out;
}

const keyOf = (name: string) =>
  combatantKey(name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string) => t));

/**
 * Every move in a fight, read against the rules — by the entry it was made in.
 * `info(name)` gives a combatant's speed, reach and side; `roundOf(name, id)`
 * the round it moves in (where it began) and whether it Dashed or Disengaged
 * in it by then; `downAt(name, id)` whether it's out of the fight (0 HP) then.
 */
export function checkMoves(
  battle: Battle,
  map: SquareMap | undefined,
  info: (name: string) => MoverInfo,
  roundOf: (
    name: string,
    id: number
  ) => { dashed: boolean; disengaged: boolean; start: number; current: boolean } | undefined,
  downAt: (name: string, id: number) => boolean = () => false,
  grantOf: (name: string, id: number) => MoveGrant | undefined = () => undefined
): Map<number, MoveCheck[]> {
  const out = new Map<number, MoveCheck[]>();
  let before: BattlePlacement[] = battle.opening;
  const spentIn = new Map<string, { start: number; feet: number }>();
  for (const frame of battle.frames) {
    const checks: MoveCheck[] = [];
    // Where everyone stands as the entry begins; a move updates its mover.
    const at = new Map(before.map((p) => [keyOf(p.name), p]));
    for (const move of frame.moves) {
      const key = keyOf(move.name);
      const me = info(move.name);
      const round = roundOf(move.name, frame.id);
      const feet = routeFeet(move.path, map);
      // A move an effect grants keeps to its own limit; a plain one spends the
      // round's speed — in its own round, or is said to be outside it.
      const grant = grantOf(move.name, frame.id);
      const own = !grant && !!round?.current;
      const prior = spentIn.get(key);
      const spent = grant ? feet : (prior && round && prior.start === round.start ? prior.feet : 0) + feet;
      if (own && round) spentIn.set(key, { start: round.start, feet: spent });
      const held = (frame.conditions[key] ?? []).find((c) => SPEED_ZERO.has(c));
      // Each step out of a hostile creature's reach — unless it Disengaged.
      const out = (name: string) =>
        (frame.conditions[keyOf(name)] ?? []).some(
          (c) => c === "unconscious" || c === "dead" || c === "incapacitated"
        ) || downAt(name, frame.id);
      const others = [...at].filter(([k]) => k !== key).map(([, p]) => p);
      const provokes =
        round?.disengaged || grant?.noProvoke ? [] : provokedBy(move.path, me, others, info, map?.scale, out);
      const allowance = grant
        ? grantFeet(grant, me.speed)
        : own && me.speed != null
          ? me.speed * (round?.dashed ? 2 : 1)
          : undefined;
      const last = move.path[move.path.length - 1];
      if (last) at.set(key, { name: move.name, at: last });
      checks.push({
        name: move.name,
        feet,
        spent,
        ...(allowance != null ? { allowance } : {}),
        ...(held ? { held } : {}),
        provokes,
        ...(grant ? { granted: grant.from } : {}),
        ...(!grant && round && !round.current ? { offTurn: true } : {}),
      });
    }
    if (checks.length > 0) out.set(frame.id, checks);
    before = frame.placements;
  }
  return out;
}
