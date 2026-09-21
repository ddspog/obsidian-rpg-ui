/**
 * GM feature → lonelog emitter.
 *
 * Assembles a `GMFeature`'s nested aspects (oracle / roll / table / generator /
 * event / scene) into the multi-line lonelog template a GM card appends to the
 * session log. Dice are emitted UNROLLED (`d10=`) and free-text slots stay as
 * `{{placeholders}}` for the reader to fill — `interpret` / `likelihood` are
 * metadata (see ./fate-chart.ts), never written into the line.
 *
 * Pure string assembly: no Obsidian / vault dependencies.
 */

import type {
  EmitPiece,
  GMCardDef,
  GMEventAspect,
  GMFeature,
  GMGenStep,
  GMGeneratorAspect,
  GMOracleAspect,
  GMRollAspect,
  GMSceneAspect,
  GMStack,
  GMTableAspect,
  NamedGenerator,
} from "../features/types";

/** Canonical emission order — aspects chain into one block in this order. */
const ASPECT_ORDER: GMStack[] = ["oracle", "roll", "table", "generator", "event", "scene"];

/** The aspects a feature declares, in canonical emission order. */
export function gmStacks(feature: GMFeature): GMStack[] {
  return ASPECT_ORDER.filter((k) => feature[k] != null);
}

/** The stack a card lives under: explicit `stack:` or the first declared aspect. */
export function gmPrimaryStack(feature: GMFeature): GMStack | null {
  return feature.stack ?? gmStacks(feature)[0] ?? null;
}

/**
 * The resource token an oracle emits: `{ abbr, value }` where `value` is a baked
 * literal (`cf:` constant) or a `{{<abbr>}}` fill-slot. Driven by `tag:` (any
 * imported resource, named by the `abbr` declared in a `reads:` file) or the
 * `chaos:` / `cf:` sugar (both default the abbr to `CF`). Null when none.
 */
function oracleCf(o: GMOracleAspect | undefined): { abbr: string; value: string } | null {
  if (!o) return null;
  if (o.cf != null) return { abbr: o.tag ?? "CF", value: String(o.cf) };
  if (o.tag) return { abbr: o.tag, value: `{{${o.tag.toLowerCase()}}}` };
  if (o.chaos) return { abbr: "CF", value: "{{cf}}" };
  return null;
}

/** The resource token VALUE shared across a feature's aspects (its generator's
 *  `vs:` reads the same slot/literal the oracle emits). */
function cfToken(feature: GMFeature): string | null {
  return oracleCf(feature.oracle)?.value ?? null;
}

/** Ensure a dice expression is emitted unrolled (`d10` → `d10=`). */
function unrolled(die: string): string {
  return die.includes("=") ? die : `${die}=`;
}

/** Expand a contest target. `CF` (alone) → `CF <cf>`; anything else verbatim. */
function expandVs(vs: string, cf: string | null): string {
  const v = vs.trim();
  if (/^cf$/i.test(v)) return cf ? `CF ${cf}` : "CF";
  return v;
}

/** Display label for an `@[[path|alias]]` call or bare string — a `.table(id)` /
 *  `.bare(id)` selector (names a specific block, so same-file tables stay
 *  distinct), else the alias, else the last path segment sans `.md`. */
export function refLabel(ref: string): string {
  let s = ref.trim();
  // A `.fn(id)` call selector names a specific block — prefer it.
  const arg = s.match(/\.\w+\(([^)]+)\)\s*$/);
  if (arg) return arg[1].trim();
  const call = s.match(/@?\[\[([^\]]+)\]\]/);
  if (call) s = call[1];
  const pipe = s.indexOf("|");
  if (pipe >= 0) return s.slice(pipe + 1).trim();
  const seg = s.split("/").pop() ?? s;
  return seg.replace(/\.md$/i, "").replace(/#.*$/, "").trim();
}

function emitOracle(o: GMOracleAspect): string[] {
  const head = "?" + (o.attribution ? `(${o.attribution})` : "");
  const tok = oracleCf(o);
  const cfTag = tok ? ` [${tok.abbr}:${tok.value}]` : "";
  const lines = [`${head}${cfTag} ${o.question}`.trim()];
  // An answer line only when the oracle resolves itself (roll / likelihood /
  // interpret). When a generator/roll aspect carries the resolution instead,
  // the question stands alone — e.g. a Mythic scene check.
  if (o.roll || o.likelihood || o.interpret) {
    lines.push(o.roll ? `-> (${unrolled(o.roll)})` : "->");
  }
  return lines;
}

function emitRoll(r: GMRollAspect, cf: string | null): string[] {
  const prefix = r.name ? `d(${r.name}):` : "d:";
  const check = r.vs ? `${unrolled(r.die)} vs ${expandVs(r.vs, cf)}` : unrolled(r.die);
  return [`${prefix} ${check} ->`];
}

function emitTable(t: GMTableAspect): string[] {
  const die = t.die ? ` ${unrolled(t.die)}` : "";
  const sources = Array.isArray(t.source) ? t.source : [t.source];
  return sources.map((s) => `tbl: ${refLabel(s)}${die} ->`);
}

/**
 * The rolled working steps a generator emits: its explicit `steps:` list, else a
 * single implicit step synthesized from the flat `work`/`roll`/`vs`/`interpret`/
 * `follow` sugar (so pre-`steps:` generators keep working). Empty when the
 * generator declares no roll at all (a header-only `gen:` composing via `emits`).
 */
export function generatorSteps(g: GMGeneratorAspect): GMGenStep[] {
  if (g.steps?.length) return g.steps;
  if (g.roll || g.interpret || g.work || g.follow) {
    return [{ work: g.work, roll: g.roll, vs: g.vs, interpret: g.interpret, follow: g.follow }];
  }
  return [];
}

function emitGenerator(g: GMGeneratorAspect, cf: string | null): string[] {
  const lines = [`gen: ${g.name}`];
  for (const s of generatorSteps(g)) {
    const line = genStepLine(s, cf);
    if (line) lines.push(`  ${line}`);
  }
  return lines;
}

/** One generator step as a bare working line — `<work>: <roll>= [vs <vs>] ->`
 *  (no `gen:` header, no indent). Null when the step declares no roll. Used both
 *  by the generator emitter and to lay a called generator's steps out as `+ `
 *  children of a composing step. */
export function genStepLine(s: GMGenStep, cf: string | null = null): string | null {
  // An unconditional CHOICE step emits a `[a/b/c - ]` dropdown (the GM picks) —
  // no die, so it's checked before the roll guard.
  if (s.choices?.length) {
    const label = s.work ? `${s.work}: ` : "";
    return `${label}[${s.choices.join("/")} - ]`;
  }
  if (!s.roll) return null;
  const label = s.work ? `${s.work}: ` : "";
  const check = s.vs ? `${unrolled(s.roll)} vs ${expandVs(s.vs, cf)}` : unrolled(s.roll);
  return `${label}${check} ->`;
}

/** Guard against a generator `emits:` chain that recurses too deep or cycles. */
const MAX_GEN_DEPTH = 6;

/**
 * Emit a generator plus its composed sub-generators (`emits:`), inline and
 * recursively. Each `emits` piece is emitted after the generator's own line; a
 * piece that is itself a generator with `emits:` expands too, until a repeat
 * (cycle) or the depth cap. `generators` is the feature's local pool for
 * resolving `@id` refs; `seen` tracks already-expanded generators to break cycles.
 */
function emitGeneratorDeep(
  g: GMGeneratorAspect,
  cf: string | null,
  generators: NamedGenerator[] | undefined,
  seen: Set<GMGeneratorAspect>,
  depth: number
): string[] {
  const lines = emitGenerator(g, cf);
  if (!g.emits || depth >= MAX_GEN_DEPTH || seen.has(g)) return lines;
  const nextSeen = new Set(seen).add(g);
  for (const piece of resolveEmits(g.emits, generators)) {
    lines.push(...emitPiece(piece, cf, generators, nextSeen, depth + 1));
  }
  return lines;
}

function emitEvent(e: GMEventAspect): string[] {
  const lines: string[] = [];
  if (e.focus) lines.push(`gen: ${refLabel(e.focus)} ->`);
  for (const m of e.meaning ?? []) lines.push(`gen: ${refLabel(m)} ->`);
  lines.push(`! ${e.text ?? "{{event}}"}`.trimEnd());
  return lines;
}

function emitScene(s: GMSceneAspect): string[] {
  const body = s.opens ?? s.consequence;
  return body ? [`=> ${body}`] : [];
}

/** Emit a single resolved (inline) piece, recursing through generator `emits:`. */
function emitPiece(
  p: InlinePiece,
  cf: string | null,
  generators: NamedGenerator[] | undefined,
  seen: Set<GMGeneratorAspect>,
  depth: number
): string[] {
  if ("oracle" in p) return emitOracle(p.oracle);
  if ("roll" in p) return emitRoll(p.roll, cf);
  if ("table" in p) return emitTable(p.table);
  if ("generator" in p) return emitGeneratorDeep(p.generator, cf, generators, seen, depth);
  if ("event" in p) return emitEvent(p.event);
  if ("scene" in p) return emitScene(p.scene);
  return [];
}

/**
 * Assemble a GM feature into the multi-line lonelog template a card appends to
 * the session log.
 */
export function emitGMFeature(feature: GMFeature): string {
  const cf = cfToken(feature);
  const lines: string[] = [];
  for (const stack of gmStacks(feature)) {
    switch (stack) {
      case "oracle":
        lines.push(...emitOracle(feature.oracle!));
        break;
      case "roll":
        lines.push(...emitRoll(feature.roll!, cf));
        break;
      case "table":
        lines.push(...emitTable(feature.table!));
        break;
      case "generator":
        lines.push(...emitGeneratorDeep(feature.generator!, cf, feature.generators, new Set(), 0));
        break;
      case "event":
        lines.push(...emitEvent(feature.event!));
        break;
      case "scene":
        lines.push(...emitScene(feature.scene!));
        break;
    }
  }
  return lines.join("\n");
}

/** An inline emit piece (an `@ref` string resolved to its aspect). */
type InlinePiece = Exclude<EmitPiece, string>;

/**
 * Resolve a card's `emits`: keep inline pieces; turn a local `@id` ref into the
 * matching `generators:` entry. Refs with no local match (e.g. a cross-file
 * `@[[File]]#id`) are dropped here — the load layer pre-resolves those.
 */
function resolveEmits(emits: EmitPiece[], generators?: NamedGenerator[]): InlinePiece[] {
  const local: Record<string, GMGeneratorAspect> = {};
  for (const g of generators ?? []) local[`@${g.id}`] = g;
  const out: InlinePiece[] = [];
  for (const p of emits) {
    if (typeof p === "string") {
      const g = local[p.trim()];
      if (g) out.push({ generator: g });
    } else out.push(p);
  }
  return out;
}

/** The resource token VALUE shared across a card's pieces (from its oracle) —
 *  the generator's `vs:` reads the same slot/literal the oracle emits. */
function cardCfToken(pieces: InlinePiece[]): string | null {
  const o = pieces.find((p): p is { oracle: GMOracleAspect } => "oracle" in p)?.oracle;
  return oracleCf(o)?.value ?? null;
}

/**
 * Assemble a declared CARD's `emits` (ordered pieces) into its lonelog template.
 * Unlike a feature's fixed aspect order, a card emits its pieces in the order
 * written; `@ref` strings resolve against the feature's `generators:`.
 */
export function emitCard(card: GMCardDef, generators?: NamedGenerator[]): string {
  const pieces = resolveEmits(card.emits, generators);
  const cf = cardCfToken(pieces);
  const seen = new Set<GMGeneratorAspect>();
  const lines: string[] = [];
  for (const p of pieces) lines.push(...emitPiece(p, cf, generators, seen, 0));
  return lines.join("\n");
}

/** The stack a card lives under: explicit `stack:` or its first emit piece's aspect. */
export function cardPrimaryStack(card: GMCardDef, generators?: NamedGenerator[]): GMStack | null {
  if (card.stack) return card.stack;
  const first = resolveEmits(card.emits, generators)[0];
  if (!first) return null;
  return ASPECT_ORDER.find((k) => k in first) ?? null;
}
