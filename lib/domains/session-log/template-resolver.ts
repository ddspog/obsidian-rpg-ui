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
  | "context";

export interface ParsedPlaceholder {
  kind: PlaceholderKind;
  raw: string;
  autoResolvable: boolean;
}

export interface ResolutionContext {
  actor: string;
  name: string;
  entities: string[];
}

const AUTO_RESOLVE_KINDS: Set<PlaceholderKind> = new Set(["actor", "name"]);

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function parseLogTemplate(template: string): ParsedPlaceholder[] {
  const placeholders: ParsedPlaceholder[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = PLACEHOLDER_RE.exec(template)) !== null) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    const kind = match[1] as PlaceholderKind;
    placeholders.push({
      kind,
      raw,
      autoResolvable: AUTO_RESOLVE_KINDS.has(kind),
    });
  }

  return placeholders;
}

export function needsUserInput(placeholders: ParsedPlaceholder[]): ParsedPlaceholder[] {
  return placeholders.filter((p) => !p.autoResolvable);
}

export function resolveLogTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (match, key) => values[key] ?? match);
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
