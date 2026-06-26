/**
 * Mythic Fate Chart oracle: interpret a selected odds cell against a die roll.
 *
 * An odds cell carries three thresholds, rendered as `$^{a}\;b\;^{c}$`, which
 * split a d100 into four ordered periods → four answers (Exceptional Yes /
 * Yes / No / Exceptional No):
 *
 *     1 … a      Exceptional Yes   (a = left superscript; ExYes ceiling)
 *     a+1 … b    Yes               (b = middle; Yes ceiling)
 *     b+1 … c-1  No                (the gap)
 *     c … 100    Exceptional No    (c = right superscript; ExNo floor)
 *
 * `x` in a slot means that bound is absent and its period collapses (e.g.
 * `^{x} 1 ^{81}` → no Exceptional Yes; `^{20} 99 ^{x}` → no Exceptional No).
 */

/**
 * Extract the ordered numeric thresholds from an odds cell's raw value
 * (`$^{10}\;50\;^{91}$` → `[10, 50, 91]`). An `x` token → `null` (absent
 * bound). Reads every `\d+`/`x` token in order, so it's agnostic to the exact
 * math wrapping.
 */
export function parseOracleThresholds(raw: string): Array<number | null> {
  const out: Array<number | null> = [];
  const re = /\d+|x/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push(m[0].toLowerCase() === "x" ? null : parseInt(m[0], 10));
  }
  return out;
}

/**
 * Roll a dice spec — `dN` (1…N) or `MdN` (sum of M dice). Falls back to a
 * d100 for an unparseable spec. `rand` is `Math.random`-shaped for tests.
 */
export function rollDice(spec: string, rand: () => number = Math.random): number {
  const m = spec.trim().match(/^(\d*)d(\d+)$/i);
  if (!m) return Math.floor(rand() * 100) + 1;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  if (sides <= 0) return Math.floor(rand() * 100) + 1;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(rand() * sides) + 1;
  return total;
}

/**
 * Map a roll to one of `answers` using the Mythic 3-threshold structure:
 * `roll ≤ a` → answers[0] (Exceptional Yes), `≤ b` → answers[1] (Yes),
 * `≥ c` → answers[3] (Exceptional No), otherwise answers[2] (No). `null`
 * thresholds skip their check (collapsing that period).
 */
export function interpretOracle(roll: number, thresholds: Array<number | null>, answers: string[]): string {
  const [a, b, c] = thresholds;
  if (a != null && roll <= a) return answers[0] ?? "";
  if (b != null && roll <= b) return answers[1] ?? "";
  if (c != null && roll >= c) return answers[3] ?? "";
  return answers[2] ?? "";
}
