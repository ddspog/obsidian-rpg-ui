/**
 * Resource-op accumulator (historically "dial-op").
 *
 * Walks lonelog entries in document order and folds every resource operation
 * (`[<abbr><op>]` session, or `[<Character>/<Resource><op>]` PC — both parsed
 * into a `DialOpTag`) onto a running value, seeded from the matching resource's
 * declared `default` and clamped to its `min..max`. Ops with no declared
 * resource are inert. Pure: the render layer supplies the declarations (a
 * `feature.gm` body uses its own `resources`/`dial`; a live `rpg log` uses the
 * resources loaded from its GM Screen). Session resources are keyed by `abbr`;
 * PC resources' DECL by resource name, RUNNING value per `Character/Resource`.
 */

import type { DialOpTag, LonelogEntry, PersistentTag } from "./types";
import type { GMFeature, ResourceDecl } from "../features/types";

/** A declared resource the accumulator resolves ops against. */
export interface DialDecl {
  /** Registry key: the abbr (session) or the resource name (PC). */
  key: string;
  min: number;
  max: number;
  default: number;
  /** Display name (e.g. "Chaos Factor"); falls back to `key` when absent. */
  name?: string;
  /** Shape, for future per-shape rendering; unused by the fold. */
  shape?: "dial" | "clock" | "track" | "counter" | "charges" | "timer";
}

/** One resolved op: the running value at this point, ready for the pill. */
export interface ResolvedDialOp {
  key: string;
  name: string;
  op: DialOpTag["op"];
  amount?: number;
  current: number;
  min: number;
  max: number;
  /** From a question's leading `[CF:n]`, not a written op — no pill of its own. */
  stated?: boolean;
}

/**
 * Each session resource's declared default, keyed by its abbr (`CF` → 5) — the
 * value a bare `vs CF` reads before the log has set or moved it. PC resources
 * (keyed by name, not an ALLCAPS abbr) are left out.
 */
export function resourceDefaults(decls: Record<string, DialDecl>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, decl] of Object.entries(decls)) {
    if (/^[A-Z]{2,}$/.test(key)) out[key] = decl.default;
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The DECL-lookup key for an op: session → abbr; PC → resource name. */
export function declKey(t: DialOpTag): string {
  return t.abbr ?? t.name ?? "";
}

/** The RUNNING-value key for an op: session → abbr; PC → `Character/Resource`. */
export function runKey(t: DialOpTag): string {
  return t.pc && t.name ? `${t.pc}/${t.name}` : (t.abbr ?? "");
}

/**
 * Normalize a declared resource to the engine form `{ key, min, max, default }`.
 * The registry key is the `abbr` (session) when present, else the resource
 * `name` (PC). Shapes: dial (band as declared), clock/track (0..max, start 0),
 * counter/charges (0..max, start FULL), timer (0..max, start full / counts down).
 */
export function normalizeResource(decl: ResourceDecl): DialDecl {
  if ("dial" in decl) {
    const d = decl.dial;
    return { key: d.abbr, min: d.min, max: d.max, default: d.default, name: d.name ?? d.abbr, shape: "dial" };
  }
  if ("clock" in decl || "track" in decl) {
    const c = "clock" in decl ? decl.clock : decl.track;
    const shape = "clock" in decl ? "clock" : "track";
    return { key: c.abbr ?? c.name ?? shape, min: 0, max: c.max, default: 0, name: c.name ?? c.abbr, shape };
  }
  // counter / charges / timer — start full, spend/tick down.
  const c = "counter" in decl ? decl.counter : "charges" in decl ? decl.charges : decl.timer;
  const shape = "counter" in decl ? "counter" : "charges" in decl ? "charges" : "timer";
  return { key: c.abbr ?? c.name ?? shape, min: 0, max: c.max, default: c.max, name: c.name ?? c.abbr, shape };
}

/** Fold a list of resource declarations into a registry, keyed by abbr (session)
 *  or resource name (PC). First declaration of a key wins. Mutates + returns
 *  `into` so callers can accumulate across sources (GM features + PC features). */
export function foldResources(decls: ResourceDecl[], into: Record<string, DialDecl> = {}): Record<string, DialDecl> {
  for (const decl of decls) {
    const d = normalizeResource(decl);
    if (!into[d.key]) into[d.key] = d;
  }
  return into;
}

/** Build a resource registry (keyed by abbr / resource name) from a set of
 *  features: each feature's `dial` aspect (sugar for a dial resource) plus every
 *  `resources:` declaration. First declaration of a key wins. */
export function collectResources(features: GMFeature[]): Record<string, DialDecl> {
  const out: Record<string, DialDecl> = {};
  for (const f of features) {
    if (f.dial?.abbr) {
      const d = normalizeResource({ dial: { ...f.dial, name: f.name } });
      if (!out[d.key]) out[d.key] = d;
    }
    foldResources(f.resources ?? [], out);
  }
  return out;
}

/** Collect resource declarations from PC-side features (`feature.details` /
 *  `feature.choice`) into an existing (or new) registry — the shared lonelog
 *  vocabulary, so a character's `resources:` power its `[Char/Resource op]`
 *  running values the same way GM `resources:` power session `[ABBR op]`. */
export function collectResourceDecls(
  hosts: Array<{ resources?: ResourceDecl[] }>,
  into: Record<string, DialDecl> = {}
): Record<string, DialDecl> {
  for (const host of hosts) foldResources(host.resources ?? [], into);
  return into;
}

/** Tags carried by an entry — persistent tags on consequence/world_event, plus
 *  resource ops on an oracle-question line. */
function entryTags(entry: LonelogEntry): PersistentTag[] {
  if (entry.type === "consequence" || entry.type === "world_event") return entry.tags;
  if (entry.type === "oracle_question") {
    // `? [CF:4] …` states the Chaos Factor the question runs on — a set, so the
    // dial continues from it (a later `[CF-1]` makes 3, not default − 1).
    const stated: DialOpTag[] =
      entry.chaosFactor != null
        ? [{ kind: "dial-op", abbr: "CF", op: "set", amount: entry.chaosFactor, stated: true }]
        : [];
    return [...stated, ...(entry.dialOps ?? [])];
  }
  return [];
}

/**
 * Fold every resource op in `entries` onto its resource's running value. Returns
 * a map from entry index → the ops resolved on that entry (in order), so the
 * render layer can attach the computed value to the matching sidebar item.
 * `decls` is keyed by abbr (session) and resource name (PC).
 */
export function resolveDialOps(
  entries: LonelogEntry[],
  decls: Record<string, DialDecl>
): Map<number, ResolvedDialOp[]> {
  const running: Record<string, number> = {};
  const out = new Map<number, ResolvedDialOp[]>();

  entries.forEach((entry, i) => {
    for (const tag of entryTags(entry)) {
      if (tag.kind !== "dial-op") continue;
      const decl = decls[declKey(tag)];
      if (!decl) continue; // unmatched → inert
      const rk = runKey(tag);
      const prev = running[rk] ?? decl.default;
      let next = prev;
      if (tag.op === "set") next = tag.amount ?? prev;
      else if (tag.op === "inc") next = prev + (tag.amount ?? 0);
      else if (tag.op === "dec") next = prev - (tag.amount ?? 0);
      // "inspect" leaves the value unchanged.
      next = clamp(next, decl.min, decl.max);
      running[rk] = next;
      const resolved: ResolvedDialOp = {
        key: rk,
        name: decl.name ?? decl.key,
        op: tag.op,
        amount: tag.amount,
        current: next,
        min: decl.min,
        max: decl.max,
        ...(tag.stated ? { stated: true } : {}),
      };
      const list = out.get(i);
      if (list) list.push(resolved);
      else out.set(i, [resolved]);
    }
  });

  return out;
}
