/**
 * Inline choice token — `[opt1/opt2/opt3 - selected]`.
 *
 * A small in-log control: options separated by `/`, then ` - `, then the current
 * selection (empty until picked). Rendered as a dropdown in the Log sidebar /
 * feature example (see formula.tsx → ChoiceSelect). Used for a GM follow-up like
 * `-> Altered Scene [The Next Expectation/A Tweak/Fate Question - ]`.
 *
 * The ` - ` (space-dash-space) separator distinguishes it from lonelog tags
 * (`[CF:5]`, `[N:Name|tags]`) and wikilinks (`[[Foo]]`), which never use it.
 */

export interface ChoiceToken {
  options: string[];
  selected: string;
  /** The full matched token text, e.g. `[a/b/c - b]`. */
  raw: string;
}

const CHOICE_RE = /\[([^\][]+?)\s+-\s+([^\][]*?)\]/;

/** Joins a pick to the pick it was made under (`Anglish › Masculine name`), so the same option
 *  name under two parents (every style has a `Masculine name`) means two different things. */
export const NESTED_SEP = " › ";

/** Which line holds the dropdown being picked: its text, and which of the identical lines it is. */
export interface ChoiceAt {
  source: string;
  nth: number;
}

/**
 * Split a result string into a leading text part and an optional trailing choice
 * token. `"Altered Scene [a/b/c - ]"` → `{ before: "Altered Scene", choice }`.
 */
export function splitResultChoice(result: string): { before: string; choice: ChoiceToken | null } {
  const m = result.match(CHOICE_RE);
  if (!m) return { before: result, choice: null };
  const options = m[1]
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (options.length === 0) return { before: result, choice: null };
  return {
    before: result.slice(0, m.index).trim(),
    choice: { options, selected: m[2].trim(), raw: m[0] },
  };
}

/** Rebuild a result string from its leading text + a (re)selected choice token. */
export function buildResultChoice(before: string, options: string[], selected: string): string {
  const token = `[${options.join("/")} - ${selected}]`;
  return before ? `${before} ${token}` : token;
}

/**
 * Apply a dropdown pick to a lonelog excerpt: set the choice token's selection
 * on the line that holds it, and insert the option's generated line(s) right
 * after as `+ ` CHILDREN of the picking line. Returns the input unchanged when
 * there's no choice token. Selecting the empty option clears the pick (and its
 * children).
 *
 * The `+ ` prefix marks each inserted line as "spawned by the line above", which
 * is also how a re-pick cleans up: every contiguous `+ ` child below the choice
 * is dropped before the new option's lines go in. That's structural, so it works
 * even after the reader has rolled values into those children (an exact-text
 * match would miss them and the stale lines would pile up).
 */
export function applyChoicePick(
  lonelog: string,
  selected: string,
  followLines: Record<string, string>,
  at?: ChoiceAt
): string {
  const lines = lonelog.split("\n");
  // The line the dropdown sits on, when the caller knows it: a log can hold several
  // generators, and a pick must rewrite its own, not the first one.
  const own = at ? lines.flatMap((l, i) => (l.trim() === at.source.trim() && CHOICE_RE.test(l) ? [i] : [])) : [];
  const idx = own[at?.nth ?? 0] ?? lines.findIndex((l) => CHOICE_RE.test(l));
  if (idx < 0) return lonelog;
  const line = lines[idx];
  const m = line.match(CHOICE_RE);
  if (!m || m.index == null) return lonelog;
  const options = m[1]
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const out = [...lines];

  // Drop the previous pick's children — every contiguous `+ ` line below.
  while (out[idx + 1] != null && /^\s*\+\s/.test(out[idx + 1])) out.splice(idx + 1, 1);

  out[idx] = line.slice(0, m.index) + `[${options.join("/")} - ${selected}]` + line.slice(m.index + m[0].length);

  // A dropdown that sits under another pick (a kind of name under its style) is looked up
  // under that pick first.
  const parent = /^\s*\+\s/.test(line)
    ? lines
        .slice(0, idx)
        .reverse()
        .map((l) => l.match(CHOICE_RE))
        .find(Boolean)
    : null;
  const generated =
    (parent ? followLines[`${parent[2].trim()}${NESTED_SEP}${selected}`] : undefined) ?? followLines[selected];
  if (generated) {
    // Each physical line of a (possibly multi-line) generated block becomes a
    // child, so a word-pair step's two lines both attach to the pick.
    out.splice(idx + 1, 0, ...generated.split("\n").map((l) => `${indent}+ ${l}`));
  }
  return out.join("\n");
}
