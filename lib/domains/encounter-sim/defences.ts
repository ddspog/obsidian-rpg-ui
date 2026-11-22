/**
 * A creature's damage resistances, immunities and vulnerabilities, and the
 * conditions it is immune or resistant to, as the simulator applies them. A
 * statblock writes them as types and conditions ("fire, cold | charmed") or
 * names a trait that grants them ("Undead Resilience"), whose text says what
 * it covers ("immune to poison and psychic damage, and to the charmed and
 * poisoned conditions"). Pure: no Obsidian and no I/O.
 */

import { CONDITIONS, DAMAGE_TYPES } from "lib/domains/statblocks/monster-template";
import { parseDefences } from "lib/domains/statblocks/template-block";
import type { Defences, ModelledCondition } from "./types";

const empty = (): Defences => ({
  resistant: [],
  immune: [],
  vulnerable: [],
  conditionImmune: [],
  conditionResistant: [],
});

const add = (list: string[], items: string[]) => {
  for (const i of items) if (!list.includes(i)) list.push(i);
};

/** "bludgeoning, piercing, and slashing damage from nonmagical attacks": the three, from weapons only. */
const NONMAGICAL = /damage from nonmagical/i;

/**
 * What one sentence of a trait grants: "is resistant to cold and fire damage", "immune to poison and psychic
 * damage, and it is immune to exhaustion and the charmed, frightened … conditions", "vulnerable to radiant
 * damage", "resistant to exhaustion and to the frightened condition".
 */
function fromText(text: string, out: Defences): void {
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    for (const m of sentence.matchAll(
      /\b(resistant|immune|vulnerable)\s+to\s+([^.;]*?)(?=(?:,?\s+and\s+(?:it\s+)?is\s+)|[.;]|$)/gi
    )) {
      const kind = m[1].toLowerCase();
      const words = m[2].toLowerCase();
      const damage = DAMAGE_TYPES.filter((t) => new RegExp(`\\b${t}\\b`).test(words));
      const conditions = CONDITIONS.filter((c) => new RegExp(`\\b${c}\\b`).test(words));
      if (NONMAGICAL.test(words)) add(kind === "immune" ? out.immune : out.resistant, ["nonmagical"]);
      // Damage types count when the words speak of damage; a list of conditions alone grants no damage defence.
      if (/\bdamage\b/.test(words) || conditions.length === 0) {
        add(kind === "immune" ? out.immune : kind === "resistant" ? out.resistant : out.vulnerable, damage);
      }
      if (kind === "immune") add(out.conditionImmune, conditions);
      if (kind === "resistant") add(out.conditionResistant, conditions);
    }
  }
}

/**
 * A creature's defences from its three lines (`resistant`, `immune`, `vulnerable`) and the text of the traits
 * the lines name (`traitText("Undead Resilience")`, undefined when it has none).
 */
export function defencesOf(
  lines: { resistant?: unknown; immune?: unknown; vulnerable?: unknown },
  traitText: (name: string) => string | undefined
): Defences {
  const out = empty();
  for (const kind of ["resistant", "immune", "vulnerable"] as const) {
    const parsed = parseDefences(lines[kind]);
    // "bludgeoning, piercing, and slashing damage from nonmagical attacks" is one defence, not three plain ones.
    const nonmagical = parsed.damage.some((d) => NONMAGICAL.test(d));
    const damage = parsed.damage
      .filter((d) => !(nonmagical && ["bludgeoning", "piercing", "slashing"].includes(d)))
      .map((d) => (NONMAGICAL.test(d) ? "nonmagical" : d));
    add(kind === "immune" ? out.immune : kind === "resistant" ? out.resistant : out.vulnerable, damage);
    if (kind === "immune") add(out.conditionImmune, parsed.conditions);
    if (kind === "resistant") add(out.conditionResistant, parsed.conditions);
    for (const name of parsed.other) {
      const text = traitText(name);
      if (text) fromText(text, out);
    }
  }
  return out;
}

/** Nothing to apply. */
export function noDefences(d: Defences | undefined): boolean {
  return !d || Object.values(d).every((list) => list.length === 0);
}

/**
 * The damage a creature takes of a type: none when immune, half (rounded down) when resistant, double when
 * vulnerable. "nonmagical" covers bludgeoning, piercing and slashing from a weapon (a PC's weapons count as
 * nonmagical; the simulator does not know a magic weapon).
 */
export function applyDefences(
  amount: number,
  type: string | undefined,
  d: Defences | undefined,
  weapon: boolean
): number {
  if (!d || !type || amount <= 0) return amount;
  const t = type.toLowerCase();
  const bps = weapon && ["bludgeoning", "piercing", "slashing"].includes(t);
  if (d.immune.includes(t) || (bps && d.immune.includes("nonmagical"))) return 0;
  let out = amount;
  if (d.resistant.includes(t) || (bps && d.resistant.includes("nonmagical"))) out = Math.floor(out / 2);
  if (d.vulnerable.includes(t)) out *= 2;
  return out;
}

/** Whether a condition can land on it at all. */
export function immuneTo(d: Defences | undefined, condition: ModelledCondition): boolean {
  return !!d?.conditionImmune.includes(condition);
}
