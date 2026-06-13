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
  GMEventAspect,
  GMFeature,
  GMGeneratorAspect,
  GMOracleAspect,
  GMRollAspect,
  GMSceneAspect,
  GMStack,
  GMTableAspect,
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

/** The chaos-factor token shared across a feature's aspects: a baked literal
 *  (`cf:` constant) or a `{{cf}}` fill-slot when chaotic, else null. */
function cfToken(feature: GMFeature): string | null {
  const o = feature.oracle;
  if (o?.cf != null) return String(o.cf);
  if (o?.chaos) return "{{cf}}";
  return null;
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

/** Display label for an `@[[path|alias]]` call or bare string — the alias, else
 *  the last path segment with any `.md` extension stripped. */
export function refLabel(ref: string): string {
  let s = ref.trim();
  const call = s.match(/@?\[\[([^\]]+)\]\]/);
  if (call) s = call[1];
  const pipe = s.indexOf("|");
  if (pipe >= 0) return s.slice(pipe + 1).trim();
  const seg = s.split("/").pop() ?? s;
  return seg.replace(/\.md$/i, "").replace(/#.*$/, "").trim();
}

function emitOracle(o: GMOracleAspect, cf: string | null): string[] {
  const head = "?" + (o.attribution ? `(${o.attribution})` : "");
  const cfTag = cf ? ` [CF:${cf}]` : "";
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
  return [`tbl: ${refLabel(t.source)}${die} ->`];
}

function emitGenerator(g: GMGeneratorAspect, cf: string | null): string[] {
  const lines = [`gen: ${g.name}`];
  if (g.roll) {
    const label = g.work ? `${g.work}: ` : "";
    const check = g.vs ? `${unrolled(g.roll)} vs ${expandVs(g.vs, cf)}` : unrolled(g.roll);
    lines.push(`  ${label}${check} ->`);
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
        lines.push(...emitOracle(feature.oracle!, cf));
        break;
      case "roll":
        lines.push(...emitRoll(feature.roll!, cf));
        break;
      case "table":
        lines.push(...emitTable(feature.table!));
        break;
      case "generator":
        lines.push(...emitGenerator(feature.generator!, cf));
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
