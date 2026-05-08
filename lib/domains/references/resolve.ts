/**
 * Walk a parsed `@[[File]].path` reference against a cached file view
 * (frontmatter + grouped fences) to produce the resolved value.
 *
 * Resolution rules:
 *   1. `metadata.*` → walk subsequent steps against frontmatter.
 *   2. `<entity>.<block>[…].*` → explicit form: look up the fence group
 *      `<entity>.<block>` and pick a body via `[N]` / `[Name]` (falling
 *      back to `[0]` when neither is given).
 *   3. **Shorthand form** (anything else): try the literal path across
 *      every data source (frontmatter + each fence body in doc order),
 *      and if that still misses, deep-find the first step's key inside
 *      each source before continuing the walk. Lets authors write
 *      `@[[Leather]].cost` (top-level fence field), `@[[Leather]].ac`
 *      (nested `armor.ac`), and `@[[Talon]].cssclasses` (frontmatter key)
 *      without repeating the entity/block prefix.
 */

import type { ParsedRef, RefStep } from "./parse";
import type { FenceMatch } from "./fence-scan";

/** The data source the resolver walks — owned + cached by the registry. */
export interface FileRefView {
  frontmatter: Record<string, unknown>;
  /** Grouped fences: keyed by `<entity>.<block>`, preserving doc order. */
  fencesByKey: Record<string, FenceMatch[]>;
}

export type ResolveKind = "scalar" | "object" | "array" | "missing" | "invalid";

export interface ResolveResult {
  kind: ResolveKind;
  /** The resolved value (scalar / object / array) or `undefined` when
   *  the path couldn't be walked. */
  value: unknown;
  /** Human-readable path trace for errors (`item.element[0].weapon.bogus`). */
  trace: string;
  /** Reason for a non-`scalar`/`object` resolve — surfaced as a tooltip
   *  on missing references so authors can spot the typo inline. */
  reason?: string;
}

/**
 * Resolve a parsed reference against the given file view. This never
 * throws — every failure mode collapses to a `missing` / `invalid`
 * result so the post-processor can render a consistent inline marker.
 */
export function resolveReference(ref: ParsedRef, view: FileRefView): ResolveResult {
  const { steps } = ref;
  if (steps.length === 0) {
    return { kind: "invalid", value: undefined, trace: "", reason: "No path after the file reference" };
  }

  const first = steps[0];
  // `metadata.*` path — walk directly over the frontmatter.
  if (first.kind === "key" && first.name === "metadata") {
    return walkValue(view.frontmatter, steps.slice(1), "metadata");
  }

  // Explicit `<entity>.<block>[idx?]…` form: try this first. If the
  // entity/block pair names an existing fence group we treat the
  // reference as qualified and never fall through to the shorthand
  // resolver (the author signalled the data source explicitly).
  if (first.kind === "key" && steps[1]?.kind === "key") {
    const key = `${first.name}.${steps[1].name}`;
    const fences = view.fencesByKey[key];
    if (fences) {
      return resolveExplicit(fences, steps, key);
    }
  }

  // Shorthand: no explicit `<entity>.<block>` prefix — search every
  // data source (frontmatter + each fence body in doc order) for a
  // matching path. First try the literal step walk; if that misses,
  // deep-find the initial step's key name and walk the rest from there.
  return resolveShorthand(view, steps);
}

/**
 * Resolve an explicit `<entity>.<block>[idx?][.rest…]` reference against
 * the matched fence group. Pulled out of the main resolver so the
 * shorthand path doesn't have to thread around it.
 */
function resolveExplicit(fences: FenceMatch[], steps: RefStep[], key: string): ResolveResult {
  const third = steps[2];
  let chosen: FenceMatch | undefined;
  let restStart = 2;
  if (third?.kind === "index") {
    chosen = fences[third.index];
    restStart = 3;
  } else if (third?.kind === "named") {
    chosen = fences.find((f) => (f.name ?? "").toLowerCase() === third.name.toLowerCase());
    restStart = 3;
  } else {
    chosen = fences[0];
  }
  if (!chosen) {
    return {
      kind: "missing",
      value: undefined,
      trace: traceSteps(steps.slice(0, restStart)),
      reason: `No \`rpg ${key}\` fence matches`,
    };
  }
  if (!chosen.body) {
    return {
      kind: "invalid",
      value: undefined,
      trace: traceSteps(steps.slice(0, restStart)),
      reason: `\`rpg ${key}\` fence body failed to parse`,
    };
  }
  return walkValue(chosen.body, steps.slice(restStart), traceSteps(steps.slice(0, restStart)));
}

/**
 * Shorthand resolution: the first step isn't a known `<entity>.<block>`
 * prefix, so walk the entire step list across each data source and
 * return the first hit. Ordered probes — frontmatter first, then each
 * fence body in doc order.
 *
 * Surface-only: each probe walks the steps literally from the source's
 * root. No deep-key fallback — `@[[Leather]].ac` does *not* reach the
 * nested `armor.ac`; authors spell that as `@[[Leather]].armor.ac` so
 * same-named keys in different blocks never collide by accident.
 */
function resolveShorthand(view: FileRefView, steps: RefStep[]): ResolveResult {
  const probes: Array<{ label: string; data: unknown }> = [
    { label: "metadata", data: view.frontmatter },
  ];
  for (const [key, fences] of Object.entries(view.fencesByKey)) {
    fences.forEach((f, i) => {
      if (f.body) probes.push({ label: fences.length > 1 ? `${key}[${i}]` : key, data: f.body });
    });
  }

  let lastTrace = "";
  for (const probe of probes) {
    const result = walkValue(probe.data, steps, probe.label);
    if (result.kind !== "missing") return result;
    lastTrace = result.trace;
  }

  return {
    kind: "missing",
    value: undefined,
    trace: lastTrace || traceSteps(steps),
    reason: "No matching path in metadata or any `rpg <entity>.<block>` fence",
  };
}

/**
 * Walk the remaining steps over an arbitrary JS value (frontmatter
 * object, fence body, or any sub-slice of either). Returns `missing`
 * at the first step that can't be satisfied, preserving the trace so
 * the author sees exactly which segment broke.
 */
function walkValue(initial: unknown, steps: RefStep[], baseTrace: string): ResolveResult {
  let value: unknown = initial;
  let trace = baseTrace;
  for (const step of steps) {
    trace = appendStep(trace, step);
    if (value == null) {
      return { kind: "missing", value: undefined, trace, reason: `Cannot walk through ${value === null ? "null" : "undefined"}` };
    }
    if (step.kind === "key") {
      if (typeof value !== "object" || Array.isArray(value)) {
        return { kind: "missing", value: undefined, trace, reason: `Cannot read \`.${step.name}\` on a non-object` };
      }
      value = (value as Record<string, unknown>)[step.name];
    } else if (step.kind === "index") {
      if (!Array.isArray(value)) {
        return { kind: "missing", value: undefined, trace, reason: `Cannot index a non-array` };
      }
      value = value[step.index];
    } else if (step.kind === "named") {
      if (!Array.isArray(value)) {
        return { kind: "missing", value: undefined, trace, reason: `[${step.name}] requires an array of named entries` };
      }
      value = value.find((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const name = (entry as Record<string, unknown>).name;
        return typeof name === "string" && name.toLowerCase() === step.name.toLowerCase();
      });
    }
    if (value === undefined) {
      return { kind: "missing", value: undefined, trace, reason: "Path ends before the step" };
    }
  }
  return classifyValue(value, trace);
}

function classifyValue(value: unknown, trace: string): ResolveResult {
  if (value === undefined || value === null) {
    return { kind: "missing", value: undefined, trace };
  }
  if (Array.isArray(value)) {
    return { kind: "array", value, trace };
  }
  if (typeof value === "object") {
    return { kind: "object", value, trace };
  }
  return { kind: "scalar", value, trace };
}

function appendStep(trace: string, step: RefStep): string {
  if (step.kind === "key") return trace ? `${trace}.${step.name}` : step.name;
  if (step.kind === "index") return `${trace}[${step.index}]`;
  return `${trace}[${step.name}]`;
}

function traceSteps(steps: RefStep[]): string {
  let acc = "";
  for (const s of steps) acc = appendStep(acc, s);
  return acc;
}
