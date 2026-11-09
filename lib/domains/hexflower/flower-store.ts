/**
 * Where each hex flower's token stands and what it rolled, kept in memory per note and flower so a
 * re-render (scrolling, editing elsewhere in the note) keeps the walk. Like table rolls, it isn't
 * written to disk: a plugin reload starts every flower at Start.
 */

import type { FlowerState, FlowerStep } from "./hex-flower";

export interface FlowerRecord {
  state: FlowerState;
  /** Newest first. */
  history: FlowerStep[];
}

const store = new Map<string, FlowerRecord>();
const listeners = new Map<string, Set<() => void>>();

export function getFlower(key: string): FlowerRecord | undefined {
  return store.get(key);
}

export function setFlower(key: string, record: FlowerRecord | undefined): void {
  if (record) store.set(key, record);
  else store.delete(key);
  for (const l of listeners.get(key) ?? []) l();
}

export function subscribeFlower(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set?.size === 0) listeners.delete(key);
  };
}
