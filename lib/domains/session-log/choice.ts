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
 * on the line that holds it, and insert the option's generated line (if any)
 * right after, matching that line's indentation. Returns the input unchanged
 * when there's no choice token. Selecting the empty option clears it (no
 * inserted line).
 */
export function applyChoicePick(lonelog: string, selected: string, followLines: Record<string, string>): string {
  const lines = lonelog.split("\n");
  const idx = lines.findIndex((l) => CHOICE_RE.test(l));
  if (idx < 0) return lonelog;
  const line = lines[idx];
  const m = line.match(CHOICE_RE);
  if (!m || m.index == null) return lonelog;
  const options = m[1]
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const oldSelected = m[2].trim();
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const out = [...lines];

  // Drop the previous selection's inserted line (if it sits right after) so
  // re-picking swaps the follow-up rather than stacking copies.
  const oldGenerated = oldSelected && followLines[oldSelected] ? `${indent}${followLines[oldSelected]}` : null;
  if (oldGenerated && out[idx + 1] === oldGenerated) out.splice(idx + 1, 1);

  out[idx] = line.slice(0, m.index) + `[${options.join("/")} - ${selected}]` + line.slice(m.index + m[0].length);

  const generated = followLines[selected];
  if (generated) out.splice(idx + 1, 0, `${indent}${generated}`);
  return out.join("\n");
}
