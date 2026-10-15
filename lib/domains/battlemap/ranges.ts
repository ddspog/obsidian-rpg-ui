/**
 * How far an attack or a spell reaches, and what that means for a target at a
 * distance — said on the card as it's aimed, never blocking:
 *
 *   90 ft.          a spell: in range up to 90 ft
 *   150/600 ft.     a ranged weapon: normal to 150, long (disadvantage) to 600
 *   reach 10 ft.    a melee attack: within 10 ft
 *   Self (15-ft cube), Touch
 *
 * A ranged attack with a hostile creature within 5 ft of the attacker (one
 * that isn't down) is made at disadvantage too.
 */

/** A range as its source writes it, read. */
export type Range =
  | { kind: "reach"; feet: number }
  | { kind: "ranged"; normal: number; long?: number }
  | { kind: "self"; area?: number }
  | { kind: "touch" };

/** `90 ft.`, `150/600 ft.`, `reach 10 ft.`, `≤30 ft.`, `Self (15-ft cube)`, `Touch`. */
export function parseRange(raw: string | undefined, melee = false): Range | undefined {
  const text = (raw ?? "").trim();
  if (!text || text === "-") return undefined;
  if (/^touch\b/i.test(text)) return { kind: "touch" };
  const self = text.match(/^self\b(?:\s*\((\d+)\s*-?\s*(?:ft|foot|feet))?/i);
  if (self) return self[1] ? { kind: "self", area: parseInt(self[1], 10) } : { kind: "self" };
  const reach = text.match(/reach\s*(\d+)/i);
  if (reach) return { kind: "reach", feet: parseInt(reach[1], 10) };
  const pair = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (pair) return { kind: "ranged", normal: parseInt(pair[1], 10), long: parseInt(pair[2], 10) };
  const one = text.match(/(\d+)\s*(?:ft|feet|foot)/i);
  if (one)
    return melee ? { kind: "reach", feet: parseInt(one[1], 10) } : { kind: "ranged", normal: parseInt(one[1], 10) };
  return undefined;
}

/** What a distance means for a range. */
export interface RangeVerdict {
  /** `in` range; at `long` range (disadvantage); `out` of it. */
  status: "in" | "long" | "out";
  /** A sentence for the card: `40 ft — in range (90 ft)`. */
  text: string;
  /** Rolled at disadvantage (long range, or a hostile next to a ranged attacker). */
  disadvantage: boolean;
}

/**
 * A target `feet` away, read against a range; `crowded` names the hostile
 * creatures within 5 ft of a ranged attacker.
 */
export function rangeVerdict(range: Range, feet: number, crowded: string[] = []): RangeVerdict {
  const crowd = crowded.length > 0 ? ` · ${crowded.join(", ")} within 5 ft: disadvantage` : "";
  switch (range.kind) {
    case "touch":
      return feet <= 5
        ? { status: "in", text: `${feet} ft — within touch`, disadvantage: false }
        : { status: "out", text: `${feet} ft — out of touch (5 ft): move first`, disadvantage: false };
    case "reach":
      return feet <= range.feet
        ? { status: "in", text: `${feet} ft — within reach (${range.feet} ft)`, disadvantage: false }
        : { status: "out", text: `${feet} ft — out of reach (${range.feet} ft): move first`, disadvantage: false };
    case "self":
      if (range.area == null) return { status: "in", text: `${feet} ft — around its caster`, disadvantage: false };
      return feet <= range.area
        ? { status: "in", text: `${feet} ft — inside its ${range.area}-ft area`, disadvantage: false }
        : { status: "out", text: `${feet} ft — outside its ${range.area}-ft area`, disadvantage: false };
    case "ranged": {
      const span = range.long ? `${range.normal}/${range.long} ft` : `${range.normal} ft`;
      if (feet <= range.normal) {
        return { status: "in", text: `${feet} ft — in range (${span})${crowd}`, disadvantage: crowded.length > 0 };
      }
      if (range.long && feet <= range.long) {
        return { status: "long", text: `${feet} ft — long range (${span}): disadvantage${crowd}`, disadvantage: true };
      }
      return { status: "out", text: `${feet} ft — out of range (${span}): move first`, disadvantage: false };
    }
  }
}
