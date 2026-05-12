/**
 * In-memory store for roll outcomes.
 *
 * Keyed by `${filePath}:${tableName}:${rowIdx}:${cellIdx}`. Stores the
 * formatted strings for each `{{ roll … }}` expression in the cell (one
 * per expression, in source order). This layer outlives Obsidian's
 * markdown-preview virtualization (components unmount / remount as the
 * user scrolls), so a rolled cell keeps its result until the user clicks
 * again or the plugin reloads.
 *
 * Intentionally module-level and not persisted to disk: the feature is for
 * quick ad-hoc consults, not canon character data. Plugin reload clears
 * every roll — by design.
 */

const store = new Map<string, string[]>();
const listeners = new Map<string, Set<() => void>>();

export function rollStoreKey(filePath: string, tableName: string, rowIdx: number, cellIdx: number): string {
  return `${filePath}:${tableName}:${rowIdx}:${cellIdx}`;
}

export function getRollResult(key: string): string[] | undefined {
  return store.get(key);
}

export function setRollResult(key: string, values: string[]): void {
  store.set(key, values);
  const ls = listeners.get(key);
  if (ls) for (const l of ls) l();
}

export function clearRollResult(key: string): void {
  if (!store.delete(key)) return;
  const ls = listeners.get(key);
  if (ls) for (const l of ls) l();
}

/** Subscribe to updates for a specific key. Returns an unsubscribe fn. */
export function subscribeRollResult(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    const s = listeners.get(key);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(key);
  };
}

/** Test-only: wipe the entire store. */
export function __resetRollStore(): void {
  store.clear();
  listeners.clear();
}
