/**
 * Lonelog Parser Types
 * Based on Lonelog v1.0.0 notation (CC BY-SA 4.0, by Roberto Bisceglie)
 */

export type LonelogEntry =
  | SceneEntry
  | ActionEntry
  | RollEntry
  | OracleQuestionEntry
  | OracleAnswerEntry
  | ConsequenceEntry
  | DialogueEntry
  | TableRollEntry
  | GeneratorEntry
  | MetaNoteEntry
  | NarrativeEntry;

export interface SceneEntry {
  type: "scene";
  number: string; // "S1", "S1a", "T1-S1", "S1.1", etc.
  context: string; // Scene location/description
}

export interface ActionEntry {
  type: "action";
  text: string;
}

export interface RollEntry {
  type: "roll";
  roll: string; // The roll expression (e.g., "d20+5=17")
  result: string; // The outcome (e.g., "vs DC 15 -> Success")
  success?: boolean; // Parsed success/failure if present
}

export interface OracleQuestionEntry {
  type: "oracle_question";
  text: string;
}

export interface OracleAnswerEntry {
  type: "oracle_answer";
  text: string; // The oracle answer (e.g., "Yes, but...")
  roll?: string; // Optional dice roll (e.g., "d6=3")
}

export interface ConsequenceEntry {
  type: "consequence";
  text: string;
  tags: PersistentTag[];
}

export interface DialogueEntry {
  type: "dialogue";
  speaker: string; // Character name or "PC"
  text: string;
}

export interface TableRollEntry {
  type: "table_roll";
  source: string; // Table name
  roll: string; // Dice expression
  result: string; // The rolled result
}

export interface GeneratorEntry {
  type: "generator";
  source: string; // Generator name
  result: string; // Generated result
}

export interface MetaNoteEntry {
  type: "meta_note";
  text: string;
}

export interface NarrativeEntry {
  type: "narrative";
  text: string;
}

// Persistent tag types
export type PersistentTag =
  | NPCTag
  | LocationTag
  | EventTag
  | ClockTag
  | TrackTag
  | TimerTag
  | ThreadTag
  | PCTag;

export interface NPCTag {
  kind: "npc";
  name: string;
  tags: string[];
  ref: boolean; // Whether this is a reference tag ([#N:Name])
}

export interface LocationTag {
  kind: "location";
  name: string;
  tags: string[];
}

export interface EventTag {
  kind: "event";
  name: string;
  current: number;
  max: number;
}

export interface ClockTag {
  kind: "clock";
  name: string;
  current: number;
  max: number;
}

export interface TrackTag {
  kind: "track";
  name: string;
  current: number;
  max: number;
}

export interface TimerTag {
  kind: "timer";
  name: string;
  value: number;
}

export interface ThreadTag {
  kind: "thread";
  name: string;
  state: string; // "Open", "Closed", etc.
}

export interface PCTag {
  kind: "pc";
  name: string;
  changes: string[]; // e.g., ["HP-2", "Stress+1"]
}

// Entity state mutations extracted from tags
export interface EntityDelta {
  entity: string; // Entity name
  entityType: "pc" | "npc"; // PC or NPC
  changes: StateChange[];
}

export type StateChange =
  | HPChange
  | StatChange
  | StatusChange
  | TagAddition
  | TagRemoval;

export interface HPChange {
  type: "hp";
  delta: number; // Positive = heal, negative = damage
}

export interface StatChange {
  type: "stat";
  stat: string; // Stat name (e.g., "Stress", "Luck")
  delta: number;
}

export interface StatusChange {
  type: "status";
  from: string | null;
  to: string;
}

export interface TagAddition {
  type: "tag_add";
  tag: string;
}

export interface TagRemoval {
  type: "tag_remove";
  tag: string;
}

// Progress tracker changes
export interface ProgressChange {
  name: string;
  kind: "event" | "clock" | "track" | "timer";
  current: number;
  max?: number; // Not present for timers
}

// Thread state change
export interface ThreadChange {
  name: string;
  from: string | null;
  to: string;
}
