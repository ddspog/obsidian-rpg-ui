/**
 * Delta Tracker
 * Extracts state mutations from parsed Lonelog tags
 */

import type {
  LonelogEntry,
  PersistentTag,
  PCTag,
  NPCTag,
  EntityDelta,
  StateChange,
  ProgressChange,
  ThreadChange,
} from "./types";

/**
 * Extract all deltas from a list of Lonelog entries
 */
export function extractDeltas(entries: LonelogEntry[]): {
  entityDeltas: EntityDelta[];
  progressChanges: ProgressChange[];
  threadChanges: ThreadChange[];
} {
  const entityDeltas: Map<string, EntityDelta> = new Map();
  const progressChanges: ProgressChange[] = [];
  const threadChanges: ThreadChange[] = [];

  for (const entry of entries) {
    if (entry.type === "consequence") {
      processConsequenceTags(
        entry.tags,
        entityDeltas,
        progressChanges,
        threadChanges,
      );
    }
  }

  return {
    entityDeltas: Array.from(entityDeltas.values()),
    progressChanges,
    threadChanges,
  };
}

/**
 * Process tags from a consequence entry
 */
function processConsequenceTags(
  tags: PersistentTag[],
  entityDeltas: Map<string, EntityDelta>,
  progressChanges: ProgressChange[],
  threadChanges: ThreadChange[],
): void {
  for (const tag of tags) {
    switch (tag.kind) {
      case "pc":
        processPCTag(tag, entityDeltas);
        break;

      case "npc":
        processNPCTag(tag, entityDeltas);
        break;

      case "clock":
        progressChanges.push({
          name: tag.name,
          kind: "clock",
          current: tag.current,
          max: tag.max,
        });
        break;

      case "track":
        progressChanges.push({
          name: tag.name,
          kind: "track",
          current: tag.current,
          max: tag.max,
        });
        break;

      case "event":
        progressChanges.push({
          name: tag.name,
          kind: "event",
          current: tag.current,
          max: tag.max,
        });
        break;

      case "timer":
        progressChanges.push({
          name: tag.name,
          kind: "timer",
          current: tag.value,
        });
        break;

      case "thread":
        threadChanges.push({
          name: tag.name,
          from: null, // We don't track previous state yet
          to: tag.state,
        });
        break;
    }
  }
}

/**
 * Process PC tags to extract stat changes
 */
function processPCTag(tag: PCTag, entityDeltas: Map<string, EntityDelta>): void {
  const key = `pc:${tag.name}`;
  let delta = entityDeltas.get(key);

  if (!delta) {
    delta = {
      entity: tag.name,
      entityType: "pc",
      changes: [],
    };
    entityDeltas.set(key, delta);
  }

  // Parse each change string
  for (const change of tag.changes) {
    const stateChange = parseChange(change);
    if (stateChange) {
      delta.changes.push(stateChange);
    }
  }
}

/**
 * Process NPC tags to extract state changes
 */
function processNPCTag(tag: NPCTag, entityDeltas: Map<string, EntityDelta>): void {
  const key = `npc:${tag.name}`;
  let delta = entityDeltas.get(key);

  if (!delta) {
    delta = {
      entity: tag.name,
      entityType: "npc",
      changes: [],
    };
    entityDeltas.set(key, delta);
  }

  // Parse tags for state changes
  for (const tagStr of tag.tags) {
    const stateChange = parseChange(tagStr);
    if (stateChange) {
      delta.changes.push(stateChange);
    }
  }
}

/**
 * Parse a change string into a StateChange
 * Examples:
 * - "HP-9" -> HP change of -9
 * - "HP+3" -> HP change of +3
 * - "Stress-1" -> Stat change of -1
 * - "dead" -> Status change to "dead"
 * - "alert→unconscious" -> Status transition
 * - "+captured" -> Add tag
 * - "-wounded" -> Remove tag
 */
function parseChange(change: string): StateChange | null {
  // HP change: HP+X or HP-X
  const hpMatch = change.match(/^HP([+-])(\d+)$/);
  if (hpMatch) {
    const sign = hpMatch[1] === "+" ? 1 : -1;
    const amount = parseInt(hpMatch[2], 10);
    return { type: "hp", delta: sign * amount };
  }

  // Stat change: StatName+X or StatName-X
  const statMatch = change.match(/^([A-Za-z]+)([+-])(\d+)$/);
  if (statMatch) {
    const stat = statMatch[1];
    const sign = statMatch[2] === "+" ? 1 : -1;
    const amount = parseInt(statMatch[3], 10);
    return { type: "stat", stat, delta: sign * amount };
  }

  // Status transition: from→to
  const transitionMatch = change.match(/^(.+?)→(.+)$/);
  if (transitionMatch) {
    return { type: "status", from: transitionMatch[1], to: transitionMatch[2] };
  }

  // Tag addition: +tag
  if (change.startsWith("+")) {
    return { type: "tag_add", tag: change.slice(1) };
  }

  // Tag removal: -tag
  if (change.startsWith("-")) {
    return { type: "tag_remove", tag: change.slice(1) };
  }

  // Simple status (e.g., "dead", "wounded", "hostile")
  // Only consider as status if it's a known status word
  const statusWords = [
    "dead",
    "unconscious",
    "wounded",
    "hostile",
    "alert",
    "distracted",
    "prone",
    "stunned",
    "paralyzed",
    "frightened",
    "charmed",
    "blinded",
    "deafened",
    "invisible",
    "poisoned",
    "grappled",
    "restrained",
    "incapacitated",
    "petrified",
  ];

  if (statusWords.includes(change.toLowerCase())) {
    return { type: "status", from: null, to: change };
  }

  // Unknown format, return null
  return null;
}

/**
 * Accumulate deltas across multiple entries
 * This is useful for computing the total change over a session
 */
export function accumulateDeltas(
  allDeltas: EntityDelta[],
): Map<string, EntityDelta> {
  const accumulated = new Map<string, EntityDelta>();

  for (const delta of allDeltas) {
    const key = `${delta.entityType}:${delta.entity}`;
    let acc = accumulated.get(key);

    if (!acc) {
      acc = {
        entity: delta.entity,
        entityType: delta.entityType,
        changes: [],
      };
      accumulated.set(key, acc);
    }

    // Accumulate changes
    acc.changes.push(...delta.changes);
  }

  return accumulated;
}

/**
 * Calculate total HP change for an entity
 */
export function calculateTotalHPChange(changes: StateChange[]): number {
  return changes
    .filter((c): c is { type: "hp"; delta: number } => c.type === "hp")
    .reduce((total, c) => total + c.delta, 0);
}

/**
 * Get the final status of an entity
 */
export function getFinalStatus(changes: StateChange[]): string | null {
  const statusChanges = changes.filter(
    (c): c is { type: "status"; from: string | null; to: string } =>
      c.type === "status",
  );

  if (statusChanges.length === 0) return null;

  // Return the most recent status
  return statusChanges[statusChanges.length - 1].to;
}

/**
 * Get all active tags for an entity
 */
export function getActiveTags(changes: StateChange[]): Set<string> {
  const tags = new Set<string>();

  for (const change of changes) {
    if (change.type === "tag_add") {
      tags.add(change.tag);
    } else if (change.type === "tag_remove") {
      tags.delete(change.tag);
    }
  }

  return tags;
}
