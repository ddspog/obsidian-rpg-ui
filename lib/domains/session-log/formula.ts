/**
 * Formula parsing for lonelog rolls/checks.
 *
 * A formula is `check -> result`, where the check is either a contest
 * (`a vs b`) or a single term. Terms are dice (`d10=8`, `2d6+3=11`, or unrolled
 * `d10=`), thresholds (`CF 5`, `DC 15`), or plain text. The contest winner is
 * the side with the higher comparable value.
 *
 * Returns null for strings with no recognizable dice/threshold token so callers
 * can fall back to plain text.
 */

export interface DiceTerm {
  kind: "dice";
  /** Die size for SHAPE lookup: `d%` maps to 100, fudge dice to 6. */
  sides: number;
  /** Number of dice (the `2` in `2d6`); 1 when omitted. */
  count: number;
  /** Modifier suffix, e.g. "+3" or "-1" (normalized, no spaces); "" when none. */
  modifier: string;
  /**
   * The rolled TOTAL, or null when not yet rolled. For a pool recorded as a list
   * (`2d6=[4,3]`) this is their sum, so every consumer — contests, display,
   * comparisons — keeps working on one number.
   */
  value: number | null;
  /** Per-die results when recorded as a list; empty for a single value. */
  values: number[];
  /** Dice the roll GENERATED — an explosion, or a reroll's replacement. */
  extra: number[];
  /**
   * Selector suffixes as written: exploding (`!`, `!p`), rerolls (`ro1`),
   * keep/drop (`kh1`, `kl1`, `dl1`, `dh1`), bounds (`min2`, `max5`). Displayed
   * beside the die; the plugin records rolls, it never applies them.
   */
  selector: string;
  /** The die as authored (`d%`, `dF.2`, `4d6`) — used for the label. */
  spec: string;
  raw: string;
}

export interface ThresholdTerm {
  kind: "threshold";
  /** "CF", "DC", … */
  label: string;
  value: number;
  raw: string;
}

export interface TextTerm {
  kind: "text";
  text: string;
}

export type FormulaTerm = DiceTerm | ThresholdTerm | TextTerm;

/** One addend of a sum: its operator (null for the first) and its term. */
export interface SumPart {
  /** A name bound to this die with a colon: `sneak:2d6=[4,3]`. */
  label?: string;
  op: "+" | "-" | null;
  term: FormulaTerm;
}

export type FormulaCheck =
  | { kind: "contest"; left: FormulaTerm; right: FormulaTerm; winner: "left" | "right" | null }
  | { kind: "single"; term: FormulaTerm }
  /**
   * Several DIFFERENT dice summed (`d8+d6+2=13`). Only the total is recorded —
   * the individual dice were never logged — so the dice render unrolled and the
   * total carries the value.
   */
  | { kind: "sum"; parts: SumPart[]; total: number | null };

export interface Formula {
  /** What the check is called: `Stealth | d20+5=18`. Renders as the formula's first
   *  section, ahead of the dice. */
  label?: string;
  check: FormulaCheck;
  result: string | null;
}

/**
 * `4d6dl1+2=13`, `3d8!=19`, `d%=45`, `dF.2=1`.
 *   1 count · 2 sides (digits | `%` | `F[.n]`) · 3 selectors · 4 modifiers · 5 value
 * Selectors bind to the die and precede numeric modifiers, matching how the
 * notation is written.
 */
/**
 * One die notation: `count`, `sides`, selector, numeric modifier, an optional
 * pre-`=` breakdown, and the recorded value (a number or a list).
 *
 * Shared so the anchored parse and the "find the roll in this line" search can
 * never drift apart — they read the same groups, 1..6.
 */
const DICE_PATTERN = String.raw`(\d*)d(\d+|%|F(?:\.\d+)?)((?:drop[<>]=?\d+|floor\d+|cap\d+|!p|!|ro\d*|kh\d*|kl\d*|dl\d*|dh\d*|s[ad]?)*)((?:\s*[+-]\s*\d+)*)(?:\s*\[([^\]]*)\])?\s*=\s*((?:\[[^\]]*\])+|\d+)`;

/** A whole term, value optional (an unrolled die is still a die). */
const DICE_RE = new RegExp(`^${DICE_PATTERN}?$`, "i");

/** The first ROLLED die anywhere in a line — the value is required here. */
const DICE_IN_TEXT_RE = new RegExp(DICE_PATTERN, "i");

/**
 * The number a line's first roll produced, whether it was recorded as a total
 * (`d100=22`) or as a list of dice (`2d6=[4,3]` → 7). Null when the line holds no
 * rolled die.
 *
 * Every table lookup and interpretation reads a roll through this, so recording a
 * pool die-by-die resolves exactly like recording its total.
 */
export function rolledValue(text: string): number | null {
  const m = text.match(DICE_IN_TEXT_RE);
  if (!m) return null;
  return parseDiceValue(m[6], m[5], m[3] ?? "").value;
}

/** The inner text of each `[…]` group in a recorded value. `[8,5,6][3]` → two.
 *
 *  The last group may be UNCLOSED, because an editable field holds `[6,2,` while it
 *  is being typed; requiring the bracket dropped everything the reader had entered. */
export function recordedGroups(raw: string): string[] {
  return Array.from(raw.matchAll(/\[([^\]]*)(?:\]|$)/g)).map((m) => m[1]);
}

/** A recorded roll: the dice thrown, and the dice those THREW IN TURN — an explosion
 *  or a reroll's replacement. Kept apart so the log shows how a total came about,
 *  not just which numbers ended up in it. */
export interface DiceRoll {
  first: number[];
  extra: number[];
}

/** The text form of a roll: `[8,5,6][3]`, or one list when nothing was generated. */
export function recordedText(roll: DiceRoll): string {
  return roll.extra.length ? `[${roll.first.join(",")}][${roll.extra.join(",")}]` : `[${roll.first.join(",")}]`;
}

/** Does this `<special>` produce dice beyond the ones written? */
export function generatesDice(selector: string): boolean {
  return /!/.test(selector) || /ro\d*/i.test(selector);
}

/**
 * The dice actually on the table, once the generated ones have done their work.
 *
 * An explosion ADDS: every recorded die counts. A reroll REPLACES: a first-list die
 * at or under the bar hands its place to the next generated die, in order, and the
 * original stays in the log as a record of what was rerolled. Anything generated
 * beyond that was still rolled, so it still counts.
 */
export function resolvePool(first: number[], extra: number[], selector: string): number[] {
  const ro = selector.match(/ro(\d*)/i);
  if (!ro || extra.length === 0) return [...first, ...extra];
  const bar = ro[1] ? parseInt(ro[1], 10) : 1;
  const queue = [...extra];
  const kept = first.map((v) => (v <= bar && queue.length ? queue.shift()! : v));
  return [...kept, ...queue];
}

/** The numbers inside a recorded list, ignoring any per-die markers (`6!`, `2d`). */
function parseValueList(raw: string): number[] {
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

/** Every token a selector can hold, in the order they must be matched (`!p` before
 *  `!`, so the pip is not read as a bare explosion). */
const SELECTOR_TOKEN = /drop[<>]=?\d+|floor\d+|cap\d+|!p|!|ro\d*|kh\d*|kl\d*|dl\d*|dh\d*|s[ad]?/gi;

/** `kh2` → 2; a BARE token means one, so `kh` is `kh1` and `ro` is `ro1`. Writing
 *  the count is optional because keeping one die is the common case. */
function tokenCount(token: string): number {
  const n = token.replace(/\D/g, "");
  return n === "" ? 1 : parseInt(n, 10);
}

/**
 * The dice a `<special>` actually counts, as they count.
 *
 * `XdY` on its own sums every die. A selector changes WHICH dice count and at what
 * value, and that is the whole difference between a roll and its result: `2d20kh1`
 * on `[19,4]` is 19, not 23 — advantage takes the better die, it does not add them.
 *
 * Keep / drop select by POSITION (highest, lowest); `drop<3` / `drop>4` select by
 * VALUE, removing the dice that miss the bar; `floor` / `cap` remove nothing and
 * count a die at the bar instead. Selectors that describe how the dice were
 * OBTAINED (`!`, `ro`) leave them alone: the list already holds what they produced.
 */
export function countedDice(values: number[], selector: string): number[] {
  let out = [...values];
  for (const [token] of selector.matchAll(SELECTOR_TOKEN)) {
    const t = token.toLowerCase();
    const n = tokenCount(t);
    if (/^(kh|kl|dh|dl)/.test(t)) {
      if (out.length < 2) continue;
      const keep = Math.min(n, out.length);
      const asc = [...out].sort((a, b) => a - b);
      if (t.startsWith("kh")) out = asc.slice(-keep);
      else if (t.startsWith("kl")) out = asc.slice(0, keep);
      else if (t.startsWith("dl")) out = asc.slice(keep);
      else out = asc.slice(0, out.length - keep); // dh
    } else if (t.startsWith("drop<")) {
      // REMOVES the dice that miss the bar, rather than counting them at it.
      out = t.startsWith("drop<=") ? out.filter((v) => v > n) : out.filter((v) => v >= n);
    } else if (t.startsWith("drop>")) {
      out = t.startsWith("drop>=") ? out.filter((v) => v < n) : out.filter((v) => v <= n);
    } else if (t.startsWith("floor")) {
      // CLAMPS instead: the die still counts, at the bar. (D&D's Great Weapon
      // Fighting treats 1s and 2s as 3s — `floor3`.)
      out = out.map((v) => Math.max(v, n));
    } else if (t.startsWith("cap")) {
      out = out.map((v) => Math.min(v, n));
    }
  }
  return out;
}

/** Does this selector add dice we cannot predict a ceiling for? */
export function explodes(selector: string): boolean {
  return /!/.test(selector);
}

/** How a `<special>` reads to someone who did not write it: a mark for the chip, a
 *  short name for the expanded pill, and a sentence for the tooltip. */
export interface SelectorNote {
  /** The bare glyph, for use beside a written-out label. */
  symbol: string;
  /**
   * The collapsed mark: the glyph plus its number WHEREVER the number is what the
   * rule turns on. A floor of 3 shown as a bare `≥` is unreadable — a total of 17
   * from dice summing to 14 looks like an error until you can see the 3.
   */
  mark: string;
  label: string;
  description: string;
}

/**
 * Is this roll advantage (or disadvantage)? Keeping ONE d20 out of several is,
 * whatever "several" happens to be — a feature that grants three dice still reads
 * as advantage, which is the point of keying on the die rather than the count.
 *
 * Off the d20 it is not: `4d6kh1` keeps the best of four, and no table calls that
 * advantage.
 */
function isAdvantage(die: { count: number; sides: number }, keep: number): boolean {
  return die.sides === 20 && keep === 1 && die.count >= 2;
}

/**
 * Name each part of a `<special>`.
 *
 * The marks are a system rather than a set of icons: a FILLED triangle keeps, a
 * HOLLOW one drops, and it points at the end of the range it acts on — `▲` keep the
 * high die, `▽` drop the low one. Where the mechanic has a name every table already
 * uses, it says that name rather than making the reader decode the notation.
 */
export function describeSelector(die: { selector: string; count: number; sides: number }): SelectorNote[] {
  const notes: SelectorNote[] = [];
  const count = Math.max(1, die.count);
  const best = (k: number) => (k === 2 ? "the higher of two dice" : `the highest of ${k} dice`);
  const worst = (k: number) => (k === 2 ? "the lower of two dice" : `the lowest of ${k} dice`);
  for (const [token] of die.selector.matchAll(SELECTOR_TOKEN)) {
    const t = token.toLowerCase();
    const n = tokenCount(t);
    const dice = (k: number) => `${k} ${k === 1 ? "die" : "dice"}`;
    // How many dice a keep/drop acts on is only worth showing when it is not the
    // usual one; a clamp's threshold is always worth showing, since there is no
    // usual one to assume.
    const many = n === 1 ? "" : String(n);
    if (t.startsWith("kh"))
      notes.push(
        isAdvantage(die, n)
          ? { symbol: "▲", mark: "▲", label: "adv", description: `advantage — ${best(count)}` }
          : { symbol: "▲", mark: `▲${many}`, label: `keep ${n} hi`, description: `keeps the highest ${dice(n)}` }
      );
    else if (t.startsWith("kl"))
      notes.push(
        isAdvantage(die, n)
          ? { symbol: "▼", mark: "▼", label: "dis", description: `disadvantage — ${worst(count)}` }
          : { symbol: "▼", mark: `▼${many}`, label: `keep ${n} lo`, description: `keeps the lowest ${dice(n)}` }
      );
    else if (t.startsWith("dl"))
      notes.push({ symbol: "▽", mark: `▽${many}`, label: `drop ${n} lo`, description: `drops the lowest ${dice(n)}` });
    else if (t.startsWith("dh"))
      notes.push({ symbol: "△", mark: `△${many}`, label: `drop ${n} hi`, description: `drops the highest ${dice(n)}` });
    else if (t === "!p")
      notes.push({ symbol: "✱", mark: "✱", label: "explodes once", description: "a maximum rolls one more die" });
    else if (t === "!")
      notes.push({
        symbol: "✱",
        mark: "✱",
        label: "explodes",
        description: "a maximum rolls again, and may keep going",
      });
    else if (t.startsWith("ro"))
      notes.push({
        symbol: "↻",
        mark: `↻${n}`,
        label: `reroll ≤${n}`,
        description: `rerolls any die of ${n} or less, once`,
      });
    else if (t.startsWith("drop<") || t.startsWith("drop>")) {
      // The comparison as WRITTEN, so the mark can be checked against the dice:
      // `▽<3` beside a total says which dice were thrown away and why.
      const bar = t.startsWith("drop<=")
        ? { cmp: "≤", description: `drops any die of ${n} or less` }
        : t.startsWith("drop>=")
          ? { cmp: "≥", description: `drops any die of ${n} or more` }
          : t.startsWith("drop<")
            ? { cmp: "<", description: `drops any die below ${n}` }
            : { cmp: ">", description: `drops any die above ${n}` };
      notes.push({ symbol: "▽", mark: `▽${bar.cmp}${n}`, label: `drop ${bar.cmp}${n}`, description: bar.description });
    } else if (t.startsWith("floor"))
      notes.push({ symbol: "⌊", mark: `⌊${n}`, label: `floor ${n}`, description: `a die below ${n} counts as ${n}` });
    else if (t.startsWith("cap"))
      notes.push({ symbol: "⌈", mark: `⌈${n}`, label: `cap ${n}`, description: `a die above ${n} counts as ${n}` });
    else if (t.startsWith("s"))
      notes.push({ symbol: "⇅", mark: "⇅", label: "sorted", description: "recorded in order" });
  }
  return notes;
}

/**
 * A recorded roll value: either a single number (`=7`) or a LIST of per-die
 * results (`=[4,3]`). A pool records every die so the log stays auditable — you
 * can see it was a 4 and a 3 — while the interface shows their sum.
 *
 * `breakdown` is the older form that lists the dice BEFORE the total
 * (`4d6dl1 [4,3,6,2]=13`); there the authored total is kept as written, since it
 * already accounts for the selector.
 */
export function parseDiceValue(
  raw: string | undefined,
  breakdown?: string,
  selector = ""
): { value: number | null; values: number[]; extra: number[] } {
  const total = (first: number[], extra: number[]) => sumOf(countedDice(resolvePool(first, extra, selector), selector));
  const listed = breakdown ? parseValueList(breakdown) : [];
  if (!raw) return { value: listed.length ? total(listed, []) : null, values: listed, extra: [] };
  if (!raw.startsWith("[")) {
    const n = parseInt(raw, 10);
    return { value: Number.isNaN(n) ? null : n, values: listed, extra: [] };
  }
  const groups = recordedGroups(raw);
  const values = parseValueList(groups[0] ?? "");
  const extra = parseValueList(groups[1] ?? "");
  return { value: values.length || extra.length ? total(values, extra) : null, values, extra };
}

function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * What a die's recorded text means for THIS term — the one place a display should
 * read a roll from.
 *
 * Interpreting the text without the term's selector is how `2d20kh1=[19,4]` came to
 * read 23: the dice were all summed because nothing said advantage applied.
 */
export function readDiceValue(
  term: DiceTerm,
  recorded: string
): { value: number | null; values: number[]; extra: number[] } {
  return parseDiceValue(recorded, undefined, term.selector);
}

/**
 * One die AS IT APPEARS INSIDE AN EXPRESSION, anchored at the start of the text:
 * `2d20kh1`, `d6!=[6][3]`, `4d6dl1 [4,3,6,2]=13`.
 *
 * No modifier group, and the `=value` must follow the spec directly. That is what
 * lets `d20+5=22` read as "d20 plus 5, totalling 22" — the `+5` is arithmetic, and
 * the value after `=` belongs to the expression, not to the die. A value only binds
 * to a die when it is written against it: `d20=17`.
 */
export const DICE_TOKEN_RE = new RegExp(
  String.raw`^(\d*)d(\d+|%|F(?:\.\d+)?)((?:drop[<>]=?\d+|floor\d+|cap\d+|!p|!|ro\d*|kh\d*|kl\d*|dl\d*|dh\d*|s[ad]?)*)(?:\s*\[([^\]]*)\])?(?:\s*=\s*((?:\[[^\]]*\])+|\d+))?`,
  "i"
);

/** Build a term from a die token (see {@link DICE_TOKEN_RE}). */
export function parseDiceToken(raw: string): DiceTerm | null {
  const m = raw.match(DICE_TOKEN_RE);
  if (!m) return null;
  return {
    kind: "dice",
    count: m[1] ? parseInt(m[1], 10) : 1,
    sides: shapeSides(m[2]),
    modifier: "",
    ...parseDiceValue(m[5], m[4], m[3] ?? ""),
    selector: m[3] ?? "",
    spec: `${m[1] ?? ""}d${m[2]}`,
    raw: m[0],
  };
}

/** A bare die with no `=value` — an addend inside a sum (`d8` in `d8+d6+2`). */
const DIE_ONLY_RE =
  /^(\d*)d(\d+|%|F(?:\.\d+)?)((?:drop[<>]=?\d+|floor\d+|cap\d+|!p|!|ro\d*|kh\d*|kl\d*|dl\d*|dh\d*|s[ad]?)*)$/i;

/** Shape lookup for a die whose sides are not a plain number. */
function shapeSides(sides: string): number {
  if (sides === "%") return 100;
  if (/^F/i.test(sides)) return 6; // fudge dice are cubes
  return parseInt(sides, 10);
}
const THRESHOLD_RE = /^(CF|DC)\s*(\d+)$/i;

function parseTerm(raw: string): FormulaTerm {
  const t = raw.trim();

  const dice = t.match(DICE_RE);
  if (dice) {
    return {
      kind: "dice",
      count: dice[1] ? parseInt(dice[1], 10) : 1,
      sides: shapeSides(dice[2]),
      modifier: dice[4].replace(/\s+/g, ""),
      ...parseDiceValue(dice[6], dice[5], dice[3] ?? ""),
      selector: dice[3] ?? "",
      spec: `${dice[1] ?? ""}d${dice[2]}`,
      raw: t,
    };
  }

  const threshold = t.match(THRESHOLD_RE);
  if (threshold) {
    return { kind: "threshold", label: threshold[1].toUpperCase(), value: parseInt(threshold[2], 10), raw: t };
  }

  return { kind: "text", text: t };
}

/** Every term in a check, whatever its shape. */
function checkTerms(check: FormulaCheck): FormulaTerm[] {
  if (check.kind === "contest") return [check.left, check.right];
  if (check.kind === "sum") return check.parts.map((p) => p.term);
  return [check.term];
}

/**
 * Split a check into summed addends when it holds SEVERAL dice (`d8+d6+2=13`).
 * Returns null for anything else, so a single die with numeric modifiers
 * (`d20+5=18`) keeps its existing single-term shape.
 */
function parseSum(checkText: string): Extract<FormulaCheck, { kind: "sum" }> | null {
  // The LAST `=` carries the sum's total; any earlier `=` belongs to a die
  // (`d8=5 + d6=3 + 2 = 13`), so each die can record what it rolled.
  const lastEq = checkText.lastIndexOf("=");
  if (lastEq < 0) return null;
  const body = checkText.slice(0, lastEq).trim();
  const tail = checkText.slice(lastEq + 1).trim();
  if (tail !== "" && !/^\d+$/.test(tail)) return null;
  const total = tail === "" ? null : parseInt(tail, 10);

  // Split on + / - keeping the operators.
  const pieces = body.split(/\s*([+-])\s*/).filter((x) => x !== "");
  if (pieces.length < 3) return null; // needs at least `a op b`

  const parts: SumPart[] = [];
  let op: "+" | "-" | null = null;
  let diceCount = 0;
  for (const piece of pieces) {
    if (piece === "+" || piece === "-") {
      op = piece;
      continue;
    }
    // `sneak:2d6=[4,3]` — a name glued to this one die, stripped before the die is
    // read so the notation itself stays untouched.
    let body = piece;
    let dieLabel: string | undefined;
    const named = body.match(/^([A-Za-z][A-Za-z0-9_-]*):(?=\d*d[\d%F])/i);
    if (named) {
      dieLabel = named[1];
      body = body.slice(named[0].length);
    }
    // `d8=5` (rolled) or a bare `d8` (not yet rolled).
    const valued = body.match(/^(.*?)=\s*(\[[^\]]*\]|\d+)?$/);
    const dieText = valued ? valued[1].trim() : body;
    const die = dieText.match(DIE_ONLY_RE);
    if (die) {
      diceCount++;
      parts.push({
        label: dieLabel,
        op,
        term: {
          kind: "dice",
          count: die[1] ? parseInt(die[1], 10) : 1,
          sides: shapeSides(die[2]),
          modifier: "",
          ...parseDiceValue(valued ? valued[2] : undefined, undefined, die[3] ?? ""),
          selector: die[3] ?? "",
          spec: `${die[1] ?? ""}d${die[2]}`,
          // `raw` must carry the `=value` so a write-back can find and swap it.
          raw: piece,
        },
      });
    } else if (/^\d+$/.test(piece)) {
      parts.push({ op, term: { kind: "text", text: piece } });
    } else {
      return null; // not a clean sum — leave it to the single-term path
    }
    op = null;
  }
  // Only a SUM when more than one die is involved; otherwise the existing
  // single-term rendering (die + numeric modifier) is the better read.
  return diceCount >= 2 ? { kind: "sum", parts, total } : null;
}

function comparableValue(term: FormulaTerm): number | null {
  if (term.kind === "dice") return term.value;
  if (term.kind === "threshold") return term.value;
  return null;
}

/**
 * A whole line of rolls — a PARTY ROLL, where each character makes their own check.
 *
 *   Talon | d20+5=18; Kowyn | d20+3=12
 *
 * `;` separates them, because character names hold commas ("Loki, the old God") for
 * the same reason list entries are separated that way. The older comma form is still
 * read, where each label trails its dice (`4d6dl1 // STR=14`), since a comma can only
 * be told from a name's comma when dice follow it directly.
 *
 * Null unless EVERY part is a formula: half a line of rolls and half prose is prose,
 * and rendering the readable half would quietly drop the rest.
 */
export function parseFormulaLine(text: string): Formula[] | null {
  const segments = text.includes(";") ? text.split(";") : text.split(/,\s*(?=\S*\d*d[\d%F])/i);
  const formulas: Formula[] = [];
  for (const segment of segments) {
    if (!segment.trim()) return null;
    const { text: body, label } = liftTrailingLabel(segment);
    const f = parseFormula(body);
    if (!f) return null;
    formulas.push(label && !f.label ? { ...f, label } : f);
  }
  return formulas.length ? formulas : null;
}

/**
 * The older trailing label: `4d6dl1 // STR=14` — a name after the dice, with the
 * total written past it. Rewritten to the plain form so one parser reads both.
 */
function liftTrailingLabel(segment: string): { text: string; label?: string } {
  const m = segment.match(/^(.*?)\s*(?:\/\/|#)\s*(.+)$/);
  if (!m) return { text: segment.trim() };
  const [, dice, tail] = m;
  const withTotal = tail.match(/^(.+?)=\s*(\d+)\s*$/);
  if (withTotal) return { text: `${dice.trim()}=${withTotal[2]}`, label: withTotal[1].trim() };
  return { text: dice.trim(), label: tail.trim() };
}

export function parseFormula(text: string): Formula | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const arrowParts = trimmed.split(/\s*(?:->|→)\s*/);
  let checkText = arrowParts[0];
  const result = arrowParts.length > 1 ? arrowParts.slice(1).join(" → ").trim() : null;

  // `Stealth | d20+5=18` — the name of the check, divided from the formula. Taken
  // off before anything else, so the rest parses exactly as an unlabelled line
  // would; only a pipe BEFORE the arrow is a label, never one inside a result.
  let label: string | undefined;
  const bar = checkText.indexOf("|");
  if (bar > 0) {
    const name = checkText.slice(0, bar).trim();
    if (name) {
      label = name;
      checkText = checkText.slice(bar + 1).trim();
    }
  }

  // A lone die may carry its own name (`sneak:2d6=[4,3]`). With nothing else in the
  // line the two labels render in the same place, so it becomes the formula's.
  const lone = checkText.match(/^([A-Za-z][A-Za-z0-9_-]*):(?=\d*d[\d%F])/i);
  if (lone) {
    label = label ?? lone[1];
    checkText = checkText.slice(lone[0].length);
  }

  let check: FormulaCheck;
  const sum = parseSum(checkText);
  if (sum) return { label, check: sum, result };
  const vsParts = checkText.split(/\s+vs\.?\s+/i);
  if (vsParts.length === 2) {
    const left = parseTerm(vsParts[0]);
    const right = parseTerm(vsParts[1]);
    const lv = comparableValue(left);
    const rv = comparableValue(right);
    const winner = lv != null && rv != null && lv !== rv ? (lv > rv ? "left" : "right") : null;
    check = { kind: "contest", left, right, winner };
  } else {
    check = { kind: "single", term: parseTerm(checkText) };
  }

  // Only a formula if it carries a recognizable dice/threshold token; otherwise
  // it's plain prose and the caller should render it as text.
  const hasToken =
    check.kind === "contest" ? check.left.kind !== "text" || check.right.kind !== "text" : check.term.kind !== "text";
  if (!hasToken) return null;

  return { label, check, result };
}

/**
 * All dice terms in a formula — each renders as an editable die badge: a single
 * value, a two-digit d100 (tens + units), or a per-die pool.
 */
export function editableDice(formula: Formula): DiceTerm[] {
  const terms = checkTerms(formula.check);
  return terms.filter((t): t is DiceTerm => t.kind === "dice");
}

/** Every die is ONE editable slot holding exactly what the log records.
 *
 *  A pool's slot holds its whole list (`[4,3]`), so every die stays in the log
 *  while the interface reads and writes a single value. A d100 holds its number,
 *  not a tens/units pair: the chip has one field, and splitting the value across
 *  two slots wrote `d100=455` when someone typed 45 into it. */
export function diceSlots(term: DiceTerm): number {
  void term;
  return 1;
}

/** The slot's initial value: a pool carries its recorded list verbatim, any other
 *  die its value. */
export function diceSlotInitial(term: DiceTerm, i: number): string {
  void i;
  if (term.value == null) return "";
  if (term.values.length && (term.count > 1 || term.extra.length))
    return recordedText({ first: term.values, extra: term.extra });
  return String(term.value);
}

/** The value to write after `=` ("" when the die is left untouched / unrolled).
 *  One slot, holding exactly what gets recorded — a value or a list.
 *
 *  A list is NORMALISED here: the field may hold `[6,2,` while someone is typing,
 *  and writing that to the note would leave a term the parser cannot read, so the
 *  numbers are rebuilt into `[6,2]`. */
export function combineDiceSlots(term: DiceTerm, slots: string[]): string {
  void term;
  const raw = (slots[0] ?? "").trim();
  if (!/[[\],]/.test(raw)) return raw;
  const groups = recordedGroups(raw).map(parseValueList);
  const first = groups[0] ?? [];
  const extra = groups[1] ?? [];
  if (!first.length && !extra.length) return "";
  return recordedText({ first, extra });
}

/** The largest number a die can record: a pool sums its dice, so `2d6` reaches 12
 *  where a single d6 stops at 6. Used to clamp a hand-typed result.
 *
 *  An exploding die has no ceiling to clamp to, so it is not given a false one. */
export function diceMax(term: DiceTerm): number {
  if (explodes(term.selector)) return Number.POSITIVE_INFINITY;
  return term.sides * Math.max(1, term.count);
}

/** Rewrite a dice term's `raw` to carry a new value after `=` (empty → unrolled). */
export function setDiceValue(raw: string, value: string): string {
  const eq = raw.indexOf("=");
  let head = eq >= 0 ? raw.slice(0, eq + 1) : `${raw}=`;
  // A newly rolled list replaces an authored breakdown — keeping both would show
  // one set of dice and total another.
  if (value.startsWith("[")) head = head.replace(/\s*\[[^\]]*\]\s*(?==$)/, "");
  return `${head}${value}`;
}

/** A formula term the reader can edit inline: a die or a CF/DC threshold. */
export type EditableTerm = DiceTerm | ThresholdTerm;

/** Every editable term in a formula — dice (single / d100 / pool) and the
 *  CF/DC thresholds. */
export function editableTerms(formula: Formula): EditableTerm[] {
  const terms = checkTerms(formula.check);
  return terms.filter((t): t is EditableTerm => t.kind === "dice" || t.kind === "threshold");
}

/** Editable slots a term exposes: dice via `diceSlots`, a threshold has one. */
export function termSlots(term: EditableTerm): number {
  return term.kind === "dice" ? diceSlots(term) : 1;
}

/** Initial value of a term's slot `i` (a threshold is its single value). */
export function termSlotInitial(term: EditableTerm, i: number): string {
  return term.kind === "dice" ? diceSlotInitial(term, i) : String(term.value);
}

/** Combine a term's edited slots into the value string to write back. */
export function combineTermValue(term: EditableTerm, slots: string[]): string {
  return term.kind === "dice" ? combineDiceSlots(term, slots) : (slots[0] ?? "");
}

/** The term's new `raw` carrying an edited value (a threshold keeps its label). */
export function setTermRaw(term: EditableTerm, value: string): string {
  if (term.kind === "dice") return setDiceValue(term.raw, value);
  return value === "" ? term.raw : term.raw.replace(/\d+/, value);
}

/**
 * The line token-swap for editing a formula's result — the text after the
 * `->`/`→`. Returns null when the source line has no arrow (nothing to edit).
 * Clearing the result leaves a bare arrow so the slot stays markable.
 */
export function resultReplacement(source: string, next: string): { from: string; to: string } | null {
  const m = source.match(/(->|→)\s*(.*)$/);
  if (!m) return null;
  return { from: m[0], to: `${m[1]} ${next.trim()}`.trimEnd() };
}

/**
 * Constrain a typed die value to a real face of that die: digits only, no
 * leading zeros, and within `1..max`. An empty string is preserved so a die can
 * be cleared back to unrolled.
 *
 * Typing past the maximum CLAMPS rather than rejecting — entering "7" on a d4
 * gives 4, and "1" then "0" on a d4 gives 4 rather than silently keeping 1.
 */
/**
 * Constrain the INSIDE of a recorded list — the dice, without the brackets that
 * hold them. Each number is one die, so each is clamped to a real face.
 *
 * Commas are preserved while they are being typed (rebuilding the list on every
 * keystroke would delete the one just entered), and brackets are stripped: they are
 * syntax the editor draws, not something to retype.
 */
export function clampDiceList(raw: string, sides: number): string {
  return raw.replace(/[^0-9,]/g, "").replace(/\d+/g, (n) => clampDieValue(n, sides) || n);
}

export function clampDieValue(raw: string, max: number): string {
  const digits = raw.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return "";
  return String(Math.min(Math.max(n, 1), max));
}

/**
 * Roll a die term: `count` dice of `sides`, summed. Percentile dice roll 1–100.
 *
 * `rng` is injectable so tests are deterministic; the plugin passes
 * `Math.random`, which is allowed at runtime (unlike inside a workflow script).
 */
export function rollDiceTerm(term: DiceTerm, rng: () => number = Math.random): number {
  const roll = rollDiceFaces(term, rng);
  return sumOf(countedDice(resolvePool(roll.first, roll.extra, term.selector), term.selector));
}

/** One die of `sides`, rolled. The single place a face is generated, so a list
 *  draw and a formula's dice cannot drift apart in how they roll.
 *
 *  `rng` is injectable so tests are deterministic; the plugin passes `Math.random`,
 *  which is allowed at runtime (unlike inside a workflow script). */
export function rollDie(sides: number, rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * Math.max(1, sides));
}

/** Extra dice an explosion may add before we call it a runaway. */
const EXPLODE_CAP = 20;

/**
 * The dice a term actually produces — `2d6` returns two results, and a `<special>`
 * that CHANGES THE DICE is honoured here rather than left to the reader:
 *
 *   ro1  a die of 1 or less is rerolled, once
 *   !p   a die at its maximum rolls one more
 *   !    …and that one may explode too
 *
 * Selectors that only pick among dice (keep / drop / clamps) are not applied: every
 * die rolled is RECORDED, and which of them count is decided when the roll is read.
 * That way a log of `2d20kh1` still shows both dice behind its 19.
 */
export function rollDiceFaces(term: DiceTerm, rng: () => number = Math.random): DiceRoll {
  const face = () => rollDie(term.sides, rng);
  const first: number[] = [];
  const extra: number[] = [];
  for (let i = 0; i < Math.max(1, term.count); i++) first.push(face());

  // A rerolled die KEEPS its place in the first list; its replacement is generated.
  // Recording both is the point: the log shows that a 1 was thrown and set aside.
  const reroll = term.selector.match(/ro(\d*)/i);
  if (reroll) {
    const bar = reroll[1] ? parseInt(reroll[1], 10) : 1;
    for (const v of first) if (v <= bar) extra.push(face());
  }

  // Explosions look at the dice actually on the table — a reroll's replacement can
  // itself hit the maximum and explode.
  const chain = /!(?!p)/.test(term.selector);
  if (chain || /!p/.test(term.selector)) {
    let pending = resolvePool(first, extra, term.selector).filter((v) => v === term.sides).length;
    let added = 0;
    while (pending > 0 && added < EXPLODE_CAP) {
      pending--;
      const v = face();
      extra.push(v);
      added++;
      if (chain && v === term.sides) pending++;
    }
  }
  return { first, extra };
}

/**
 * The text to record for a roll: a single value for one die, a LIST for a pool
 * (`[4,3]`) so each die survives in the log while the UI shows the sum.
 */
export function formatDiceValue(term: DiceTerm, roll: DiceRoll): string {
  // Two lists whenever the roll generated dice, so `[8,5,6][3]` says an 8 exploded
  // rather than leaving four dice for a `3d8` to explain. Keyed on what was ROLLED,
  // not on the count written: a one-die notation can still produce two dice.
  if (roll.extra.length) return recordedText(roll);
  return roll.first.length > 1 || term.count > 1 ? `[${roll.first.join(",")}]` : String(roll.first[0] ?? "");
}

/**
 * Sum a parsed sum's parts (null counts as 0).
 *
 * `valueOf` supplies a die's CURRENT value, which is not always the parsed one: a
 * roll made in the interface is a pending edit until it is saved, so reading the
 * terms alone showed a total belonging to the dice as they were on disk.
 */
export function sumTotal(parts: SumPart[], valueOf?: (term: DiceTerm) => number | null): number {
  let total = 0;
  for (const part of parts) {
    const v =
      part.term.kind === "dice"
        ? ((valueOf ? valueOf(part.term) : part.term.value) ?? 0)
        : part.term.kind === "text"
          ? parseInt(part.term.text, 10) || 0
          : 0;
    total += part.op === "-" ? -v : v;
  }
  return total;
}

/**
 * A term's value as the interface currently has it — the pending edit when there is
 * one, else what was parsed. Thresholds are editable too, so a DC someone is in the
 * middle of changing counts as changed.
 */
export function liveTermValue(
  term: FormulaTerm,
  valueFor?: (term: EditableTerm, slot: number) => string
): number | null {
  if (term.kind === "dice") return valueFor ? readDiceValue(term, valueFor(term, 0)).value : term.value;
  if (term.kind === "threshold") {
    if (!valueFor) return term.value;
    const n = parseInt(valueFor(term, 0), 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Which side of a contest is ahead, given the values the interface has now. */
export function contestWinner(
  left: FormulaTerm,
  right: FormulaTerm,
  valueFor?: (term: EditableTerm, slot: number) => string
): "left" | "right" | null {
  const l = liveTermValue(left, valueFor);
  const r = liveTermValue(right, valueFor);
  if (l == null || r == null || l === r) return null;
  return l > r ? "left" : "right";
}
