/**
 * Formulas in statblocks whose numbers come from elsewhere: a summon's
 * (`{{ 13 + circle }}`, `{{ floor(circle / 2) }}`, `+{{ 4 + pb }}`) and the
 * values a template's formulas resolve to. A small expression language:
 * numbers, names (`pb`, `circle`, `level_ranger`, `mod_wis`), + − × ÷ with the
 * usual precedence, parentheses, unary minus, and floor, ceil, round, min, max,
 * abs. Division is exact; wrap it in floor() or ceil() for the book's rounding.
 * Pure: no Obsidian and no I/O.
 */

export type FormulaVars = Record<string, number>;

type Tok = { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = src.slice(i).match(/^\d+(?:\.\d+)?|^\.\d+/);
      if (!m) throw new Error(`Bad number at ${i}`);
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z_][\w.]*/)!;
      out.push({ k: "id", v: m[0] });
      i += m[0].length;
    } else if ("+-*/(),×÷−".includes(c)) {
      out.push({ k: "op", v: c === "×" ? "*" : c === "÷" ? "/" : c === "−" ? "-" : c });
      i++;
    } else throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

const FUNCS: Record<string, (...a: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
};

/** The value of a formula, or undefined when it names something unknown or does not parse. */
export function evaluate(src: string, vars: FormulaVars): number | undefined {
  let toks: Tok[];
  try {
    toks = tokenize(src);
  } catch {
    return undefined;
  }
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.k === "op" && peek()!.v === v;
  const fail = () => {
    throw new Error("parse");
  };
  const expr = (): number => {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (isOp("*") || isOp("/")) {
      const op = (toks[p++] as { v: string }).v;
      const r = unary();
      v = op === "*" ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  };
  const unary = (): number => {
    if (isOp("-")) {
      p++;
      return -unary();
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return atom();
  };
  const atom = (): number => {
    const t = toks[p++];
    if (!t) return fail();
    if (t.k === "num") return t.v;
    if (t.k === "op" && t.v === "(") {
      const v = expr();
      if (!isOp(")")) fail();
      p++;
      return v;
    }
    if (t.k === "id") {
      if (isOp("(")) {
        p++;
        const args: number[] = [];
        if (!isOp(")")) {
          args.push(expr());
          while (isOp(",")) {
            p++;
            args.push(expr());
          }
        }
        if (!isOp(")")) fail();
        p++;
        const f = FUNCS[t.v.toLowerCase()];
        return f ? f(...args) : fail();
      }
      const v = vars[t.v] ?? vars[t.v.toLowerCase()];
      return v === undefined ? fail() : v;
    }
    return fail();
  };
  try {
    const v = expr();
    if (p !== toks.length) return undefined;
    return Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The names a formula reads ("13 + circle" → ["circle"]). */
export function namesIn(src: string): string[] {
  try {
    const toks = tokenize(src);
    return [
      ...new Set(
        toks
          .filter((t, i) => t.k === "id" && !(toks[i + 1]?.k === "op" && toks[i + 1].v === "("))
          .map((t) => String(t.v))
      ),
    ];
  } catch {
    return [];
  }
}

/** One piece of a filled text: words, or a number worked out from a formula. */
export type FilledPiece = { text: string } | { value: string; formula: string };

const FORMULA = /\{\{\s*((?:[^{}]|\{(?!\{)|\}(?!\}))*?)\s*\}\}/g;

/**
 * A text with every `{{ formula }}` worked out. A formula that names something
 * not given (or a template's `self.name()`) is left as written.
 */
export function fillFormulas(text: string, vars: FormulaVars): FilledPiece[] {
  const out: FilledPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(FORMULA)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    const v = evaluate(m[1], vars);
    out.push(v === undefined ? { text: m[0] } : { value: String(Math.round(v * 100) / 100), formula: m[1].trim() });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  // Words next to words are one piece.
  return out.reduce<FilledPiece[]>((acc, p) => {
    const prev = acc[acc.length - 1];
    if (prev && "text" in prev && "text" in p) prev.text += p.text;
    else acc.push({ ...p });
    return acc;
  }, []);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A filled text as Markdown: each worked-out number a `<span class="rpg-formula">`
 * that carries its formula (shown on hover, and on a tap by the sheet).
 */
export function fillFormulasMarkdown(text: string, vars: FormulaVars, words?: (formula: string) => string): string {
  return fillFormulas(text, vars)
    .map((p) =>
      "value" in p
        ? `<span class="rpg-formula" tabindex="0" role="button" data-formula="${esc(words ? words(p.formula) : p.formula)}" title="${esc(words ? words(p.formula) : p.formula)}">${p.value}</span>`
        : p.text
    )
    .join("");
}
