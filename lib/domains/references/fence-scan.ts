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
    const entity = m[1];
    const block = m[2];
    const rawBody = m[3];

    // All blocks may use fence mode (YAML head + `---` + markdown body).
    // Parse the YAML head for indexing. If a fence body exists after ---,
    // store it as `body.text` so compendium consumers (spell descriptions,
    // feature text) can still access it.
    let body: Record<string, unknown> | null;
    const sepIdx = rawBody.indexOf("\n---\n");
    const sepIdx2 = rawBody.indexOf("\n---");
    const effectiveSep = sepIdx >= 0 ? sepIdx : (sepIdx2 >= 0 && sepIdx2 + 4 >= rawBody.length ? sepIdx2 : -1);
    if (effectiveSep >= 0) {
      body = parseRuleContentHead(rawBody);
      if (body && !("text" in body)) {
        const fenceBody = rawBody.slice(effectiveSep + 4).replace(/^\n+/, "").replace(/\n+$/, "");
        if (fenceBody) body.text = fenceBody;
      }
    } else {
      const parsed = safeParseYaml(rawBody);
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    }

    const nameField =
      body && typeof body.name === "string" ? body.name : undefined;
    out.push({
      entity,
      block,
      body,
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

/**
 * For `rule.content` fences: split on the first standalone `---` line
 * and parse only the YAML head. Returns the parsed frontmatter object
 * (or null on failure).
 */
function parseRuleContentHead(raw: string): Record<string, unknown> | null {
  const lines = raw.split("\n");
  const sepIdx = lines.findIndex((l) => l.trim() === "---");
  const head = sepIdx >= 0 ? lines.slice(0, sepIdx).join("\n") : raw;
  if (!head.trim()) return null;
  try {
    const parsed = parseYAML(head);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
