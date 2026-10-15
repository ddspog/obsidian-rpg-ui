/**
 * Session Log Domain
 * Orchestrates Lonelog parsing, delta accumulation, and scene management
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { parseLonelog } from "./lonelog/parser";
import { extractDeltas } from "./lonelog/deltas";
import type { LonelogEntry, EntityDelta, ProgressChange, ThreadChange } from "./lonelog/types";

export interface SessionLogBlock {
  state_key: string;
  scene?: string;
  entities?: EntityReference[];
  /** Wikilink to a GM Screen file declaring `rpg feature.gm` blocks. When set,
   *  its features become the GM card stacks (replacing the built-in generics). */
  gm?: string;
  /** Battle maps declared in the log itself, by name — each as the source of
   *  an `rpg map` block. A fight names one plainly: `[COMBAT: Clearing]`. */
  maps?: Record<string, string>;
  body: string; // Lonelog content
}

export interface EntityReference {
  file: string;
  type?: string;
  count?: number;
}

export interface SessionLogData {
  entries: LonelogEntry[];
  entityDeltas: EntityDelta[];
  progressChanges: ProgressChange[];
  threadChanges: ThreadChange[];
}

/**
 * Parse a session log block (YAML header + Lonelog body)
 */
export function parseSessionLogBlock(source: string): SessionLogBlock {
  // Split on --- to separate YAML header from Lonelog body
  const parts = source.split(/^---$/m);

  if (parts.length < 2) {
    // No YAML header, entire content is Lonelog
    return {
      state_key: "default-log",
      body: source,
    };
  }

  // Parse YAML header (simplified - using basic parsing)
  const yamlContent = parts[0].trim();
  const body = parts.slice(1).join("---").trim();

  const block: SessionLogBlock = {
    state_key: "default-log",
    body,
  };

  const maps = parseInlineMaps(yamlContent);
  if (maps) block.maps = maps;

  // Simple YAML parsing for our specific fields
  const lines = yamlContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("state_key:")) {
      block.state_key = trimmed.replace("state_key:", "").trim();
    } else if (trimmed.startsWith("scene:")) {
      block.scene = trimmed
        .replace("scene:", "")
        .trim()
        .replace(/^["']|["']$/g, "");
    } else if (trimmed.startsWith("gm:")) {
      block.gm = trimmed
        .replace("gm:", "")
        .trim()
        .replace(/^["']|["']$/g, "");
    } else if (trimmed.startsWith("entities:")) {
      block.entities = [];
    } else if (trimmed.startsWith("- file:")) {
      if (!block.entities) block.entities = [];
      const filePath = trimmed
        .replace("- file:", "")
        .trim()
        .replace(/^["']|["']$/g, "");
      block.entities.push({ file: filePath });
    }
  }

  return block;
}

/**
 * Process a session log block to extract all data
 */
export function processSessionLog(block: SessionLogBlock): SessionLogData {
  // Parse Lonelog entries
  const entries = parseLonelog(block.body);

  // Extract deltas from entries
  const { entityDeltas, progressChanges, threadChanges } = extractDeltas(entries);

  return {
    entries,
    entityDeltas,
    progressChanges,
    threadChanges,
  };
}

/**
 * `maps:` in a log's header — battle maps kept in the log instead of a note of
 * their own. Each takes an `rpg map` block's keys; a drawn grid, which can't
 * sit below a `---` here, goes in `cells:` as a block of text:
 *
 *   maps:
 *     Clearing:
 *       image: "[[ambush.png]]"
 *       cell: 33
 *       offset: -1, -1
 *     Ford:
 *       legend: { "~": water, ".": grass }
 *       cells: |
 *         . . ~ ~ . .
 *         . . ~ ~ . .
 *
 * Returned as each map's `rpg map` source, by name.
 */
function parseInlineMaps(header: string): Record<string, string> | undefined {
  let meta: unknown;
  try {
    meta = parseYaml(header);
  } catch {
    return undefined;
  }
  const maps = (meta as { maps?: unknown } | null)?.maps;
  if (!maps || typeof maps !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(maps as Record<string, unknown>)) {
    if (!def || typeof def !== "object") continue;
    const { cells, ...head } = def as Record<string, unknown>;
    out[name] = `${stringifyYaml({ grid: "square", ...head })}---\n${typeof cells === "string" ? cells : ""}`;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A picture map to keep in a log's header. */
export interface HeaderMap {
  name: string;
  /** The picture, as a link (`[[ambush.png]]`). */
  image: string;
  cell: number;
  offsetX: number;
  offsetY: number;
}

/**
 * A log block's opening (from its fence to its `---`) with a map added to its
 * `maps:` — under an existing `maps:`, or as a new `maps:` just above the `---`.
 * Everything already in the header stays as written.
 */
export function addHeaderMap(opening: string, map: HeaderMap): string {
  const entry = [
    `  ${/[:#"'[\]{}]/.test(map.name) ? JSON.stringify(map.name) : map.name}:`,
    `    image: "${map.image}"`,
    `    cell: ${map.cell}`,
    `    offset: ${map.offsetX}, ${map.offsetY}`,
  ];
  const lines = opening.split("\n");
  const sep = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l));
  if (sep < 0) return opening;
  const at = lines.findIndex((l, i) => i < sep && /^maps:\s*$/.test(l));
  if (at < 0) {
    lines.splice(sep, 0, "maps:", ...entry);
    return lines.join("\n");
  }
  // After the last line indented under `maps:`.
  let end = at + 1;
  while (end < sep && /^\s+\S/.test(lines[end])) end++;
  lines.splice(end, 0, ...entry);
  return lines.join("\n");
}
