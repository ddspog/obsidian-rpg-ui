/**
 * Fog that remembers: the hexes each session log's party saw on a travel map, kept by log (in the
 * plugin's state file) so another log's Fog starts from what the earlier ones saw. A log's own
 * hexes are never counted from the store, so stepping back through it still uncovers them in turn.
 */

import { explored } from "lib/domains/hexmap/play";
import type { TravelTrack } from "./travel";

/** What each log saw on one map: log path → hex keys. */
export type FogStore = Record<string, string[]>;

/** The key a map's memory is kept under. */
export const fogKey = (map: string) =>
  `travel-fog:${map
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .trim()}`;

/** The hexes this log's party saw on each map (by `[TRAVEL]` map, as written): where everyone
 *  stood and walked, and the ring round each. */
export function seenByMap(track: TravelTrack): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const f of track.frames) {
    if (!f.map) continue;
    const hexes = [...Object.values(f.trails).flat(), ...Object.values(f.positions)].map(([q, r]) => ({ q, r }));
    let set = out.get(f.map);
    if (!set) out.set(f.map, (set = new Set()));
    for (const k of explored(hexes, 1)) set.add(k);
  }
  return new Map([...out].map(([m, s]) => [m, [...s].sort()]));
}

/** The store with this log's hexes in (replacing what it had); unchanged when they're the same. */
export function withLog(store: FogStore, log: string, keys: string[]): FogStore {
  const had = store[log];
  if (had && had.length === keys.length && had.every((k, i) => k === keys[i])) return store;
  return { ...store, [log]: keys };
}

/** What other logs saw. */
export function rememberedBy(store: FogStore, log: string): Set<string> {
  const out = new Set<string>();
  for (const [other, keys] of Object.entries(store)) if (other !== log) for (const k of keys) out.add(k);
  return out;
}
