/**
 * Session Log Domain
 * Orchestrates Lonelog parsing, delta accumulation, and scene management
 */

import { parseLonelog } from "./lonelog/parser";
import { extractDeltas } from "./lonelog/deltas";
import type { LonelogEntry, EntityDelta, ProgressChange, ThreadChange } from "./lonelog/types";

export interface SessionLogBlock {
  state_key: string;
  scene?: string;
  entities?: EntityReference[];
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

  // Simple YAML parsing for our specific fields
  const lines = yamlContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("state_key:")) {
      block.state_key = trimmed.replace("state_key:", "").trim();
    } else if (trimmed.startsWith("scene:")) {
      block.scene = trimmed.replace("scene:", "").trim().replace(/^["']|["']$/g, "");
    } else if (trimmed.startsWith("entities:")) {
      block.entities = [];
    } else if (trimmed.startsWith("- file:")) {
      if (!block.entities) block.entities = [];
      const filePath = trimmed.replace("- file:", "").trim().replace(/^["']|["']$/g, "");
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
