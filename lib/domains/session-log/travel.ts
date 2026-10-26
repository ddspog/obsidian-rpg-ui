/**
 * Travel in the session log (hex-map-design §14.2), folded from the log: who
 * travels with whom (`[Group:]`), where each group or lone character stands on
 * the overworld hex map (`[Pos:]`, `[Mv:]` with `(q,r)` hexes), the markers
 * standing for a while (`[Mark:]`), and each journey from `[TRAVEL: [[Map]]]`
 * to `[/TRAVEL: arrive … | … | outcome …]`.
 *
 * Groups and positions carry through the whole log — a split in town still
 * holds on the road — and each journey keeps the trail it walked.
 *
 * A token is a group (`Party`, `Scouts`) or a character on their own. A
 * character moved or placed by name while in a group leaves it for that
 * (they went off alone); `[Group: … + Name]` brings them back.
 */

import { segmentTags } from "./initiative";
import type { ProseSegment } from "./prose-grouper";
import type { MarkTag, PersistentTag, TravelMarkerEntry } from "lib/domains/lonelog/types";

export type Hex = [number, number];

export interface TravelMark {
  name: string;
  spec?: string;
  at: Hex;
  until?: string;
}

/** A special move (`[Mv: Party (5,-2) | teleport]`): drawn as a jump of its kind,
 *  not a walk through the hexes between. */
export interface TravelJump {
  token: string;
  via: string;
  /** Where it set off, then each place it went (a route: `(1,0)>(4,-2) | ship`). */
  points: Hex[];
}

export interface TravelFrame {
  /** The segment (its `sourceIndex`). */
  id: number;
  /** The map everyone is on now (the last `[TRAVEL]`'s), and its level. */
  map?: string;
  level?: Hex[];
  /** Inside a `[TRAVEL]` … `[/TRAVEL]` (a walk there draws its path). */
  travelling?: boolean;
  /** The special moves since the last journey set out. */
  jumps?: TravelJump[];
  /** Who acted in it, if anyone. */
  actor?: string;
  /** Groups and their members, as they stand after this entry. */
  groups: Record<string, string[]>;
  /** Where each token (group, or lone character) stands. */
  positions: Record<string, Hex>;
  /** This journey's trail per token so far, its start first. */
  trails: Record<string, Hex[]>;
  marks: TravelMark[];
  /** Tokens that moved in this entry. */
  moved: string[];
}

export interface Journey {
  /** The map as written (`[[Caulkin coast]]`), and a detail level of it. */
  map?: string;
  level?: Hex[];
  /** The `[TRAVEL]` and `[/TRAVEL]` segments' ids. */
  start: number;
  end?: number;
  /** The state as the journey opens (groups, positions and marks so far). */
  opening: TravelFrame;
  frames: TravelFrame[];
  summary?: TravelMarkerEntry["end"];
}

const HEX = /^\((-?\d+),(-?\d+)\)$/;
const hexOf = (s: string): Hex | null => {
  const m = s.match(HEX);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
};
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The hexes between two, a straight line (both ends included). */
function line(a: Hex, b: Hex): Hex[] {
  const n = (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const q = a[0] + (b[0] - a[0]) * t + 1e-6;
    const r = a[1] + (b[1] - a[1]) * t + 1e-6;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(-q - r);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs + q + r);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    out.push([rq + 0, rr + 0]);
  }
  return out;
}

class TravelState {
  map?: string;
  level?: Hex[];
  travelling = false;
  jumps: TravelJump[] = [];
  groups = new Map<string, string[]>();
  positions = new Map<string, Hex>();
  trails = new Map<string, Hex[]>();
  marks = new Map<string, TravelMark>();

  /** The group a name is (by its own name), or the group a character is in. */
  groupNamed(name: string): string | undefined {
    return [...this.groups.keys()].find((g) => same(g, name));
  }
  groupOf(member: string): string | undefined {
    return [...this.groups.entries()].find(([, ms]) => ms.some((m) => same(m, member)))?.[0];
  }
  /** Take characters out of whatever group holds them (they stand where it stood). */
  detach(members: string[]): void {
    for (const m of members) {
      const g = this.groupOf(m);
      if (!g) continue;
      this.groups.set(
        g,
        this.groups.get(g)!.filter((x) => !same(x, m))
      );
      const at = this.positions.get(g);
      if (at && !this.positions.has(m)) this.positions.set(m, at);
    }
  }
  /** The token a name moves: its group if it is one, else the character (leaving a group). */
  token(name: string): string {
    const g = this.groupNamed(name);
    if (g) return g;
    if (this.groupOf(name)) this.detach([name]);
    return name;
  }
  renameToken(from: string, to: string): void {
    for (const map of [this.positions, this.trails] as Array<Map<string, unknown>>) {
      if (!map.has(from)) continue;
      map.set(to, map.get(from));
      map.delete(from);
    }
  }

  group(tag: Extract<PersistentTag, { kind: "group" }>): void {
    const g = this.groupNamed(tag.group) ?? tag.group;
    const members = tag.members ?? [];
    switch (tag.op) {
      case "define":
        this.detach(members);
        this.groups.set(g, [...members]);
        for (const m of members) this.positions.delete(m);
        break;
      case "split": {
        const to = tag.to!;
        this.groups.set(
          g,
          (this.groups.get(g) ?? []).filter((x) => !members.some((m) => same(m, x)))
        );
        this.detach(members);
        this.groups.set(to, [...members]);
        const at = this.positions.get(g);
        if (at) this.positions.set(to, at);
        for (const m of members) this.positions.delete(m);
        break;
      }
      case "merge": {
        const to = this.groupNamed(tag.to!) ?? tag.to!;
        if (!this.groups.has(to)) {
          this.group({ kind: "group", op: "rename", group: g, to });
          break;
        }
        this.groups.set(to, [...this.groups.get(to)!, ...(this.groups.get(g) ?? [])]);
        this.groups.delete(g);
        this.positions.delete(g);
        break;
      }
      case "rename": {
        const to = tag.to!;
        this.groups.set(to, this.groups.get(g) ?? []);
        this.groups.delete(g);
        this.renameToken(g, to);
        break;
      }
      case "add":
        this.detach(members);
        this.groups.set(g, [...(this.groups.get(g) ?? []), ...members]);
        for (const m of members) this.positions.delete(m);
        break;
      case "remove": {
        const at = this.positions.get(g);
        this.groups.set(
          g,
          (this.groups.get(g) ?? []).filter((x) => !members.some((m) => same(m, x)))
        );
        if (at) for (const m of members) this.positions.set(m, at);
        break;
      }
    }
  }

  mark(tag: MarkTag): void {
    if (tag.end) {
      this.marks.delete(tag.name);
      return;
    }
    const had = this.marks.get(tag.name);
    const at = tag.at ?? had?.at;
    if (!at) return;
    this.marks.set(tag.name, {
      name: tag.name,
      spec: tag.spec ?? had?.spec,
      at,
      until: tag.until ?? had?.until,
    });
  }

  /** Place a token (a hex `at`), its trail starting there if it has none. */
  place(name: string, at: Hex): string {
    const t = this.token(name);
    this.positions.set(t, at);
    if (!this.trails.has(t)) this.trails.set(t, [at]);
    return t;
  }

  /** A special move: a jump to where it ends, its route kept as waypoints. */
  jump(name: string, path: Hex[], via: string): string {
    const t = this.token(name);
    const from = this.positions.get(t);
    this.jumps.push({ token: t, via, points: [...(from ? [from] : []), ...path] });
    this.positions.set(t, path[path.length - 1]);
    return t;
  }

  /** Off the journey: everyone stands where they're moved, no path drawn. */
  step(name: string, path: Hex[]): string {
    const t = this.token(name);
    this.positions.set(t, path[path.length - 1]);
    return t;
  }

  move(name: string, path: Hex[]): string {
    const t = this.token(name);
    let from = this.positions.get(t);
    const trail = this.trails.get(t) ?? (from ? [from] : []);
    for (const step of path) {
      trail.push(...(from ? line(from, step).slice(1) : [step]));
      from = step;
    }
    if (from) this.positions.set(t, from);
    this.trails.set(t, trail);
    return t;
  }

  frame(id: number, actor: string | undefined, moved: string[]): TravelFrame {
    return {
      id,
      actor,
      ...(this.map ? { map: this.map } : {}),
      ...(this.level ? { level: this.level } : {}),
      travelling: this.travelling,
      jumps: this.jumps.map((j) => ({ ...j, points: j.points.map((h) => [...h] as Hex) })),
      groups: Object.fromEntries([...this.groups].map(([g, ms]) => [g, [...ms]])),
      positions: Object.fromEntries([...this.positions].map(([k, v]) => [k, [...v] as Hex])),
      trails: Object.fromEntries([...this.trails].map(([k, v]) => [k, v.map((h) => [...h] as Hex)])),
      marks: [...this.marks.values()].map((m) => ({ ...m })),
      moved,
    };
  }
}

/** Who an action moves when its `[Mv:]` names no one: the actor, or each of `A+B`. */
const actorsOf = (actor: string | undefined): string[] =>
  actor
    ? actor
        .split("+")
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

/** Every journey in the log, with its state after each entry. */
export function foldTravels(segments: ProseSegment[]): Journey[] {
  return foldTravelTrack(segments).journeys;
}

/**
 * The whole log's travel: its journeys, and the state after every entry from
 * the scene where a map is first set out on — positions and groups declared
 * before the `[TRAVEL]` in that scene count, as do moves after the journey ends
 * (it keeps the path it drew) and special moves anywhere.
 */
export interface TravelTrack {
  journeys: Journey[];
  /** One per entry from `from` on, in order. */
  frames: TravelFrame[];
  /** The segment the minimap shows from: the scene the first map is in (its first entry). */
  from?: number;
}

export function foldTravelTrack(segments: ProseSegment[]): TravelTrack {
  const state = new TravelState();
  const journeys: Journey[] = [];
  const frames: TravelFrame[] = [];
  let open: Journey | null = null;

  // The minimap starts with the scene the first map is set out in, on that map.
  const firstTravel = segments.findIndex((sg) => sg.type === "travel-start");
  let from: number | undefined;
  if (firstTravel >= 0) {
    let i = firstTravel;
    while (i > 0 && segments[i].type !== "scene") i--;
    from = segments[i].sourceIndex;
    const first = segments[firstTravel];
    if (first.type === "travel-start") {
      state.map = first.entry.map;
      state.level = first.entry.level;
    }
  }

  for (const seg of segments) {
    const tracking = from !== undefined && seg.sourceIndex >= from;
    if (seg.type === "travel-start") {
      // Each journey keeps the path it walks; it starts where everyone stands.
      state.trails = new Map([...state.positions].map(([k, v]) => [k, [v]]));
      state.jumps = [];
      state.map = seg.entry.map ?? state.map;
      state.level = seg.entry.level;
      state.travelling = true;
      open = {
        map: seg.entry.map,
        level: seg.entry.level,
        start: seg.sourceIndex,
        opening: state.frame(seg.sourceIndex, undefined, []),
        frames: [],
      };
      journeys.push(open);
      if (tracking) frames.push(state.frame(seg.sourceIndex, undefined, []));
      continue;
    }
    if (seg.type === "travel-end") {
      if (open) {
        open.end = seg.sourceIndex;
        open.summary = seg.entry.end;
        open = null;
      }
      state.travelling = false;
      if (tracking) frames.push(state.frame(seg.sourceIndex, undefined, []));
      continue;
    }
    const actor = seg.type === "action-group" ? seg.action.actor : undefined;
    const tags = [...(seg.type === "action-group" ? (seg.action.tags ?? []) : []), ...segmentTags(seg)];
    const moved: string[] = [];
    let touched = false;
    for (const tag of tags) {
      if (tag.kind === "group") {
        state.group(tag);
        touched = true;
      } else if (tag.kind === "mark") {
        state.mark(tag);
        touched = true;
      } else if (tag.kind === "position") {
        for (const e of tag.entries) {
          const at = hexOf(e.at);
          if (!at) continue;
          moved.push(state.place(e.name, at));
          touched = true;
        }
      } else if (tag.kind === "move") {
        const path = tag.path.map(hexOf);
        if (path.length === 0 || path.some((h) => !h)) continue;
        const who = tag.who ? [tag.who] : actorsOf(actor);
        for (const w of who) {
          // A walk draws its path inside a journey; a special move is a jump, anywhere.
          if (tag.via && tag.via !== "walk") moved.push(state.jump(w, path as Hex[], tag.via));
          else if (state.travelling) moved.push(state.move(w, path as Hex[]));
          else moved.push(state.step(w, path as Hex[]));
        }
        touched = who.length > 0;
      }
    }
    const frame =
      (open && (touched || seg.type === "action-group" || seg.type === "narrative")) || tracking
        ? state.frame(seg.sourceIndex, actor, moved)
        : null;
    if (frame && open && (touched || seg.type === "action-group" || seg.type === "narrative")) open.frames.push(frame);
    if (frame && tracking) frames.push(frame);
  }
  return { journeys, frames, ...(from !== undefined ? { from } : {}) };
}

/** The travel state at an entry: the last frame at or before it; none before the track starts. */
export function trackAt(track: TravelTrack, id: number): TravelFrame | null {
  if (track.from === undefined || id < track.from) return null;
  let at: TravelFrame | null = null;
  for (const f of track.frames) {
    if (f.id > id) break;
    at = f;
  }
  return at ?? track.frames[0] ?? null;
}

/** The journey's state at an entry: the last frame at or before it (its opening before any). */
export function journeyAt(journey: Journey, id: number): TravelFrame {
  let at = journey.opening;
  for (const f of journey.frames) {
    if (f.id > id) break;
    at = f;
  }
  return at;
}
