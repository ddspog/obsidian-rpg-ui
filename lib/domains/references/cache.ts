/**
 * File-content cache for the reference resolver.
 *
 * Keeps a per-path snapshot of `{ frontmatter, fencesByKey }` so the
 * post-processor doesn't re-read + re-parse every file on each render.
 * Entries are invalidated by vault modify / metadata-cache change
 * events (wired in `main.ts`); consumers subscribe to the `change`
 * signal to know when their rendered refs need re-resolving.
 */

import { extractAllRpgFences, groupFences } from "./fence-scan";
import type { FileRefView } from "./resolve";

/** Minimal Obsidian surface the cache needs. Narrowing here keeps the
 *  unit tests pure — a fake adapter works in Vitest without dragging
 *  `obsidian` into the module graph. */
export interface VaultAdapter {
  /** Read a file's contents by vault-relative path. Returns `null`
   *  when the file doesn't exist / can't be read (abs paths, binary,
   *  network error). The resolver treats `null` as a cache miss, so
   *  consumers render `missing` and re-try on the next invalidation. */
  readFile(path: string): Promise<string | null>;
  /** Fetch the cached frontmatter for a file — Obsidian's metadata
   *  cache already keeps this in memory, so we reuse it rather than
   *  re-parsing YAML from scratch. */
  getFrontmatter(path: string): Record<string, unknown> | null;
}

export type CacheListener = (path: string) => void;

/**
 * Singleton cache + dependency signal. Each `get` pipe goes through
 * `readFile` at most once per path per invalidation cycle; subsequent
 * calls return the cached view instantly.
 */
export class FileRefCache {
  private entries = new Map<string, Promise<FileRefView | null>>();
  private listeners = new Set<CacheListener>();

  constructor(private adapter: VaultAdapter) {}

  /** Fetch (or reuse) the view for `path`. Returns null when the file
   *  couldn't be read — the caller should surface that as `missing`.
   *
   *  Note: the returned promise is stored, not the resolved value, so
   *  concurrent callers coalesce onto the same read. Invalidation
   *  drops the promise entry so the next call triggers a fresh read. */
  get(path: string): Promise<FileRefView | null> {
    const hit = this.entries.get(path);
    if (hit) return hit;
    const promise = this.build(path);
    this.entries.set(path, promise);
    return promise;
  }

  /** Invalidate a single path. Listeners fire *before* the next
   *  `get()` so subscribers can rebuild their DOM synchronously with
   *  the fresh data once the promise resolves. */
  invalidate(path: string): void {
    if (!this.entries.has(path)) {
      // Still notify — a missing-file reference may now exist.
      this.emit(path);
      return;
    }
    this.entries.delete(path);
    this.emit(path);
  }

  /** Drop everything — useful on plugin unload / workspace switch. */
  clear(): void {
    this.entries.clear();
  }

  /** Subscribe to per-path invalidation events. Returns an unsubscribe
   *  thunk so consumers (post-processor render children) can clean up
   *  on their own lifecycle. */
  onChange(fn: CacheListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async build(path: string): Promise<FileRefView | null> {
    const contents = await this.adapter.readFile(path);
    if (contents == null) return null;
    const frontmatter = this.adapter.getFrontmatter(path) ?? {};
    const fences = extractAllRpgFences(contents);
    return {
      frontmatter,
      fencesByKey: groupFences(fences),
    };
  }

  private emit(path: string): void {
    for (const l of this.listeners) {
      try {
        l(path);
      } catch {
        // Listener errors must not poison sibling listeners — the
        // registry rebuilds DOM from a dependency graph and one
        // broken element shouldn't stall the rest.
      }
    }
  }
}
