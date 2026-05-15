/**
 * Rule-value resolver: source-of-truth for runtime config values exposed
 * to per-system TypeScript code.
 *
 * Authoring contract — declare values in `rpg rule.content` frontmatter:
 *
 *   ```rpg rule.content
 *   id: luck
 *   values:
 *     max: 5
 *     per_round_gain: 1
 *     reset:
 *       die: d4
 *   ---
 *   You can have a maximum of **5 Luck**…
 *   ```
 *
 * System-config consumption (sync):
 *
 *   import { getRuleValue } from "rpg-ui-toolkit";
 *
 *   attributes: {
 *     luck: {
 *       max: () => getRuleValue<number>("luck", "max", { fallback: 5 }),
 *     },
 *   }
 *
 * Index lifecycle:
 *   - Constructed empty.
 *   - `warmup()` scans every markdown file via the injected FileSource,
 *     parses each via `extractAllRpgFences`, and records every
 *     `rule.content` block that has an `id` + `values`. Run once at
 *     plugin load (background — non-blocking).
 *   - `getValue()` is sync. Before warmup completes, ids not yet in the
 *     index return `opts.fallback`. After warmup, lookups are O(1).
 *   - `invalidate(filePath)` re-scans a single file (call from the
 *     `metadataCache:changed` event handler).
 *
 * The resolver is decoupled from Obsidian via the `FileSource`
 * interface — tests pass a fake source; production wires the Obsidian
 * `App` + `FileRefCache` through `createObsidianFileSource`.
 */

import { extractAllRpgFences } from "lib/domains/references/fence-scan";

/** External I/O surface for the resolver. Allows test fakes. */
export interface FileSource {
  /** Paths of every markdown file in the vault. */
  listMarkdownFiles(): string[];
  /** Read file content as text; null when the file is missing/unreadable. */
  read(path: string): Promise<string | null>;
}

export interface GetValueOpts<T> {
  /** Returned when the id isn't indexed (warmup not done, or no such block). */
  fallback?: T;
}

interface IndexEntry {
  filePath: string;
  values: Record<string, unknown>;
}

export class ValueResolver {
  /** id → entry. Populated by warmup() and invalidate(). */
  private readonly byId = new Map<string, IndexEntry>();
  /** filePath → ids declared in that file (so invalidate can remove stale entries). */
  private readonly idsByFile = new Map<string, Set<string>>();
  private warmupPromise: Promise<void> | null = null;

  constructor(private readonly source: FileSource) {}

  /**
   * Background scan of every markdown file. Idempotent — call once at
   * plugin load. Returns the same Promise on repeat calls so callers can
   * `await` to know when the index is ready (rare; most callers use sync
   * `getValue()` and tolerate fallbacks).
   */
  warmup(): Promise<void> {
    if (this.warmupPromise) return this.warmupPromise;
    this.warmupPromise = (async () => {
      const paths = this.source.listMarkdownFiles();
      // Parallel reads. Each file's parse is small (regex + YAML over a
      // handful of fences), so this is bounded by I/O.
      await Promise.all(paths.map((p) => this.scanFile(p)));
    })();
    return this.warmupPromise;
  }

  /** Re-scan a single file. Call when its content changes. */
  async invalidate(filePath: string): Promise<void> {
    // Drop any prior entries from this file before re-scanning.
    const prior = this.idsByFile.get(filePath);
    if (prior) {
      for (const id of prior) this.byId.delete(id);
      this.idsByFile.delete(filePath);
    }
    await this.scanFile(filePath);
  }

  /**
   * Sync lookup. `path` supports dotted notation (`"reset.die"`).
   * Returns the value at that path, or `opts.fallback` if any segment
   * is missing.
   */
  getValue<T = unknown>(id: string, path: string, opts: GetValueOpts<T> = {}): T | undefined {
    const entry = this.byId.get(id);
    if (!entry) return opts.fallback;
    const value = walkPath(entry.values, path);
    return value === undefined ? opts.fallback : (value as T);
  }

  /** All values for a single id, or undefined when not indexed. */
  getValuesById(id: string): Record<string, unknown> | undefined {
    return this.byId.get(id)?.values;
  }

  /** Snapshot of the full index (id → values). For debugging. */
  list(): Map<string, Record<string, unknown>> {
    return new Map(Array.from(this.byId.entries()).map(([id, e]) => [id, e.values]));
  }

  private async scanFile(filePath: string): Promise<void> {
    const text = await this.source.read(filePath);
    if (text == null) return;
    const fences = extractAllRpgFences(text);
    const ids = new Set<string>();
    for (const fence of fences) {
      if (fence.entity !== "rule" || fence.block !== "content") continue;
      if (!fence.body) continue;
      const id = typeof fence.body.id === "string" ? fence.body.id : null;
      if (!id) continue;
      const values = isPlainObject(fence.body.values)
        ? (fence.body.values as Record<string, unknown>)
        : {};
      // Don't let an empty-values block overwrite one with data. When
      // multiple files declare the same id, the richer entry wins.
      const existing = this.byId.get(id);
      if (existing && Object.keys(existing.values).length >= Object.keys(values).length) {
        ids.add(id); // still track for per-file cleanup
        continue;
      }
      this.byId.set(id, { filePath, values });
      ids.add(id);
    }
    if (ids.size > 0) this.idsByFile.set(filePath, ids);
  }
}

/* ── helpers ────────────────────────────────────────────────────── */

function walkPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (!isPlainObject(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Extract the YAML head of a `rule.content` block (everything before the
 * first standalone `---` separator inside the fence body). The fence
 * boundaries [start, end) point at the entire ```rpg rule.content … ```
 * block in `text`.
 */
function sliceFrontmatter(text: string, start: number, end: number): string {
  // Find the first newline after start (skip the ```rpg rule.content line).
  const fenceLineEnd = text.indexOf("\n", start);
  if (fenceLineEnd < 0 || fenceLineEnd >= end) return "";
  // The body starts just after that newline.
  const bodyStart = fenceLineEnd + 1;
  // The body ends at the closing ``` line. Find it within [bodyStart, end).
  // Closing fence is on its own line; we don't need the exact pattern,
  // just stop at the first ``` line.
  const body = text.slice(bodyStart, end);
  const closingIdx = body.lastIndexOf("```");
  const innerEnd = closingIdx >= 0 ? closingIdx : body.length;
  const inner = body.slice(0, innerEnd);

  // Split on first standalone `---` line (frontmatter separator).
  const lines = inner.split("\n");
  const sepIdx = lines.findIndex((l) => l.trim() === "---");
  return sepIdx >= 0 ? lines.slice(0, sepIdx).join("\n") : inner;
}

function parseHeadYaml(head: string): Record<string, unknown> {
  if (!head.trim()) return {};
  // Local require to avoid pulling yaml at module top-level (it's already
  // a dep, but this keeps the import surface tight and parses small heads).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parse } = require("yaml") as typeof import("yaml");
  try {
    const v = parse(head);
    return isPlainObject(v) ? v : {};
  } catch {
    return {};
  }
}
