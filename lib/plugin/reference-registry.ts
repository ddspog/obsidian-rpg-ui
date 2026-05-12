/**
 * Central registry tracking which rendered DOM elements depend on
 * which target files, so the cache-invalidation listener can surgically
 * re-resolve and re-render just those elements when a source file
 * changes — no full-page rerender, no stale read-through.
 *
 * Sits alongside `FileRefCache`: the cache owns the data, the registry
 * owns the mapping from data-path → live DOM. Decoupled so the
 * resolver + parser can stay pure (and jsdom-free) in the test suite.
 */

import type { FileRefCache } from "lib/domains/references";
import type { ParsedRef, ResolveResult } from "lib/domains/references";
import { resolveReference } from "lib/domains/references";

/** Minimal element bookkeeping — we don't keep the `ParsedRef` on the
 *  element directly (DOM attributes only hold strings), so the registry
 *  owns the parsed ASTs and looks them up via a WeakMap per element. */
interface Binding {
  ref: ParsedRef;
  /** Vault path of the resolved target file. Kept separately from
   *  `ref.target` because the target may be a wikilink with an alias
   *  (`[[folder/Item|Alias]]`) and we need the actual file path to
   *  match vault-modify events. */
  targetPath: string;
  /** Render callback invoked with a fresh `ResolveResult` each time
   *  the underlying data changes. Owns the DOM swap. */
  render: (result: ResolveResult, el: HTMLElement) => void;
}

/** Per-target-path element index. Elements are tracked via WeakRef so
 *  the registry can't prevent DOM garbage collection — dead entries
 *  are pruned lazily on the next invalidation. */
export class ReferenceRegistry {
  private byPath = new Map<string, Set<HTMLElement>>();
  private bindings = new WeakMap<HTMLElement, Binding>();
  private pendingPaths = new Set<string>();
  private rafId: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private cache: FileRefCache) {
    this.unsubscribe = cache.onChange((path) => this.schedule(path));
  }

  /** Attach an element to a (targetPath, parsedRef, render) tuple.
   *  Returns a detach thunk the render-child should call on unload. */
  register(el: HTMLElement, binding: Binding): () => void {
    this.bindings.set(el, binding);
    const set = this.byPath.get(binding.targetPath) ?? new Set();
    set.add(el);
    this.byPath.set(binding.targetPath, set);
    return () => this.detach(el, binding.targetPath);
  }

  /** Drop all tracked elements — called on plugin unload. */
  dispose(): void {
    this.unsubscribe?.();
    this.byPath.clear();
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Queue a path for re-resolution on the next animation frame. Bursts
   *  (e.g. typing into a live-previewed source file) coalesce into a
   *  single batch so we don't thrash the DOM. */
  private schedule(path: string): void {
    this.pendingPaths.add(path);
    if (this.rafId != null) return;
    const schedule =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn: () => void) => setTimeout(fn, 16) as unknown as number;
    this.rafId = schedule(() => {
      this.rafId = null;
      const paths = Array.from(this.pendingPaths);
      this.pendingPaths.clear();
      void this.flush(paths);
    });
  }

  private async flush(paths: string[]): Promise<void> {
    for (const path of paths) {
      const set = this.byPath.get(path);
      if (!set || set.size === 0) continue;
      const view = await this.cache.get(path);
      for (const el of Array.from(set)) {
        // Prune orphaned elements — once a note is closed, its DOM
        // nodes detach from `document`; we reap them here rather than
        // forcing each render-child to unregister on `onunload`.
        if (!el.isConnected) {
          set.delete(el);
          this.bindings.delete(el);
          continue;
        }
        const binding = this.bindings.get(el);
        if (!binding) continue;
        const result: ResolveResult = view
          ? resolveReference(binding.ref, view)
          : {
              kind: "missing",
              value: undefined,
              trace: binding.ref.source,
              reason: `File not found: ${binding.targetPath}`,
            };
        try {
          binding.render(result, el);
        } catch {
          // A broken render callback must not stall the batch.
        }
      }
    }
  }

  private detach(el: HTMLElement, targetPath: string): void {
    const set = this.byPath.get(targetPath);
    set?.delete(el);
    this.bindings.delete(el);
  }
}
