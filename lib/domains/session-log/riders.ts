/**
 * Riders — what goes WITH an attack rather than being an action of its own:
 * Mystic Mark's extra die and the mark it leaves. An attack card that carries
 * one writes it into the attack:
 *
 *   @(Talon) @[[Talon Pallton|Talon]].action("Shortbow") → Fat Kobold, A with @[[Talon Pallton|Talon]].action("Mystic Mark")
 *   d: Attack | d20+6= vs AC ->
 *   d: Piercing damage | 1d8+4=
 *   d: Mystic Mark damage | 1d4=
 *   => [F:Fat Kobold, A|+marked] [Talon/Mystic Mark-1]
 *
 * Its damage is another damage roll (so a hit counts it), and its mark is the
 * target's condition — so a later attack on a marked target carries the rider
 * free: its die, with no use spent and no new mark. Marking one creature lifts
 * the mark from any other.
 *
 * A martial action taken with the attack rides the same way — Wind Up's PB on
 * the weapon's own damage (same type: `1d10+4+2=`), Aim's PB on the attack
 * roll (`d20+5+2=`) — and is an action of its own (a bonus action), spent hit
 * or miss: see {@link onAMiss}.
 */

import { actionCall, findActionCalls } from "./action-call";
import type { CardRider } from "./card-types";

export interface RiderPlay {
  rider: CardRider;
  /** Riding free: the target already bears its mark. */
  free: boolean;
}

export interface RiderContext {
  /** Who attacks, as the log names them (`Talon`) — whose uses a cost spends. */
  actor: string;
  /** Whether the target is a foe (`[F:…]`) or one of the party (`[PC:…]`). */
  targetIsFoe: boolean;
  /** Who bears each mark now (`marked` → `Thin Kobold, A`), so it moves. */
  markedNow?: (mark: string) => string[];
}

const isDamageLine = (line: string) => /^d(?:\([^)]*\))?:\s*[^|]*damage/i.test(line.trim());
const isRollLine = (line: string) => /^d(?:\([^)]*\))?:/.test(line.trim());

/** An attack card's template with the riders it carries written in. */
export function withRiders(template: string, plays: RiderPlay[], ctx: RiderContext): string {
  if (plays.length === 0) return template;
  const lines = template.split("\n");
  const at = lines.findIndex((l) => l.trimStart().startsWith("@("));
  if (at < 0) return template;

  // `with Mystic Mark` — a call on the same page the attack names, when it names one.
  const call = findActionCalls(lines[at])[0];
  const named = plays.map((p) => (call ? actionCall(call.page, p.rider.name, call.label) : p.rider.name));
  lines[at] = `${lines[at].trimEnd()} with ${named.join(" and ")}`;

  // What it adds to the attack roll (Aim): on the roll itself.
  const hit = plays
    .filter((p) => p.rider.hit)
    .map((p) => `+${p.rider.hit}`)
    .join("");
  if (hit) {
    const roll = lines.findIndex((l) => /^d(?:\([^)]*\))?:\s*attack\b/i.test(l.trim()));
    if (roll >= 0) lines[roll] = lines[roll].replace(/(\|\s*[^=]*?)=/, `$1${hit}=`);
  }

  // A flat amount (Wind Up's PB) is more of the weapon's own damage, same type.
  const flat = plays
    .filter((p) => p.rider.damage && /^\d+$/.test(p.rider.damage))
    .map((p) => `+${p.rider.damage}`)
    .join("");
  if (flat) {
    let weapon = -1;
    lines.forEach((l, i) => {
      if (isDamageLine(l) && weapon < 0) weapon = i;
    });
    if (weapon >= 0) lines[weapon] = lines[weapon].replace(/(\|\s*[^=]*?)=/, `$1${flat}=`);
  }

  // Its own damage dice (Mystic Mark's 1d4), after the attack's own.
  const damage = plays
    .filter((p) => p.rider.damage && !/^\d+$/.test(p.rider.damage))
    .map((p) => `d: ${p.rider.name} damage | ${p.rider.damage}=`);
  if (damage.length > 0) {
    let after = -1;
    lines.forEach((l, i) => {
      if (isDamageLine(l)) after = i;
    });
    if (after < 0) lines.forEach((l, i) => (isRollLine(l) ? (after = i) : undefined));
    lines.splice((after < 0 ? at : after) + 1, 0, ...damage);
  }

  // The mark it leaves (lifted from whoever bore it), and the uses it spends.
  const tags: string[] = [];
  const kind = ctx.targetIsFoe ? "F" : "PC";
  for (const { rider, free } of plays) {
    if (free) continue;
    if (rider.mark) {
      for (const other of ctx.markedNow?.(rider.mark) ?? []) tags.push(`[F:${other}|-${rider.mark}]`);
      tags.push(`[${kind}:{{target}}|+${rider.mark}]`);
    }
    if (rider.cost) tags.push(`[${ctx.actor}/${rider.cost.resource}-${rider.cost.amount}]`);
  }
  if (tags.length > 0) lines.push(`=> ${tags.join(" ")}`);
  return lines.join("\n");
}

/**
 * The riders an attack keeps on a miss: one that's an action of its own (Wind
 * Up's bonus action) was spent all the same — its call and its to-hit stay,
 * its damage goes. The rest (Mystic Mark) only ride a hit.
 */
export function onAMiss(plays: RiderPlay[]): RiderPlay[] {
  return plays
    .filter((p) => p.rider.takes)
    .map((p) => ({ ...p, rider: { ...p.rider, damage: undefined } as CardRider }));
}
