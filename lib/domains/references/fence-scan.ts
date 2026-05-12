/**
 * Generic scanner for every `rpg <entity>.<block>` fence body in a
 * markdown document. Unlike the per-entity extractors
 * (`extractItemElementBlocks`, `extractFeatureBlocks`, …) this module
 * returns a flat list keyed by `entity` / `block` so the reference
 * resolver can walk any path without entity-specific knowledge.
 */

import { parse as parseYAML } from "yaml";

/** One fence body extracted from a markdown document. */
export interface FenceMatch {
  /** Entity namespace — the word before the `.` in the info tag. */
  entity: string;
  /** Block identifier — the word after the `.` in the info tag. */
  block: string;
  /** Parsed YAML body; `null` when the body wasn't parseable (so the
   *  caller can distinguish "no such path" from "malformed body"). */
  body: Record<string, unknown> | null;
  /** Convenience alias: `body.name` lifted to the top so the resolver
   *  can match `[Name]` steps without re-digging into the body. */
  name?: string;
  /** Character offset of the opening fence within the host doc.
   *  Useful for editor navigation / error messages. */
  start: number;
  /** Character offset just past the closing fence. */
  end: number;
}

/**
 * Extract every `rpg <entity>.<block>` fence in document order.
 * Tolerates 3+ backticks and trailing whitespace after the info tag,
 * matching the permissiveness of the per-entity extractors.
 */
export function extractAllRpgFences(contents: string): FenceMatch[] {
  if (!contents) return [];
  const out: FenceMatch[] = [];
  const re = /```+\s*rpg\s+([A-Za-z_][\w-]*)\.([A-Za-z_][\w-]*)\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const body = safeParseYaml(m[3]);
    const nameField =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).name === "string"
        ? ((body as Record<string, unknown>).name as string)
        : undefined;
    out.push({
      entity: m[1],
      block: m[2],
      body: body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null,
      name: nameField,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/** Group fences by their `<entity>.<block>` key so the resolver can
 *  look up `item.element` without iterating the flat list each time.
 *  Insertion order is preserved within each bucket — `[0]` is always
 *  the first fence of that kind in the doc. */
export function groupFences(fences: FenceMatch[]): Record<string, FenceMatch[]> {
  const out: Record<string, FenceMatch[]> = {};
  for (const f of fences) {
    const key = `${f.entity}.${f.block}`;
    (out[key] ??= []).push(f);
  }
  return out;
}

function safeParseYaml(raw: string): unknown {
  if (!raw || !raw.trim()) return {};
  try {
    return parseYAML(raw);
  } catch {
    return null;
  }
}
