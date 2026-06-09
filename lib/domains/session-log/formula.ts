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
  /** Die size N in dN. */
  sides: number;
  /** Number of dice (the `2` in `2d6`); 1 when omitted. */
  count: number;
  /** Modifier suffix, e.g. "+3" or "-1" (normalized, no spaces); "" when none. */
  modifier: string;
  /** Rolled total after `=`, or null when not yet rolled. */
  value: number | null;
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

export type FormulaCheck =
  | { kind: "contest"; left: FormulaTerm; right: FormulaTerm; winner: "left" | "right" | null }
  | { kind: "single"; term: FormulaTerm };

export interface Formula {
  check: FormulaCheck;
  result: string | null;
}

const DICE_RE = /^(\d*)d(\d+)((?:\s*[+-]\s*\d+)*)\s*=\s*(\d+)?$/i;
const THRESHOLD_RE = /^(CF|DC)\s*(\d+)$/i;

function parseTerm(raw: string): FormulaTerm {
  const t = raw.trim();

  const dice = t.match(DICE_RE);
  if (dice) {
    return {
      kind: "dice",
      count: dice[1] ? parseInt(dice[1], 10) : 1,
      sides: parseInt(dice[2], 10),
      modifier: dice[3].replace(/\s+/g, ""),
      value: dice[4] ? parseInt(dice[4], 10) : null,
      raw: t,
    };
  }

  const threshold = t.match(THRESHOLD_RE);
  if (threshold) {
    return { kind: "threshold", label: threshold[1].toUpperCase(), value: parseInt(threshold[2], 10), raw: t };
  }

  return { kind: "text", text: t };
}

function comparableValue(term: FormulaTerm): number | null {
  if (term.kind === "dice") return term.value;
  if (term.kind === "threshold") return term.value;
  return null;
}

export function parseFormula(text: string): Formula | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const arrowParts = trimmed.split(/\s*(?:->|→)\s*/);
  const checkText = arrowParts[0];
  const result = arrowParts.length > 1 ? arrowParts.slice(1).join(" → ").trim() : null;

  let check: FormulaCheck;
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

  return { check, result };
}

/**
 * All dice terms in a formula — each renders as an editable die badge: a single
 * value, a two-digit d100 (tens + units), or a per-die pool.
 */
export function editableDice(formula: Formula): DiceTerm[] {
  const terms = formula.check.kind === "contest" ? [formula.check.left, formula.check.right] : [formula.check.term];
  return terms.filter((t): t is DiceTerm => t.kind === "dice");
}

/** Number of editable slots a die exposes: 2 for d100 (tens + units), N for a
 *  pool (one per die), else 1. */
export function diceSlots(term: DiceTerm): number {
  if (term.sides === 100 && term.count === 1) return 2;
  return term.count;
}

/** Initial value of slot `i` derived from the parsed total, or "" when it can't
 *  be recovered (a pool's per-die results aren't stored, only the total). */
export function diceSlotInitial(term: DiceTerm, i: number): string {
  if (term.value == null) return "";
  if (term.sides === 100 && term.count === 1) {
    const [tens, units] = term.value === 100 ? [0, 0] : [Math.floor(term.value / 10), term.value % 10];
    return String(i === 0 ? tens : units);
  }
  if (term.count === 1) return String(term.value);
  return ""; // pool: per-die values aren't in the lonelog total
}

/** Combine edited slot values into the value to write after `=` ("" when the
 *  die is left untouched / unrolled). */
export function combineDiceSlots(term: DiceTerm, slots: string[]): string {
  if (term.sides === 100 && term.count === 1) {
    if (slots.every((s) => s === "")) return "";
    const tens = parseInt(slots[0] || "0", 10) || 0;
    const units = parseInt(slots[1] || "0", 10) || 0;
    const v = tens * 10 + units;
    return v === 0 ? "100" : String(v); // "00" reads as 100 on percentile dice
  }
  if (term.count === 1) return slots[0] ?? "";
  // Pool: sum the dice plus the modifier; "" while no die has been entered yet.
  if (slots.every((s) => s === "")) return "";
  const sum = slots.reduce((a, s) => a + (parseInt(s || "0", 10) || 0), 0);
  const mods: string[] = term.modifier.match(/[+-]\d+/g) ?? [];
  const mod = mods.reduce((a, m) => a + parseInt(m, 10), 0);
  return String(sum + mod);
}

/** Rewrite a dice term's `raw` to carry a new value after `=` (empty → unrolled). */
export function setDiceValue(raw: string, value: string): string {
  const eq = raw.indexOf("=");
  const head = eq >= 0 ? raw.slice(0, eq + 1) : `${raw}=`;
  return `${head}${value}`;
}

/** A formula term the reader can edit inline: a die or a CF/DC threshold. */
export type EditableTerm = DiceTerm | ThresholdTerm;

/** Every editable term in a formula — dice (single / d100 / pool) and the
 *  CF/DC thresholds. */
export function editableTerms(formula: Formula): EditableTerm[] {
  const terms = formula.check.kind === "contest" ? [formula.check.left, formula.check.right] : [formula.check.term];
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
