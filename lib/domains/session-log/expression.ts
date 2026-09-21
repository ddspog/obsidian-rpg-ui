/**
 * Dice expressions: arithmetic over dice, numbers and variables, either evaluated
 * or compared.
 *
 *   d8=5 + d6=3 + 2 =            evaluate  → 10
 *   d20=17 + {{PB}} >= 15        test      → pass / fail
 *   2d20kh1=[19,4] vs d20=11     contest   → which side is higher
 *   (d8=5 + 2) * 2 =             precedence and grouping → 14
 *
 * WHAT IS RECORDED and WHAT IS DERIVED are separated on purpose: only dice carry
 * values, and every total is computed from them. A stored total is a second source
 * of truth that goes stale the moment a die is rerolled, which is why an authored
 * one is treated as a FALLBACK for logs written by hand, never as an input to keep
 * in step.
 */

import { DICE_TOKEN_RE, parseDiceToken, type DiceTerm } from "./formula";

/** Arithmetic over dice, numbers and variables. `group` is kept rather than folded
 *  away so the renderer can show the parentheses that were written. */
export type ExprNode =
  | { kind: "dice"; term: DiceTerm; label?: string }
  | { kind: "number"; value: number; raw: string }
  | { kind: "var"; name: string; raw: string }
  | { kind: "neg"; inner: ExprNode }
  | { kind: "group"; inner: ExprNode }
  | { kind: "binary"; op: BinaryOp; left: ExprNode; right: ExprNode };

export type BinaryOp = "+" | "-" | "*" | "/";

/** `vs` asks which side is higher; the rest ask whether the left side clears a bar. */
export type CompareOp = "vs" | ">=" | "<=" | ">" | "<";

export interface ExpressionLine {
  /** What the whole check is called: `Stealth | d20+5=`. Renders in the pill's first
   *  section. Written with a PIPE, which divides the name from the formula exactly
   *  as the pill divides the label from the dice. */
  label?: string;
  left: ExprNode;
  /** A trailing `=` — the line asks for its total. */
  evaluate: boolean;
  /** A total written by hand, used only when the dice cannot supply one. */
  authored: number | null;
  compare?: { op: CompareOp; right: ExprNode };
}

/** Resolves `{{NAME}}`. Returns null for a name it does not know, which leaves the
 *  expression unevaluatable rather than silently treating it as zero. */
export type VarScope = (name: string) => number | null;

// ── Tokens ───────────────────────────────────────────────────────────────────

type Token =
  | { t: "dice"; term: DiceTerm; label?: string }
  | { t: "number"; value: number; raw: string }
  | { t: "var"; name: string; raw: string }
  | { t: "op"; op: BinaryOp }
  | { t: "(" }
  | { t: ")" }
  | { t: "cmp"; op: CompareOp }
  | { t: "eq"; total: number | null };

const VAR_RE = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/;
/**
 * A name bound to the die that follows it: `sneak:2d6=[4,3]`.
 *
 * A COLON glues a name to one operand, where the expression's own label uses a pipe
 * to divide itself from the whole formula — two jobs, two marks. The colon binds
 * with no space, so it reads as attached to that die and cannot be mistaken for the
 * expression's label. Rare by design: a check is normally written with modifiers
 * (`Stealth | d20+5`), and only a formula whose dice mean different things needs to
 * name them one by one.
 */
const DIE_LABEL_RE = /^([A-Za-z][A-Za-z0-9_-]*):(?=\d*d[\d%F])/i;
const NUM_RE = /^\d+/;
/** `>=` and `<=` before their strict forms, or `>` would win first. */
const CMP_RE = /^(vs\b|>=|<=|>|<)/i;

/**
 * Split a line into tokens, or null when it holds something this grammar does not
 * cover — a caller can then fall back to plain text rather than render nonsense.
 */
function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let rest = text.trim();
  let pendingLabel: string | undefined;
  while (rest.length > 0) {
    rest = rest.replace(/^\s+/, "");
    if (!rest) break;

    // `sneak:` names the die that comes next, and only a die may follow it.
    const dieLabel = rest.match(DIE_LABEL_RE);
    if (dieLabel) {
      pendingLabel = dieLabel[1];
      rest = rest.slice(dieLabel[0].length);
      continue;
    }

    // A die claims its own `=value` — but only directly after its spec, so the `+5`
    // in `d20+5=22` cannot be mistaken for part of the die.
    const dice = rest.match(DICE_TOKEN_RE);
    if (dice) {
      const term = parseDiceToken(dice[0]);
      if (term) {
        tokens.push({ t: "dice", term, label: pendingLabel });
        pendingLabel = undefined;
        rest = rest.slice(dice[0].length);
        continue;
      }
    }
    if (pendingLabel) return null; // a name with no die after it

    const v = rest.match(VAR_RE);
    if (v) {
      tokens.push({ t: "var", name: v[1], raw: v[0] });
      rest = rest.slice(v[0].length);
      continue;
    }

    const cmp = rest.match(CMP_RE);
    if (cmp) {
      tokens.push({ t: "cmp", op: cmp[1].toLowerCase() === "vs" ? "vs" : (cmp[1] as CompareOp) });
      rest = rest.slice(cmp[0].length);
      continue;
    }

    if (rest[0] === "=") {
      // A trailing `= 22` is a hand-written total; a bare `=` asks for a derived one.
      const after = rest.slice(1).trim();
      const num = after.match(NUM_RE);
      const total = num && num[0] === after ? parseInt(num[0], 10) : null;
      if (after !== "" && total === null) return null; // `=` followed by something else
      tokens.push({ t: "eq", total });
      rest = "";
      continue;
    }

    const n = rest.match(NUM_RE);
    if (n) {
      tokens.push({ t: "number", value: parseInt(n[0], 10), raw: n[0] });
      rest = rest.slice(n[0].length);
      continue;
    }

    if ("+-*/".includes(rest[0])) {
      tokens.push({ t: "op", op: rest[0] as BinaryOp });
      rest = rest.slice(1);
      continue;
    }
    if (rest[0] === "(") {
      tokens.push({ t: "(" });
      rest = rest.slice(1);
      continue;
    }
    if (rest[0] === ")") {
      tokens.push({ t: ")" });
      rest = rest.slice(1);
      continue;
    }
    return null; // not an expression
  }
  return tokens;
}

// ── Parser (recursive descent, so `*` binds tighter than `+`) ─────────────────

class Cursor {
  constructor(
    private tokens: Token[],
    public i = 0
  ) {}
  peek(): Token | undefined {
    return this.tokens[this.i];
  }
  next(): Token | undefined {
    return this.tokens[this.i++];
  }
}

function parseSum(c: Cursor): ExprNode | null {
  let left = parseProduct(c);
  if (!left) return null;
  for (;;) {
    const tok = c.peek();
    if (tok?.t !== "op" || (tok.op !== "+" && tok.op !== "-")) return left;
    c.next();
    const right = parseProduct(c);
    if (!right) return null;
    left = { kind: "binary", op: tok.op, left, right };
  }
}

function parseProduct(c: Cursor): ExprNode | null {
  let left = parseAtom(c);
  if (!left) return null;
  for (;;) {
    const tok = c.peek();
    if (tok?.t !== "op" || (tok.op !== "*" && tok.op !== "/")) return left;
    c.next();
    const right = parseAtom(c);
    if (!right) return null;
    left = { kind: "binary", op: tok.op, left, right };
  }
}

function parseAtom(c: Cursor): ExprNode | null {
  const tok = c.next();
  if (!tok) return null;
  if (tok.t === "dice") return { kind: "dice", term: tok.term, label: tok.label };
  if (tok.t === "number") return { kind: "number", value: tok.value, raw: tok.raw };
  if (tok.t === "var") return { kind: "var", name: tok.name, raw: tok.raw };
  if (tok.t === "op" && tok.op === "-") {
    const inner = parseAtom(c);
    return inner ? { kind: "neg", inner } : null;
  }
  if (tok.t === "(") {
    const inner = parseSum(c);
    if (!inner) return null;
    if (c.next()?.t !== ")") return null; // unbalanced
    return { kind: "group", inner };
  }
  return null;
}

/**
 * Parse a whole expression line: arithmetic, then an optional comparison, then an
 * optional `=`. Null when the text is not an expression at all.
 */
export function parseExpressionLine(text: string): ExpressionLine | null {
  // `Stealth | d20+5=` — everything before the pipe names the check. Taken off the
  // front before tokenising, so a label may hold anything but a pipe: names carry
  // commas and apostrophes ("Loki, the old God", "Thieves' Tools").
  const bar = text.indexOf("|");
  const label = bar >= 0 ? text.slice(0, bar).trim() : undefined;
  const body = bar >= 0 ? text.slice(bar + 1) : text;
  if (label !== undefined && label === "") return null; // a bare pipe names nothing

  const tokens = tokenize(body);
  if (!tokens || tokens.length === 0) return null;
  const c = new Cursor(tokens);
  const left = parseSum(c);
  if (!left) return null;

  const line: ExpressionLine = { label, left, evaluate: false, authored: null };
  let tok = c.peek();
  if (tok?.t === "cmp") {
    c.next();
    const right = parseSum(c);
    if (!right) return null;
    line.compare = { op: tok.op, right };
    tok = c.peek();
  }
  if (tok?.t === "eq") {
    c.next();
    line.evaluate = true;
    line.authored = tok.total;
    tok = c.peek();
  }
  if (tok) return null; // trailing tokens: not a clean expression
  // Something has to be asked of it, or it is just a bare die with no result.
  return line.evaluate || line.compare || hasDice(line.left) ? line : null;
}

/** Does this expression roll anything? A line of pure arithmetic is not a roll. */
export function hasDice(node: ExprNode): boolean {
  switch (node.kind) {
    case "dice":
      return true;
    case "number":
    case "var":
      return false;
    case "neg":
    case "group":
      return hasDice(node.inner);
    case "binary":
      return hasDice(node.left) || hasDice(node.right);
  }
}

/** Every die in the expression, in written order — what an editor may change. */
export function diceOf(node: ExprNode): DiceTerm[] {
  switch (node.kind) {
    case "dice":
      return [node.term];
    case "number":
    case "var":
      return [];
    case "neg":
    case "group":
      return diceOf(node.inner);
    case "binary":
      return [...diceOf(node.left), ...diceOf(node.right)];
  }
}

// ── Evaluation ───────────────────────────────────────────────────────────────

/**
 * The expression's value, or null when something it needs is missing — an unrolled
 * die or an unknown variable. Null is the honest answer: a partial total would read
 * as a result.
 *
 * Division floors, the way rules that halve damage do.
 */
export function evaluate(node: ExprNode, vars?: VarScope): number | null {
  switch (node.kind) {
    case "dice":
      return node.term.value;
    case "number":
      return node.value;
    case "var":
      return vars ? vars(node.name) : null;
    case "neg": {
      const v = evaluate(node.inner, vars);
      return v == null ? null : -v;
    }
    case "group":
      return evaluate(node.inner, vars);
    case "binary": {
      const l = evaluate(node.left, vars);
      const r = evaluate(node.right, vars);
      if (l == null || r == null) return null;
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? null : Math.floor(l / r);
      }
    }
  }
}

export interface Outcome {
  /** The left side's total, derived from its dice — or the authored one as a last
   *  resort, for a log written by hand. */
  total: number | null;
  /** Whether that total came from the dice rather than from the text. */
  derived: boolean;
  /** For a comparison: the right side's total. */
  against?: number | null;
  /** `vs` — which side is higher. */
  winner?: "left" | "right" | "tie" | null;
  /** A threshold test — null while it cannot be decided. */
  passed?: boolean | null;
}

/** Resolve a parsed line into what should be shown. */
export function outcomeOf(line: ExpressionLine, vars?: VarScope): Outcome {
  const derivedTotal = evaluate(line.left, vars);
  const total = derivedTotal ?? line.authored;
  const out: Outcome = { total, derived: derivedTotal != null };
  if (!line.compare) return out;

  const against = evaluate(line.compare.right, vars);
  out.against = against;
  if (total == null || against == null) {
    if (line.compare.op === "vs") out.winner = null;
    else out.passed = null;
    return out;
  }
  if (line.compare.op === "vs") {
    out.winner = total === against ? "tie" : total > against ? "left" : "right";
    return out;
  }
  out.passed =
    line.compare.op === ">="
      ? total >= against
      : line.compare.op === "<="
        ? total <= against
        : line.compare.op === ">"
          ? total > against
          : total < against;
  return out;
}
