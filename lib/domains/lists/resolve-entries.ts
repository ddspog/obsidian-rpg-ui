/**
 * Resolve a `rpg list.*` block's entries into rendered markdown lines.
 *
 * Each entry's `call` (`@[[/folder/]].fn()` / `@[[file]].fn(id)`) is parsed
 * with the shared {@link parseCall} grammar, then resolved into a set of
 * field-records. The entry's `format` template is applied once per record.
 *
 * Field source — the entry call's terminal selects which block feeds `${…}`:
 *   - `.block(0)` / `.block(2)` → the Nth `rpg` fence's head (by doc order).
 *   - `.block(id)`              → the fence whose id / name / kind matches.
 *   - `.block()` / `.file()`    → the file's own top-level frontmatter.
 *   - `.fn()` (legacy)          → first fence of kind `fn` (e.g. `.spell()`).
 *   `name` falls back to the file basename; `basename`/`path` are injected.
 *
 * Special terminal `fn`:
 *   - `.list(id)` composes another `rpg list` block: its entries are resolved
 *     to records and re-formatted by THIS entry's `format`. A visited-set
 *     guards against cycles.
 *
 * IO is abstracted behind {@link ListSource} so the resolver is unit-testable
 * without Obsidian; `appListSource` (in the render child) is the production
 * adapter.
 */

import { parse as parseYAML } from "yaml";
import { parseCall, type ParsedCall, type ChainSegment } from "lib/domains/references/parse-call";
import { parseFilterExpr, evaluateFilter } from "lib/domains/references/filter-expr";
import { parseListBlock } from "./parse-list-block";
import { formatLine } from "./format-line";
import { isHomebrewSource } from "./official-sources";
import type { ListBlock, ListHighlight, ListLine, ResolvedRecord } from "./types";

/** A vault file reference (path + extension-less basename). */
export interface ListFile {
  path: string;
  basename: string;
}

/** IO surface the resolver needs — injected for testability. */
export interface ListSource {
  /** `.md` files directly inside a folder target (e.g. `"spells/cantrips/"`),
   *  sorted by basename. */
  listFolderFiles(folderTarget: string): ListFile[];
  /** Resolve a wikilink/path target (relative to `sourcePath`) to a file. */
  resolveFile(target: string, sourcePath: string): ListFile | null;
  /** Read a file's full text, or null when unreadable. */
  read(path: string): Promise<string | null>;
  /** A file's top-level YAML frontmatter (fallback field source). */
  frontmatter(path: string): Record<string, unknown> | undefined;
}

/** Parse a fence body's YAML head: the lines before the first standalone
 *  `---`, or the whole body in pure-YAML fences. */
function parseFenceHead(rawBody: string): Record<string, unknown> {
  const headLines: string[] = [];
  for (const line of rawBody.split("\n")) {
    if (line.trim() === "---") break;
    headLines.push(line);
  }
  const head = headLines.join("\n");
  if (!head.trim()) return {};
  try {
    const parsed = parseYAML(head);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

interface FenceInfo {
  entity: string;
  block?: string;
  head: Record<string, unknown>;
}

/** Every `rpg <entity>[.<block>]` fence in document order, with parsed heads.
 *  Matches both dotted (`rpg item.magic`) and dotless (`rpg spell`) fences. */
export function findAllFences(content: string): FenceInfo[] {
  if (!content) return [];
  const out: FenceInfo[] = [];
  const openRe = /^(`{3,})\s*rpg\s+([A-Za-z_][\w-]*)(?:\.([A-Za-z_][\w-]*))?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(content)) !== null) {
    const ticks = m[1].length;
    const bodyStart = m.index + m[0].length + 1;
    const closeRe = new RegExp("^`{" + ticks + ",}\\s*$", "m");
    const rest = content.slice(bodyStart);
    const cm = closeRe.exec(rest);
    const rawBody = cm ? rest.slice(0, cm.index) : rest;
    out.push({ entity: m[2], block: m[3], head: parseFenceHead(rawBody) });
    openRe.lastIndex = bodyStart + (cm ? cm.index + cm[0].length : rest.length);
  }
  return out;
}

function fenceMatches(f: FenceInfo, want: string): boolean {
  const id = typeof f.head.id === "string" ? f.head.id : undefined;
  const nm = typeof f.head.name === "string" ? f.head.name : undefined;
  return (
    id === want ||
    nm === want ||
    f.entity === want ||
    f.block === want ||
    (f.block !== undefined && `${f.entity}.${f.block}` === want)
  );
}

/** First fence matching a kind (`entity`, `block`, `entity.block`, id, or name). */
export function findFenceBody(content: string, kind: string): Record<string, unknown> | null {
  if (!content || !kind) return null;
  for (const f of findAllFences(content)) if (fenceMatches(f, kind)) return f.head;
  return null;
}

/**
 * Decide which fields a record draws from, per the entry call's terminal:
 *   - `.block()` / `.file()`    → null (caller falls back to file frontmatter)
 *   - `.block(0)` / `.block(2)` → that fence's head, by document index
 *   - `.block(id)`              → fence whose id / name / kind matches
 *   - `.fn()` (legacy)          → first fence of kind `fn`
 * Returns null to mean "use the file's own frontmatter".
 */
function selectFenceFields(content: string, call: ParsedCall): Record<string, unknown> | null {
  if (call.fn === "file") return null;
  if (call.fn === "block") {
    const spec = call.args[0];
    if (spec === undefined || spec === null || spec === "") return null; // .block() → file fm
    if (typeof spec === "number") return findAllFences(content)[spec]?.head ?? null;
    const want = String(spec);
    for (const f of findAllFences(content)) if (fenceMatches(f, want)) return f.head;
    return null;
  }
  // Legacy: a terminal fn (e.g. `.spell()`) names a block kind.
  return findFenceBody(content, call.fn);
}

/** Evaluate any `.filter(expr)` chain segments against a record's fields. */
function passesFilters(chain: ChainSegment[], data: Record<string, unknown>): boolean {
  for (const seg of chain) {
    if (seg.fn !== "filter") continue;
    const exprStr = seg.args.map(String).join(", ");
    const expr = parseFilterExpr(exprStr);
    if (expr && !evaluateFilter(expr, data)) return false;
  }
  return true;
}

/** Build a record from a file's harvested fields, injecting name/basename/path. */
function buildRecord(
  fields: Record<string, unknown>,
  file: ListFile,
  homebrew: boolean
): ResolvedRecord {
  const name = typeof fields.name === "string" && fields.name ? fields.name : file.basename;
  return {
    fields: { ...fields, name, basename: file.basename, path: file.path, homebrew },
    name,
    file: file.path,
  };
}

/** Locate a `rpg list.*` fence by id (or the first one) in a file's content. */
function findListFence(content: string, id: string | undefined): ListBlock | null {
  const openRe = /^(`{3,})\s*rpg\s+list(?:\.([A-Za-z0-9_-]+))?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(content)) !== null) {
    const ticks = m[1].length;
    const blockName = m[2] ?? "";
    const bodyStart = m.index + m[0].length + 1;
    const closeRe = new RegExp("^`{" + ticks + ",}\\s*$", "m");
    const rest = content.slice(bodyStart);
    const cm = closeRe.exec(rest);
    const body = cm ? rest.slice(0, cm.index) : rest;
    const block = parseListBlock(blockName, body);
    if (!id || block.id === id) return block;
    openRe.lastIndex = bodyStart + (cm ? cm.index + cm[0].length : rest.length);
  }
  return null;
}

/**
 * Resolve a single parsed call into field-records. Threads a `visited` set
 * (keyed by `path#id`) to guard `.list(id)` composition cycles.
 */
export async function resolveRecords(
  call: ParsedCall,
  sourcePath: string,
  source: ListSource,
  visited: Set<string>,
  officialSources: string[]
): Promise<ResolvedRecord[]> {
  // `.list(id)` composition — import another list block's records.
  if (call.fn === "list") {
    const file = source.resolveFile(call.target, sourcePath);
    if (!file) return [];
    const id = typeof call.args[0] === "string" ? (call.args[0] as string) : undefined;
    const key = `${file.path}#${id ?? "*"}`;
    if (visited.has(key)) return [];
    visited.add(key);
    const content = await source.read(file.path);
    if (!content) return [];
    const block = findListFence(content, id);
    if (!block) return [];
    const out: ResolvedRecord[] = [];
    for (const entry of block.entries) {
      // Composition imports field-records; literal `text` lines have none.
      if (!entry.call) continue;
      const inner = parseCall(entry.call);
      if (!inner) continue;
      out.push(...(await resolveRecords(inner, file.path, source, visited, officialSources)));
    }
    return out;
  }

  // Folder target — one record per `.md` file.
  if (call.target.endsWith("/")) {
    const out: ResolvedRecord[] = [];
    for (const file of source.listFolderFiles(call.target)) {
      const content = await source.read(file.path);
      const fileFm = source.frontmatter(file.path);
      const homebrew = isHomebrewSource(fileFm?.source, officialSources);
      const fields = (content ? selectFenceFields(content, call) : null) ?? fileFm ?? {};
      const record = buildRecord(fields, file, homebrew);
      if (!passesFilters(call.chain, record.fields)) continue;
      out.push(record);
    }
    return out;
  }

  // Single-file target — one record.
  const file = source.resolveFile(call.target, sourcePath);
  if (!file) return [];
  const content = await source.read(file.path);
  const fileFm = source.frontmatter(file.path);
  const homebrew = isHomebrewSource(fileFm?.source, officialSources);
  const fields = (content ? selectFenceFields(content, call) : null) ?? fileFm ?? {};
  const record = buildRecord(fields, file, homebrew);
  if (!passesFilters(call.chain, record.fields)) return [];
  return [record];
}

/**
 * Resolve every entry of a list block into rendered markdown lines, in
 * authored order. Seeds the visited-set with this block so a list cannot
 * import itself.
 */
export async function resolveListLines(
  block: ListBlock,
  sourcePath: string,
  source: ListSource,
  officialSources: string[] = []
): Promise<ListLine[]> {
  const visited = new Set<string>([`${sourcePath}#${block.id}`]);
  const lines: ListLine[] = [];
  for (const entry of block.entries) {
    // Literal line: fixed markdown, used as-is (mixes with call entries).
    if (typeof entry.text === "string") {
      lines.push({ listId: block.id, markdown: entry.text, file: "" });
      continue;
    }
    if (!entry.call) continue;
    const call = parseCall(entry.call);
    if (!call) continue;
    // `.highlight(when?, label:, color:)` anywhere in the chain badges lines.
    // Default (no `when`): highlight homebrew records (the `homebrew` field,
    // from the file's `source:` vs the system's official sources). A `when`
    // condition (positional or named filter expression) overrides — e.g.
    // `.highlight(when: 'name like /[ºᴷᴰᴴ]/')` to flag by filename marker.
    const hl = call.chain.find((s) => s.fn === "highlight");
    let highlightFor: ((fields: Record<string, unknown>) => ListHighlight | undefined) | null =
      null;
    if (hl) {
      const label = typeof hl.params.label === "string" ? hl.params.label : undefined;
      const color = typeof hl.params.color === "string" ? hl.params.color : undefined;
      const whenRaw =
        typeof hl.params.when === "string"
          ? hl.params.when
          : typeof hl.args[0] === "string"
            ? hl.args[0]
            : undefined;
      const cond = whenRaw ? parseFilterExpr(whenRaw) : null;
      highlightFor = (fields) => {
        const match = cond ? evaluateFilter(cond, fields) : fields.homebrew === true;
        return match ? { label, color } : undefined;
      };
    }
    const records = await resolveRecords(call, sourcePath, source, visited, officialSources);
    for (const record of records) {
      lines.push({
        listId: block.id,
        markdown: formatLine(entry.format ?? "${name}", record.fields),
        file: record.file,
        highlight: highlightFor ? highlightFor(record.fields) : undefined,
      });
    }
  }
  return lines;
}
