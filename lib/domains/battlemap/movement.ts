/**
 * Moving as part of an action, during a fight.
 *
 *   @(Talon) Shortsword → Kobold, Elite [Mv: K12>L10]
 *
 * Outside a fight nobody's position matters, so a card only offers a move while
 * the log is inside an open `[COMBAT]`. What's typed (`k12 > l10`) is tidied
 * into a route and written on the card's action line as an `[Mv:]` tag — the
 * one the battle map replays.
 */

import { combatantKey } from "lib/domains/session-log/initiative";
import { matchActor } from "lib/domains/session-log/actors";
import type { ProseSegment } from "lib/domains/session-log/prose-grouper";
import type { Battle } from "./battle";
import { parseSquare, squareName, type SquareMap } from "./square-map";

/**
 * A typed route, tidied: squares joined by `>` (`g4 > f4` → `G4>F4`). Blank
 * stays blank (no move); anything that isn't a route of squares is null.
 */
export function normalizeRoute(input: string): string | null {
  const steps = input
    .split(/[>,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (steps.length === 0) return "";
  const squares = steps.map(parseSquare);
  return squares.every((s) => s != null) ? squares.map((s) => squareName(s!)).join(">") : null;
}

/** A card's text with a move BEFORE its action — on its action line, ahead of
 *  the action's words: `@(Talon) [Mv: K11] Shortsword → Kobold`. */
export function withMove(text: string, route: string): string {
  const tidy = normalizeRoute(route);
  if (!tidy) return text;
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.trimStart().startsWith("@("));
  if (at < 0) return text;
  lines[at] = lines[at].replace(/^(\s*@\([^)]*\))\s*/, `$1 [Mv: ${tidy}] `);
  return lines.join("\n");
}

/** A card's text with a move AFTER its action — at the end of its action
 *  line: `@(Talon) Shortsword → Kobold [Mv: J14]`. */
export function withMoveAfter(text: string, route: string): string {
  const tidy = normalizeRoute(route);
  if (!tidy) return text;
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.trimStart().startsWith("@("));
  if (at < 0) return text;
  lines[at] = `${lines[at].trimEnd()} [Mv: ${tidy}]`;
  return lines.join("\n");
}

/** Whether the log ends inside a fight: a `[COMBAT]` not yet closed. */
export function combatOpen(segments: ProseSegment[]): boolean {
  let open = false;
  for (const seg of segments) {
    if (seg.type === "combat-start") open = true;
    else if (seg.type === "combat-end") open = false;
  }
  return open;
}

/**
 * Where an actor stands now: in the open fight's latest frame, else the map's
 * default spot for them. Undefined when the fight has no map or they aren't on it.
 */
export function squareNow(battles: Battle[], maps: Record<string, SquareMap>, actor: string): string | undefined {
  const battle = battles[battles.length - 1];
  if (!battle || battle.end != null) return undefined;
  const last = battle.frames[battle.frames.length - 1];
  const placed = last?.placements.length
    ? last.placements
    : battle.opening.length
      ? battle.opening
      : Object.entries(maps[battle.map]?.tokens ?? {}).map(([name, at]) => ({ name, at }));
  const key = combatantKey(actor);
  const exact = placed.find((p) => combatantKey(p.name) === key);
  if (exact) return squareName(exact.at);
  const i = matchActor(
    actor,
    placed.map((p) => ({ name: combatantKey(p.name) }))
  );
  return i >= 0 ? squareName(placed[i].at) : undefined;
}
