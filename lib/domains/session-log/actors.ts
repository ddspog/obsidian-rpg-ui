/**
 * Match a lonelog actor (`@(Talon)`, `d(Talon):`) to one of the note's PCs.
 *
 * A log names characters the way people talk — `Talon`, not `Talon Pallton` —
 * so a name matches a PC by, in order: its full name, one of its `aliases`, or
 * its first name. Each step only counts when exactly one PC fits; an ambiguous
 * first name (two PCs called "Kai") matches nobody rather than the wrong one.
 */

export interface ActorCandidate {
  /** The PC's note name (`Talon Pallton`). */
  name: string;
  /** Frontmatter `aliases`. */
  aliases?: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** The index of the PC `actor` names, or -1 when none (or several) fit. */
export function matchActor(actor: string, candidates: ActorCandidate[]): number {
  const want = norm(actor);
  if (!want) return -1;
  const tests: Array<(c: ActorCandidate) => boolean> = [
    (c) => norm(c.name) === want,
    (c) => (c.aliases ?? []).some((a) => norm(a) === want),
    (c) => norm(c.name).split(/\s+/)[0] === want,
  ];
  for (const test of tests) {
    const hits = candidates.flatMap((c, i) => (test(c) ? [i] : []));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return -1;
  }
  return -1;
}

/**
 * The name each PC goes by in a log — its first name (`Talon` for
 * `Talon Pallton`), the way a player writes `@(Talon)` — unless another PC
 * shares that first name, in which case the full name keeps them apart.
 */
export function logNames(names: string[]): Map<string, string> {
  const first = (n: string) => n.trim().split(/\s+/)[0];
  const counts = new Map<string, number>();
  for (const n of names) counts.set(first(n).toLowerCase(), (counts.get(first(n).toLowerCase()) ?? 0) + 1);
  return new Map(names.map((n) => [n, counts.get(first(n).toLowerCase()) === 1 ? first(n) : n]));
}
