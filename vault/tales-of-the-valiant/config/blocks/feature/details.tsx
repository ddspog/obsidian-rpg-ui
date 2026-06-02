import * as React from "react";
import { EntityBlock, EvalContext, FeatureDetails, Markdown, TableDef } from "rpg-ui-toolkit";

/* ── Mini expression evaluator for `example` previews ───────────────────── */

function resolvePath(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function toNumber(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = Number(val); return Number.isFinite(n) ? n : null; }
  return null;
}

function findChar(expr: string, ch: string): number {
  let inQ: string | null = null;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (inQ) { if (c === inQ) inQ = null; }
    else { if (c === '"' || c === "'") inQ = c; else if (c === ch) return i; }
  }
  return -1;
}

function evalExpr(expr: string, ctx: Record<string, unknown>): unknown {
  const ternIdx = findChar(expr, "?");
  if (ternIdx >= 0) {
    const cond = expr.slice(0, ternIdx).trim();
    const rest = expr.slice(ternIdx + 1);
    const colonIdx = findChar(rest, ":");
    const truePart = colonIdx >= 0 ? rest.slice(0, colonIdx).trim() : rest.trim();
    const falsePart = colonIdx >= 0 ? rest.slice(colonIdx + 1).trim() : "";
    const condVal = evalExpr(cond, ctx);
    return condVal ? evalExpr(truePart, ctx) : (falsePart ? evalExpr(falsePart, ctx) : "");
  }
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }
  const cmpMatch = expr.match(/^(.+?)\s*(>=|<=|!=|==|>|<)\s*(.+)$/);
  if (cmpMatch) {
    const l = toNumber(evalExpr(cmpMatch[1].trim(), ctx));
    const r = toNumber(evalExpr(cmpMatch[3].trim(), ctx));
    if (l === null || r === null) return false;
    switch (cmpMatch[2]) {
      case ">": return l > r; case "<": return l < r;
      case ">=": return l >= r; case "<=": return l <= r;
      case "==": return l === r; case "!=": return l !== r;
    }
  }
  const arithMatch = expr.match(/^(.+?)\s*([+\-*/])\s*([^+\-*/]+)$/);
  if (arithMatch) {
    const l = toNumber(evalExpr(arithMatch[1].trim(), ctx));
    const r = toNumber(evalExpr(arithMatch[3].trim(), ctx));
    if (l === null || r === null) return null;
    switch (arithMatch[2]) {
      case "+": return l + r; case "-": return l - r;
      case "*": return l * r; case "/": return r !== 0 ? Math.floor(l / r) : 0;
    }
  }
  const t = expr.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === "true") return true;
  if (t === "false") return false;
  // Function call: `path.fn()`
  const fnMatch = t.match(/^(.+)\.(\w+)\(\)$/);
  if (fnMatch) {
    const obj = resolvePath(ctx, fnMatch[1]);
    return callBuiltin(obj, fnMatch[2]);
  }
  return resolvePath(ctx, t);
}

function callBuiltin(value: unknown, fn: string): unknown {
  let raw: string;
  if (typeof value === "string") raw = value;
  else if (value && typeof value === "object" && typeof (value as Record<string, unknown>).name === "string") raw = (value as Record<string, unknown>).name as string;
  else raw = "";
  const name = raw.toLowerCase();
  const commaIdx = name.indexOf(", ");
  switch (fn) {
    case "first_name": return commaIdx >= 0 ? name.slice(commaIdx + 2) : name;
    case "last_name": return commaIdx >= 0 ? name.slice(0, commaIdx) : name;
    case "name": return commaIdx >= 0 ? `${name.slice(commaIdx + 2)} ${name.slice(0, commaIdx)}` : name;
    default: return undefined;
  }
}

function substituteExample(text: string, params: Record<string, unknown>, exSelf: Record<string, unknown>): string {
  const lowerSelf = { ...exSelf, name: typeof exSelf.name === "string" ? exSelf.name.toLowerCase() : exSelf.name };
  const ctx = { self: lowerSelf, ...params };
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

function HomebrewBadge({ source }: { source: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    try {
      const obsidian = require("obsidian") as { setIcon?: (el: HTMLElement, icon: string) => void };
      obsidian.setIcon?.(el, "pen-line");
    } catch {
      el.textContent = "✦";
    }
  }, []);
  const label = `Homebrew — ${source}`;
  return (
    <span
      ref={ref}
      className="rpg-feature-card__homebrew-badge"
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

/** Resolve `[[Target]]` against the vault — returns null if no file exists. */
function resolveWikilink(link: string): string | null {
  const target = link
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .split("#")[0]
    .trim();
  if (!target) return null;
  const app = (
    globalThis as unknown as {
      app?: { metadataCache?: { getFirstLinkpathDest?: (path: string, source: string) => unknown } };
    }
  ).app;
  const dest = app?.metadataCache?.getFirstLinkpathDest?.(target, "");
  return dest ? link : null;
}

/** Pretty-print `max` for a resource — scalar passes through (including
 *  string tokens like `"PB"`); `{ level: max }` map renders as
 *  `Lv1: 1, Lv6: 2`. */
function formatMax(max: FeatureDetails["max"]): string {
  if (max == null) return "";
  if (typeof max === "number") return String(max);
  if (typeof max === "string") return max;
  return Object.entries(max)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([lv, n]) => `Lv${lv}: ${n}`)
    .join(", ");
}

interface DetailsLookup {
  /** Tables declared in the same compendium document, keyed by name. */
  $tables?: Record<string, TableDef>;
}

/** True when the author asked to suppress the card title — accepts any of
 *  `"No Title"`, `"no-title"`, `"notitle"` (case-insensitive, whitespace
 *  and hyphens ignored) so compendium YAML can use whichever spelling
 *  reads best. */
function isNoTitleView(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  return raw.toLowerCase().replace(/[\s\-_]+/g, "") === "notitle";
}

export const details: EntityBlock<FeatureDetails & { $homebrew?: boolean; example?: { self?: Record<string, unknown>; tier?: string | number } }, { lookup: DetailsLookup }> = ({ self, lookup }) => {
  const resolvedLink = self.link ? resolveWikilink(self.link) : null;
  const isResource = self.type === "resource";
  const hideTitle = isNoTitleView(self.view);
  const isParagraphMode = self.heading === "p";
  const HeadingTag = isParagraphMode
    ? null
    : (`h${Math.max(1, Math.min(6, typeof self.heading === "number" ? self.heading : 3))}`) as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const isHomebrew = !!(self as any).$homebrew;

  const context: EvalContext = React.useMemo(() => ({ tables: lookup?.$tables ?? {}, vars: {} }), [lookup?.$tables]);

  // When `example` is declared, substitute the template using the example's
  // self + tier values. This previews the feature on its own page without
  // requiring a calling statblock to import it.
  const displayText = React.useMemo(() => {
    if (!self.text) return undefined;
    if (!self.example) return self.text;
    const exSelf = self.example.self ?? {};
    const exTierKey = self.example.tier != null ? String(self.example.tier) : undefined;
    const tiers = (self as any).tiers as Record<string, Record<string, unknown>> | undefined;
    let tierParams: Record<string, unknown> = {};
    if (tiers && Object.keys(tiers).length > 0) {
      tierParams = (exTierKey != null ? tiers[exTierKey] : undefined) ?? tiers[Object.keys(tiers)[0]] ?? {};
    }
    return substituteExample(self.text, tierParams, exSelf);
  }, [self.text, self.example, (self as any).tiers]);

  const cls = ["rpg-feature-card"];
  if (isHomebrew) cls.push("rpg-feature-homebrew");

  return (
    <article className={cls.join(" ")} aria-label={`Feature ${self.name}`}>
      {isHomebrew && (
        <HomebrewBadge source={self.source ?? ""} />
      )}
      {isParagraphMode ? (
        <>
          {displayText && (
            <Markdown
              source={self.name ? `***${self.name}.*** ${displayText}` : displayText}
              context={context}
              className="rpg-feature-text"
            />
          )}
        </>
      ) : (
        <>
          <hgroup>
            {!hideTitle && HeadingTag && <HeadingTag>{self.name}</HeadingTag>}
            <p>
              {self.subtitle ? (
                <small aria-details="Feature Subtitle">{self.subtitle}</small>
              ) : (
                <>
                  {self.level != null && <small aria-details="Feature Level">Lv. {self.level}</small>}
                  {self.uses != null && (
                    <small aria-details="Feature Uses">
                      {self.uses} use{self.uses === 1 ? "" : "s"}
                    </small>
                  )}
                </>
              )}
              {isResource && self.max != null && <small aria-details="Resource Max">Max: {formatMax(self.max)}</small>}
              {isResource && self.recovery && <small aria-details="Resource Recovery">Recovery: {self.recovery}</small>}
            </p>
          </hgroup>

          {displayText && <Markdown source={displayText} context={context} className="rpg-feature-text" />}
        </>
      )}

      {resolvedLink && <Markdown source={resolvedLink} className="rpg-feature-link" />}
    </article>
  );
};

export default details;
