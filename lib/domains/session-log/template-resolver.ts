export type PlaceholderKind =
  | "actor"
  | "name"
  | "target"
  | "roll"
  | "text"
  | "question"
  | "answer"
  | "expression"
  | "source"
  | "result"
  | "number"
  | "context"
  | "target_ac";

export interface ParsedPlaceholder {
  kind: PlaceholderKind;
  raw: string;
  autoResolvable: boolean;
  /** A choice slot's options (`{{cf:+1|-1}}` → `["+1", "-1"]`), picked from a
   *  list instead of typed. */
  options?: string[];
  /** `{{name?}}` — may be left blank, which drops the line holding it. */
  optional?: boolean;
}

export interface ResolutionContext {
  actor: string;
  name: string;
  entities: string[];
}

const AUTO_RESOLVE_KINDS: Set<PlaceholderKind> = new Set(["actor", "name"]);

/** `{{name}}` — typed in — or `{{name:a|b}}` — one of the listed options. A `?`
 *  after the name (`{{name?}}`, `{{name?:a|b}}`) makes it optional. */
const PLACEHOLDER_RE = /\{\{(\w+)(\?)?(?::([^{}]*))?\}\}/g;

/**
 * The slots a template asks for, in order of first appearance. A name used
 * more than once is ONE slot — `d: {{skill:Arcana|History}} | d20+[[{{skill}}]]=`
 * asks for the skill once and writes it twice — taking its options from
 * whichever use lists them.
 */
export function parseLogTemplate(template: string): ParsedPlaceholder[] {
  const placeholders: ParsedPlaceholder[] = [];
  const byKind = new Map<string, ParsedPlaceholder>();
  let match: RegExpExecArray | null;

  while ((match = PLACEHOLDER_RE.exec(template)) !== null) {
    const raw = match[0];
    const kind = match[1] as PlaceholderKind;
    const options = match[3]
      ?.split("|")
      .map((o) => o.trim())
      .filter(Boolean);
    const known = byKind.get(kind);
    if (known) {
      if (!known.options && options && options.length > 0) known.options = options;
      continue;
    }
    const placeholder: ParsedPlaceholder = {
      kind,
      raw,
      autoResolvable: AUTO_RESOLVE_KINDS.has(kind),
      ...(options && options.length > 0 ? { options } : {}),
      ...(match[2] ? { optional: true } : {}),
    };
    byKind.set(kind, placeholder);
    placeholders.push(placeholder);
  }

  return placeholders;
}

/**
 * Slots the log can fill itself when left blank — kept out of the line rather
 * than dropping it: a blank Target AC writes a bare `vs AC`, read from the target.
 */
const INFERRED = new Set(["target_ac"]);

/** Whether every slot that must be filled has a value. */
export function requiredFilled(placeholders: ParsedPlaceholder[], values: Record<string, string>): boolean {
  return placeholders.every((p) => p.optional || INFERRED.has(p.kind) || values[p.kind]?.trim());
}

/** A template with each blank inferred slot (and the space before it) taken out. */
function withoutBlankInferred(template: string, values: Record<string, string>): string {
  return template.replace(/[ \t]*\{\{(\w+)\??(?::[^{}]*)?\}\}/g, (m, key: string) =>
    INFERRED.has(key) && !values[key]?.trim() ? "" : m
  );
}

export function needsUserInput(placeholders: ParsedPlaceholder[]): ParsedPlaceholder[] {
  return placeholders.filter((p) => !p.autoResolvable);
}

export function resolveLogTemplate(template: string, values: Record<string, string>): string {
  // A line whose optional slot was left blank is dropped whole when that slot
  // was the point of it — inside a tag (`[Threads+ ]` with nothing to add says
  // nothing), or all the line held (`=> {{outcome?}}`). Beside other things —
  // `=> {{how_it_ended?}} [Talon/XP+87]` — only the slot goes; its tags stay.
  return withoutBlankInferred(template, values)
    .split("\n")
    .flatMap((line) => {
      let blank = false;
      for (const m of line.matchAll(PLACEHOLDER_RE)) {
        if (!m[2] || values[m[1]]?.trim()) continue;
        const before = line.slice(0, m.index);
        if (before.lastIndexOf("[") > before.lastIndexOf("]")) return [];
        blank = true;
      }
      if (!blank) return [line];
      const rest = line
        .replace(PLACEHOLDER_RE, (match, key, opt) => (opt && !values[key]?.trim() ? "" : match))
        .replace(/\s{2,}/g, " ");
      return /^\s*(?:=>|->|→)?\s*$/.test(rest) ? [] : [rest.replace(/(=>|->|→)\s+/, "$1 ").trimEnd()];
    })
    .join("\n")
    .replace(PLACEHOLDER_RE, (match, key) => values[key] ?? match);
}

/**
 * The text a card will append, as it stands while its fields are being filled:
 * a required slot still empty reads `…`, an optional one left blank drops its
 * line (as it will on append). For previewing a card before it plays.
 */
export function previewLogTemplate(
  template: string,
  ctx: ResolutionContext,
  userValues: Record<string, string>
): string {
  const values: Record<string, string> = { ...buildAutoValues(ctx), ...userValues };
  for (const p of parseLogTemplate(template)) {
    if (!p.optional && !INFERRED.has(p.kind) && !values[p.kind]?.trim()) values[p.kind] = "…";
  }
  return resolveLogTemplate(template, values);
}

export function buildAutoValues(ctx: ResolutionContext): Record<string, string> {
  return {
    actor: ctx.actor,
    name: ctx.name,
  };
}

export function resolveWithContext(
  template: string,
  ctx: ResolutionContext,
  userValues: Record<string, string>
): string {
  const values = { ...buildAutoValues(ctx), ...userValues };
  return resolveLogTemplate(template, values);
}
