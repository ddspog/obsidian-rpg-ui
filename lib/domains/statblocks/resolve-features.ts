import { parse as parseYAML } from "yaml";
import type { ResolvedStatFeature, StatFeatureRef } from "./types";

interface FeatureDetailsBody {
  id?: string;
  name?: string;
  type?: string;
  /** Path into the calling statblock (e.g. `abilities.dex`) whose value
   *  selects the tier when the stat block's feature ref omits `tier`. */
  auto?: string;
  text?: string;
  tiers?: Record<string, Record<string, unknown>>;
}

function parseFeatureDetailsBlock(raw: string): FeatureDetailsBody | null {
  const sepIdx = raw.indexOf("\n---\n");
  const sepEnd = raw.indexOf("\n---");
  const effectiveSep =
    sepIdx >= 0 ? sepIdx : sepEnd >= 0 && sepEnd + 4 >= raw.length ? sepEnd : -1;

  let yamlText: string;
  let bodyText: string | undefined;
  if (effectiveSep >= 0) {
    yamlText = raw.slice(0, effectiveSep);
    bodyText = raw.slice(effectiveSep + 4).replace(/^\n+/, "").replace(/\n+$/, "") || undefined;
  } else {
    yamlText = raw;
  }

  try {
    const parsed = parseYAML(yamlText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const result: FeatureDetailsBody = {};
    if (typeof obj.id === "string") result.id = obj.id;
    if (typeof obj.name === "string") result.name = obj.name;
    if (typeof obj.type === "string") result.type = obj.type;
    if (typeof obj.auto === "string") result.auto = obj.auto;
    if (typeof obj.text === "string") result.text = obj.text;
    else if (bodyText) result.text = bodyText;
    if (obj.tiers && typeof obj.tiers === "object" && !Array.isArray(obj.tiers)) {
      result.tiers = obj.tiers as Record<string, Record<string, unknown>>;
    }
    return result;
  } catch {
    return null;
  }
}

function extractFirstFeatureDetails(contents: string): FeatureDetailsBody | null {
  const re = /```+\s*rpg\s+feature\.details\s*\n([\s\S]*?)```+/;
  const m = contents.match(re);
  if (!m) return null;
  return parseFeatureDetailsBlock(m[1]);
}

function extractFeatureByName(contents: string, blockName: string): FeatureDetailsBody | null {
  const re = /```+\s*rpg\s+feature\.details\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const feature = parseFeatureDetailsBlock(m[1]);
    if (feature?.name === blockName || feature?.id === blockName) return feature;
  }
  return null;
}

/** Parse `@[[File]]#BlockName` or `@[[File]]` or `[[File#Heading]]` or `[[File]]`. */
function parseRef(ref: string): { file: string; blockName?: string } {
  const atRef = ref.match(/^@\[\[([^\]]+)\]\](?:#(.+))?$/);
  if (atRef) {
    return { file: atRef[1].split("|")[0].trim(), blockName: atRef[2]?.trim() };
  }
  const wikiRef = ref.match(/^\[\[([^\]]+)\]\]$/);
  if (wikiRef) {
    const inner = wikiRef[1].split("|")[0].trim();
    const hashIdx = inner.indexOf("#");
    if (hashIdx >= 0) {
      return { file: inner.slice(0, hashIdx).trim(), blockName: inner.slice(hashIdx + 1).trim() };
    }
    return { file: inner };
  }
  return { file: ref };
}

/** Walk a dotted path (e.g. `abilities.dex`) into an object. */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function substituteText(
  text: string,
  params: Record<string, unknown>,
  selfProps: Record<string, unknown>
): string {
  const ctx = { self: selfProps, ...params };

  // Replace all `{{ expr }}` blocks with their evaluated result.
  // Handles nested `{{ }}` inside ternary string literals by processing
  // from the innermost outward (the regex is non-greedy and we loop).
  let result = text;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(/\{\{\s*((?:[^{}]|\{(?!\{)|\}(?!\}))*?)\s*\}\}/g, (_, expr) => {
      const val = evalExpr(expr.trim(), ctx);
      return val != null ? String(val) : "";
    });
  }
  return result;
}

/** Resolve a value token: dotted path, number, quoted string, function call, or bare word. */
function resolveToken(token: string, ctx: Record<string, unknown>): unknown {
  const t = token.trim();
  if (!t) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "undefined") return undefined;
  // Function call: `path.fn()` — split off the trailing `fn()` and resolve
  const fnMatch = t.match(/^(.+)\.(\w+)\(\)$/);
  if (fnMatch) {
    const obj = resolvePath(ctx, fnMatch[1]);
    return callBuiltin(obj, fnMatch[2]);
  }
  return resolvePath(ctx, t);
}

/** Built-in functions available on resolved values.
 *  Name convention: "Bear, Polar" → first_name = "polar", last_name = "bear".
 *  When no comma, both return the full (lowercased) name.
 *  When called on an object (e.g. `self`), reads its `.name` property. */
function callBuiltin(value: unknown, fn: string): unknown {
  let raw: string;
  if (typeof value === "string") {
    raw = value;
  } else if (value && typeof value === "object" && typeof (value as Record<string, unknown>).name === "string") {
    raw = (value as Record<string, unknown>).name as string;
  } else {
    raw = "";
  }
  const name = raw.toLowerCase();
  const commaIdx = name.indexOf(", ");
  switch (fn) {
    case "first_name":
      return commaIdx >= 0 ? name.slice(commaIdx + 2) : name;
    case "last_name":
      return commaIdx >= 0 ? name.slice(0, commaIdx) : name;
    case "name":
      return commaIdx >= 0 ? `${name.slice(commaIdx + 2)} ${name.slice(0, commaIdx)}` : name;
    default:
      return undefined;
  }
}

/** Evaluate a mini-expression: supports ternary, comparison, and arithmetic. */
function evalExpr(expr: string, ctx: Record<string, unknown>): unknown {
  // Ternary: `cond ? trueExpr : falseExpr` or `cond ? trueExpr` (no colon → "" on false)
  // Match the `?` that isn't inside quotes.
  const ternIdx = findTernary(expr);
  if (ternIdx >= 0) {
    const cond = expr.slice(0, ternIdx).trim();
    const rest = expr.slice(ternIdx + 1);
    const colonIdx = findColon(rest);
    let truePart: string;
    let falsePart: string;
    if (colonIdx >= 0) {
      truePart = rest.slice(0, colonIdx).trim();
      falsePart = rest.slice(colonIdx + 1).trim();
    } else {
      truePart = rest.trim();
      falsePart = "";
    }
    const condVal = evalExpr(cond, ctx);
    if (isTruthy(condVal)) {
      return evalExpr(truePart, ctx);
    }
    return falsePart ? evalExpr(falsePart, ctx) : "";
  }

  // Quoted string literal — return early before comparison/arithmetic parsing
  // so operators inside strings (like `< 2 crew`) aren't misinterpreted.
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }

  // Comparison operators
  const cmpMatch = expr.match(/^(.+?)\s*(>=|<=|!=|==|>|<)\s*(.+)$/);
  if (cmpMatch) {
    const left = toNumber(evalExpr(cmpMatch[1].trim(), ctx));
    const right = toNumber(evalExpr(cmpMatch[3].trim(), ctx));
    if (left === null || right === null) return false;
    switch (cmpMatch[2]) {
      case ">": return left > right;
      case "<": return left < right;
      case ">=": return left >= right;
      case "<=": return left <= right;
      case "==": return left === right;
      case "!=": return left !== right;
    }
  }

  // Arithmetic: + - * / (left-to-right, no precedence beyond * / before + -)
  const arithMatch = expr.match(/^(.+?)\s*([+\-*/])\s*([^+\-*/]+)$/);
  if (arithMatch) {
    const left = toNumber(evalExpr(arithMatch[1].trim(), ctx));
    const right = toNumber(evalExpr(arithMatch[3].trim(), ctx));
    if (left === null || right === null) return null;
    switch (arithMatch[2]) {
      case "+": return left + right;
      case "-": return left - right;
      case "*": return left * right;
      case "/": return right !== 0 ? Math.floor(left / right) : 0;
    }
  }

  // Bare token (path or literal)
  return resolveToken(expr, ctx);
}

/** Find the top-level `?` index for ternary (not inside quotes). */
function findTernary(expr: string): number {
  let inQ: string | null = null;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQ) {
      if (ch === inQ) inQ = null;
    } else {
      if (ch === '"' || ch === "'") inQ = ch;
      else if (ch === "?") return i;
    }
  }
  return -1;
}

/** Find the top-level `:` for the false branch (not inside quotes). */
function findColon(expr: string): number {
  let inQ: string | null = null;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQ) {
      if (ch === inQ) inQ = null;
    } else {
      if (ch === '"' || ch === "'") inQ = ch;
      else if (ch === ":") return i;
    }
  }
  return -1;
}

function toNumber(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isTruthy(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") return val !== "";
  return true;
}

export async function resolveStatFeatures(
  refs: StatFeatureRef[],
  sourcePath: string,
  selfPropsOrName?: Record<string, unknown> | string
): Promise<ResolvedStatFeature[]> {
  const selfProps: Record<string, unknown> =
    typeof selfPropsOrName === "string"
      ? { name: selfPropsOrName.toLowerCase() }
      : selfPropsOrName && typeof selfPropsOrName === "object"
        ? selfPropsOrName
        : {};
  const app = (
    globalThis as unknown as {
      app?: {
        metadataCache?: { getFirstLinkpathDest?: (path: string, source: string) => unknown };
        vault?: { cachedRead?: (file: unknown) => Promise<string> };
      };
    }
  ).app;
  if (!app?.metadataCache?.getFirstLinkpathDest || !app?.vault?.cachedRead) return [];

  const contentCache = new Map<string, string>();

  const results: ResolvedStatFeature[] = [];
  for (const ref of refs) {
    const { file: fileStem, blockName } = parseRef(ref.ref);
    const vaultFile = app.metadataCache.getFirstLinkpathDest(fileStem, sourcePath);
    if (!vaultFile) {
      results.push({ name: blockName ?? fileStem, text: "" });
      continue;
    }

    let content = contentCache.get(fileStem);
    if (content === undefined) {
      content = await app.vault.cachedRead(vaultFile);
      contentCache.set(fileStem, content);
    }

    const feature = blockName
      ? extractFeatureByName(content, blockName)
      : extractFirstFeatureDetails(content);

    if (!feature) {
      results.push({ name: blockName ?? fileStem, text: "" });
      continue;
    }

    // Select the tier: an explicit `ref.tier` wins; otherwise the feature's
    // `auto` path read from the calling statblock (selfProps) picks it; if
    // neither yields a known tier, fall back to the first tier.
    let mergedParams: Record<string, unknown> = { ...ref };
    if (feature.tiers && Object.keys(feature.tiers).length > 0) {
      let tierKey = ref.tier != null ? String(ref.tier) : undefined;
      if (tierKey == null && feature.auto) {
        const autoVal = resolvePath(selfProps, feature.auto);
        if (autoVal != null) tierKey = String(autoVal);
      }
      const tierValues =
        (tierKey != null ? feature.tiers[tierKey] : undefined) ??
        feature.tiers[Object.keys(feature.tiers)[0]];
      if (tierValues && typeof tierValues === "object") {
        mergedParams = { ...tierValues, ...ref };
      }
    }

    const text = substituteText(feature.text ?? "", mergedParams, selfProps);

    results.push({
      name: feature.name,
      type: feature.type,
      text,
    });
  }
  return results;
}
