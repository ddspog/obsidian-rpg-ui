/**
 * Spells cast with a slot, and the conditions they leave behind.
 *
 *   @(Kowyn) @[[Kowyn]].action("Icicle Javelin º") → Fat Kobold, A
 *   d: Attack | d20+6= vs AC ->
 *   d: Cold damage | 4d8=                       ← cast at the 2nd circle
 *   => [Kowyn/2nd-Circle Slot-1]                 ← the slot it spent
 *   => [F:{{target}}|+pinned([[Icicle Javelin º]])] ← what it left, on a hit
 *
 * A slot is a resource like any other (`[Character/Resource-n]`), so the log
 * keeps count of what's left to strike off the sheet. A condition a spell
 * leaves (`pinned`) gives whoever bears it a STATUS card: the save that shakes
 * it off, and — on a success — the line that frees them. The tag names what
 * left it, so the card reads that source's rules; a condition the system knows
 * (`restrained`) brings its own rules too, and one it doesn't (`pinned`) is
 * only that source's effect.
 */

import { parseDamage } from "./session-actions";
import type { SessionFeatureCard } from "./card-types";

/** `1` → `1st`, `2` → `2nd`, `3` → `3rd`, `4` → `4th`. */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** The slot a circle spends, as the log names it: `2nd-Circle Slot`. */
export const slotName = (circle: number) => `${ordinal(circle)}-Circle Slot`;

/**
 * A spell card's template cast at a circle: its damage dice that circle's
 * (`3d8` → `4d8`), and the slot it spends — spent whether it hits or not.
 */
export function withCast(
  template: string,
  cast: { circle: number; damage: Record<number, string> },
  circle: number,
  actor: string
): string {
  const base = parseDamage(cast.damage[cast.circle])?.dice;
  const chosen = parseDamage(cast.damage[circle])?.dice;
  let out = template;
  if (base && chosen && base !== chosen) {
    out = out
      .split("\n")
      .map((l) => (/^d(?:\([^)]*\))?:\s*[^|]*damage/i.test(l.trim()) ? l.replace(base, chosen) : l))
      .join("\n");
  }
  return `${out.trimEnd()}\n=> [${actor}/${slotName(circle)}-1]`;
}

/** A card's template with the condition it leaves on its target, on a hit — and what left it. */
export function withInflict(template: string, condition: string, targetIsFoe: boolean, from?: string): string {
  return `${template.trimEnd()}\n=> [${targetIsFoe ? "F" : "PC"}:{{target}}|+${condition}${from ? `([[${from}]])` : ""}]`;
}

const titled = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The status card for one condition a creature bears: the save that shakes it
 * off, against a DC asked for (the caster's), and — on a success — the line
 * that frees them. With no save to make, it's the line that ends it.
 */
export function statusCard(opts: {
  actor: string;
  isFoe: boolean;
  condition: string;
  /** How it's shaken off, as the spell that left it says. */
  save?: string;
  when?: string;
  fail?: string;
  /** What the bearer adds to that save (`+2`), when known. */
  modifier?: number;
  from?: string;
  /** The condition's own rules, when the system knows it (`restrained`). */
  rules?: string[];
}): SessionFeatureCard {
  const ability = (opts.save ?? "").toUpperCase();
  const mod = opts.modifier ? (opts.modifier < 0 ? `${opts.modifier}` : `+${opts.modifier}`) : "";
  const tag = `[${opts.isFoe ? "F" : "PC"}:{{actor}}|-${opts.condition}]`;
  const escape = opts.save != null || opts.when != null || opts.fail != null;
  const how = [
    opts.when ? `${titled(opts.when)}, ` : "",
    ability ? `a ${ability} save` : "a save",
    opts.fail ? `; on a failure, ${opts.fail}` : "",
  ].join("");
  const what = opts.rules
    ? opts.rules.join(" ")
    : opts.from
      ? `Not a condition of its own — an effect of ${opts.from}.`
      : undefined;
  return {
    id: `status:${opts.actor}:${opts.condition}`,
    name: titled(opts.condition),
    bucket: "status",
    logTemplate: escape
      ? [
          `@({{actor}}) Struggles against being ${opts.condition}`,
          `d: ${ability ? `${ability} save` : "Save"} | d20${mod}= vs DC {{dc}} ->`,
        ].join("\n")
      : [`@({{actor}}) Is no longer ${opts.condition}`, `=> ${tag}`].join("\n"),
    summary: escape
      ? `${titled(opts.condition)}${opts.from ? ` (${opts.from})` : ""}: ${how}. A success frees them.`
      : `${titled(opts.condition)}${opts.from ? ` (${opts.from})` : ""}: ends it.`,
    ...(what ? { text: what } : {}),
    icon: "⛓️",
    source: "status",
    actor: opts.actor,
    ...(escape ? { status: { condition: opts.condition, onSuccess: `=> ${tag}` } } : {}),
  };
}
