/**
 * Filter expression evaluator for `.filter(expr)` chain calls.
 *
 * Supported expressions (no quotes needed for values):
 *   field == value        — equality
 *   field != value        — not equal
 *   field like /pattern/  — regex match
 *   value prefix field    — field starts with value
 *   value suffix field    — field ends with value
 *   field contains value  — field (string/array) contains value
 */

export interface FilterExpr {
  type: "eq" | "neq" | "like" | "prefix" | "suffix" | "contains";
  field: string;
  value: string;
}

export function parseFilterExpr(raw: string): FilterExpr | null {
  const trimmed = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!trimmed) return null;

  // field == value
  const eqMatch = trimmed.match(/^([\w.]+)\s*==\s*(.+)$/);
  if (eqMatch) return { type: "eq", field: eqMatch[1], value: eqMatch[2].trim() };

  // field != value
  const neqMatch = trimmed.match(/^([\w.]+)\s*!=\s*(.+)$/);
  if (neqMatch) return { type: "neq", field: neqMatch[1], value: neqMatch[2].trim() };

  // field like /pattern/
  const likeMatch = trimmed.match(/^([\w.]+)\s+like\s+\/(.+)\/$/);
  if (likeMatch) return { type: "like", field: likeMatch[1], value: likeMatch[2] };

  // value prefix field
  const prefixMatch = trimmed.match(/^(.+?)\s+prefix\s+([\w.]+)$/);
  if (prefixMatch) return { type: "prefix", field: prefixMatch[2], value: prefixMatch[1].trim() };

  // value suffix field
  const suffixMatch = trimmed.match(/^(.+?)\s+suffix\s+([\w.]+)$/);
  if (suffixMatch) return { type: "suffix", field: suffixMatch[2], value: suffixMatch[1].trim() };

  // field contains value
  const containsMatch = trimmed.match(/^([\w.]+)\s+contains\s+(.+)$/);
  if (containsMatch) return { type: "contains", field: containsMatch[1], value: containsMatch[2].trim() };

  // Fallback: treat as field == value with space separator
  const spaceMatch = trimmed.match(/^([\w.]+)\s+(.+)$/);
  if (spaceMatch) return { type: "eq", field: spaceMatch[1], value: spaceMatch[2].trim() };

  return null;
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function stringify(val: unknown): string {
  if (val == null) return "";
  if (Array.isArray(val)) return val.map(stringify).join(",");
  return String(val);
}

export function evaluateFilter(expr: FilterExpr, data: Record<string, unknown>): boolean {
  const raw = resolvePath(data, expr.field);
  const fieldStr = stringify(raw);

  switch (expr.type) {
    case "eq":
      if (Array.isArray(raw)) return raw.some((v) => stringify(v) === expr.value);
      return fieldStr === expr.value;
    case "neq":
      if (Array.isArray(raw)) return !raw.some((v) => stringify(v) === expr.value);
      return fieldStr !== expr.value;
    case "like":
      try {
        return new RegExp(expr.value, "i").test(fieldStr);
      } catch {
        return false;
      }
    case "prefix":
      return fieldStr.startsWith(expr.value);
    case "suffix":
      return fieldStr.endsWith(expr.value);
    case "contains":
      if (Array.isArray(raw)) return raw.some((v) => stringify(v) === expr.value);
      return fieldStr.includes(expr.value);
  }
}
