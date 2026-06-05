/**
 * Lonelog/Partylog Parser Types
 * Based on Lonelog v1.0.0 and Partylog v1.0.0 (CC BY-SA 4.0, by Roberto Bisceglie)
 */

export type LonelogEntry =
  | SceneEntry
  | ActionEntry
  | WorldEventEntry
  | RollEntry
  | OracleQuestionEntry
  | OracleAnswerEntry
  | ConsequenceEntry
  | DialogueEntry
  | TableRollEntry
  | GeneratorEntry
  | MetaNoteEntry
  | NarrativeEntry
  | CombatMarkerEntry
  | RoundMarkerEntry
  | ResourceMarkerEntry
  | DungeonStatusMarkerEntry;

export interface SceneEntry {
  type: "scene";
  number: string;
  context: string;
}

export interface ActionEntry {
  type: "action";
  text: string;
  actor?: string;
  assist?: string;
}

export interface WorldEventEntry {
  type: "world_event";
  text: string;
  tags: PersistentTag[];
}

export interface RollEntry {
  type: "roll";
  roll: string;
  result: string;
  success?: boolean;
  actor?: string;
  label?: string;
  total?: number;
  breakdown?: string;
  vsTarget?: string;
  isCardDraw?: boolean;
}

export interface OracleQuestionEntry {
  type: "oracle_question";
  text: string;
  actor?: string;
}

export interface OracleAnswerEntry {
  type: "oracle_answer";
  text: string;
  roll?: string;
}

export interface ConsequenceEntry {
  type: "consequence";
  text: string;
  tags: PersistentTag[];
}

export interface DialogueEntry {
  type: "dialogue";
  speaker: string;
  speakerType: "pc" | "npc";
  text: string;
}

export interface TableRollEntry {
  type: "table_roll";
  source: string;
  roll: string;
  result: string;
}

export interface GeneratorEntry {
  type: "generator";
  source: string;
  result: string;
}

export interface MetaNoteEntry {
  type: "meta_note";
  text: string;
}

export interface NarrativeEntry {
  type: "narrative";
  text: string;
}

export interface CombatMarkerEntry {
  type: "combat_marker";
  state: "open" | "close";
}

export interface RoundMarkerEntry {
  type: "round_marker";
  round: number;
}

export interface ResourceMarkerEntry {
  type: "resource_marker";
  state: "open" | "close";
}

export interface DungeonStatusMarkerEntry {
  type: "dungeon_status_marker";
  state: "open" | "close";
}

// Persistent tag types
export type PersistentTag = NPCTag | LocationTag | EventTag | ClockTag | TrackTag | TimerTag | ThreadTag | PCTag | FoeTag | InventoryTag | WealthTag | RoomTag;

export interface NPCTag {
  kind: "npc";
  name: string;
  tags: string[];
  ref: boolean;
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
  state: string;
}

export interface PCTag {
  kind: "pc";
  name: string;
  changes: string[];
}

export interface FoeTag {
  kind: "foe";
  name: string;
  tags: string[];
}

export interface InventoryTag {
  kind: "inventory";
  name: string;
  ref: boolean;
  quantity?: number;
  delta?: number;
  transition?: { from: number; to: number };
  depleted?: boolean;
  props: string[];
}

export interface WealthTag {
  kind: "wealth";
  currency: string;
  amount?: number;
  delta?: number;
  transition?: { from: number; to: number };
}

export interface RoomTag {
  kind: "room";
  id: string;
  ref: boolean;
  status?: string;
  description?: string;
  exits?: string[];
}

// Entity state mutations extracted from tags
export interface EntityDelta {
  entity: string;
  entityType: "pc" | "npc";
  changes: StateChange[];
}

export type StateChange = HPChange | StatChange | StatusChange | TagAddition | TagRemoval;

export interface HPChange {
  type: "hp";
  delta: number;
}

export interface StatChange {
  type: "stat";
  stat: string;
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
  max?: number;
}

// Thread state change
export interface ThreadChange {
  name: string;
  from: string | null;
  to: string;
}
