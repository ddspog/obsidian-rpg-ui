/**
 * A Multiattack — one action holding several attacks — as the log writes it:
 * an opener line, then each attack an entry of its own (its own target, so its
 * AC, hit, damage and map arrow stay its own), and one outcome for them all:
 *
 *   @(Kobold, Tinkerer) @[[Kobold, Tinkerer]].action("Multiattack")
 *   @(Kobold, Tinkerer) @[[Kobold, Tinkerer]].action("Parts-Filled Sling") → Jacqui
 *   d: Attack | d20+4= vs AC ->
 *   d: Damage | 1d4+2=
 *   @(Kobold, Tinkerer) @[[Kobold, Tinkerer]].action("Parts-Filled Sling") → Talon
 *   d: Attack | d20+4= vs AC ->
 *   d: Damage | 1d4+2=
 *   => The tinkerer hurled a tin canister of jagged scrap…
 *
 * How many attacks, and which, the statblock says: "makes two Tinkerer's
 * Hammer or Parts-Filled Sling attacks".
 */

/** What a Multiattack allows: its attacks' count, and the attacks it may make. */
export interface MultiattackSpec {
  count: number;
  attacks: string[];
  /**
   * The fixed mix, when the first wording counts every attack one by one ("makes two Spiked Club
   * attacks and one Shield Smash attack"): each attack with its count, adding up to `count`. Absent
   * for a free mix ("two Scimitar or Shortbow attacks" may be picked in any share).
   */
  picks?: Array<{ name: string; count: number }>;
}

const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/**
 * A Multiattack's text read for its attacks: `makes two Rapier attacks`,
 * `makes two Tinkerer's Hammer or Parts-Filled Sling attacks`, `makes one Bite
 * attack and two Claw attacks` (three, of either). Undefined when it names none.
 */
export function parseMultiattack(text: string): MultiattackSpec | undefined {
  const whole = text.match(/\bmakes\s+([^.]+)/i)?.[1];
  if (!whole) return undefined;
  // "makes three Greatsword attacks, or it makes four Javelin attacks": alternatives, not a sum.
  // The count is the first one's; every attack named in any of them may be picked.
  const [first, ...others] = whole.split(/,?\s+or\s+(?:it|they|the [\w' -]+?)\s+makes\s+/i);
  let count = 0;
  const attacks: string[] = [];
  const picks: Array<{ name: string; count: number }> = [];
  let fixed = true;
  for (const body of [first, ...others]) {
    const counted = body === first;
    for (const m of body.matchAll(/\b(one|two|three|four|five|six|\d+)\s+(.+?)\s+attacks?\b/gi)) {
      const n = (NUMBERS[m[1].toLowerCase()] ?? parseInt(m[1], 10)) as number;
      if (counted) count += n;
      const names = m[2].split(/\s*,\s*|\s+or\s+/i);
      // A clause naming a choice ("two Scimitar or Shortbow attacks") makes the mix free.
      if (counted && names.length > 1) fixed = false;
      if (counted && names.length === 1) {
        picks.push({ name: names[0].replace(/^(?:with\s+)?(?:its|their|a|an)\s+/i, "").trim(), count: n });
      }
      for (const name of names) {
        const cleaned = name.replace(/^(?:with\s+)?(?:its|their|a|an)\s+/i, "").trim();
        if (cleaned && !attacks.some((a) => a.toLowerCase() === cleaned.toLowerCase())) attacks.push(cleaned);
      }
    }
  }
  if (count === 0) return undefined;
  const fixedMix =
    fixed && picks.length > 0 && picks.every((p) => p.name) && picks.reduce((s, p) => s + p.count, 0) === count;
  return { count, attacks, ...(fixedMix ? { picks } : {}) };
}

/** One attack of a Multiattack, as picked: its card's template, and at whom. */
export interface Strike {
  template: string;
  target: string;
}

/**
 * The Multiattack's lines: its opener, each attack's own entry aimed at its
 * target (a bare `vs AC` — the Log reads the target's), then the opener's
 * outcome line, shared by them all.
 */
export function composeMultiattack(template: string, strikes: Strike[]): string {
  const lines = template.split("\n");
  const at = lines.findIndex((l) => /^\s*=>/.test(l));
  const head = at < 0 ? lines : lines.slice(0, at);
  const tail = at < 0 ? [] : lines.slice(at);
  const blocks = strikes
    .filter((s) => s.target.trim())
    .map((s) => s.template.replace(/\{\{target\}\}/g, s.target.trim()).replace(/\s*\{\{target_ac\??\}\}/g, ""));
  return [...head, ...blocks, ...tail].join("\n");
}
