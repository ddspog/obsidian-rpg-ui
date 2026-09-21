/**
 * Lonelog/Partylog Parser Types
 * Based on Lonelog v1.0.0 and Partylog v1.0.0 (CC BY-SA 4.0, by Roberto Bisceglie)
 */

import type { GMLikelihood } from "lib/domains/features/types";

export type LonelogEntry =
  | SceneEntry
  | ActionEntry
  | WorldEventEntry
  | RollEntry
  | OracleQuestionEntry
  | OracleAnswerEntry
  | OracleCallEntry
  | ConsequenceEntry
  | DialogueEntry
  | TableRollEntry
  | GeneratorEntry
  | MetaNoteEntry
  | NarrativeEntry
  | CombatMarkerEntry
  | RoundMarkerEntry
  | ResourceMarkerEntry
  | DungeonStatusMarkerEntry
  | ConcatMarkerEntry
  | ContinuationEntry;

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
  /** Chaos/Confidence factor from a leading `[CF:n]` token (sidebar-only metadata). */
  chaosFactor?: number;
  /** Resource + LIST ops (`[CF+1]`, `[CF?]`, `[Characters?]`) carried on the
   *  question line — resolved to a running value / running entries and shown as
   *  head pills. (Named `dialOps` for back-compat; it carries both kinds.) */
  dialOps?: (DialOpTag | ListOpTag)[];
  /** The raw line (trimmed, tags intact) when ops were stripped from `text` —
   *  lets an editable op token be written back into the source line. */
  raw?: string;
}

/**
 * An oracle consulted for the question above it:
 *
 *   ? [CF:5] Is the gate still guarded?
 *   o: Fate Chart (likely) d100=22 -> Yes
 *
 * The sibling `tbl:` and `gen:` never had — source, then how it was rolled, then
 * what came back. The question stays prose on its own `?` line; this line is the
 * machinery that answers it, and its result is DERIVED from the roll rather than
 * written by hand.
 */
export interface OracleCallEntry {
  type: "oracle_call";
  /** The oracle consulted, by name: `Fate Chart`. */
  source: string;
  /** The odds as written (`likely`, `Nearly Certain`). */
  oddsText?: string;
  /** Those odds, when they name a Fate Chart band. */
  likelihood?: GMLikelihood;
  /** The die, rolled or not: `d100=22`, `d100`. */
  roll?: string;
  /** What came back. Derived from the roll when the odds allow it. */
  result?: string;
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
  /**
   * Narration with inline `[...]` tags stripped — the story-facing text shown
   * in prose mode. Falls back to `text` when absent. Empty for tag-only lines.
   */
  conclusion?: string;
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

/**
 * A bare `++` line. Joins the conclusion before it and the conclusion after it
 * into a single prose paragraph (each keeps its own provenance dot).
 */
export interface ConcatMarkerEntry {
  type: "concat";
}

/**
 * An indented line — treated as working/detail of the preceding entry (e.g. the
 * roll breakdown under a `gen:`). Never surfaces in prose; shown in the sidebar.
 */
export interface ContinuationEntry {
  type: "continuation";
  text: string;
}

// Persistent tag types
export type PersistentTag =
  | NPCTag
  | LocationTag
  | EventTag
  | ClockTag
  | TrackTag
  | DialTag
  | DialOpTag
  | ListOpTag
  | TimerTag
  | ThreadTag
  | PCTag
  | FoeTag
  | InventoryTag
  | WealthTag
  | RoomTag;

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

/** A bounded, bidirectional dial — `[Dial:Name|current|min-max]` (e.g. the
 *  Chaos Factor, `[Dial:Chaos Factor|5|1-9]`). Unlike a clock/track (progress
 *  toward a max), a dial swings up and down within a fixed `min..max` band. */
export interface DialTag {
  kind: "dial";
  name: string;
  current: number;
  min: number;
  max: number;
}

/** A stateful operation on a DECLARED resource. Two reference forms share this
 *  one tag kind:
 *   - SESSION (bare abbr): `[CF+1]`, `[CF?]` → `abbr` set.
 *   - PC (`Character/Resource`): `[Talon/Mystic Mark-1]` → `pc` + `name` set.
 *  Inert until matched to a declared resource at the render layer, which folds
 *  it onto a running value (seeded from the resource's `default`, clamped). This
 *  is separate from the self-contained `[Dial:Name|cur|min-max]` tag + its
 *  ProgressChange path. `set` (`=`/`:`), `inc` (`+`), `dec` (`-`), `inspect` (`?`). */
export interface DialOpTag {
  kind: "dial-op";
  /** Session-scope key: the resource's abbr (`[CF+1]`). Absent for PC ops. */
  abbr?: string;
  /** PC-scope: character name (`[Talon/Mystic Mark-1]` → `pc = "Talon"`). */
  pc?: string;
  /** PC-scope: resource name (`… → name = "Mystic Mark"`). */
  name?: string;
  op: "set" | "inc" | "dec" | "inspect";
  /** Operand for set/inc/dec; absent for inspect. */
  amount?: number;
}

/**
 * An operation on a DECLARED lonelog LIST (Characters, Threads, …) — a named
 * collection the log grows, prunes, and consults:
 *   - `add`     `[Characters+ Bertha the Angry Avian]` → append an entry
 *   - `remove`  `[Threads- Find the mystical stone]`   → close/drop an entry
 *   - `consult` `[Characters?]`                        → roll a live entry
 *
 * List names are Title Case (`[A-Z][a-z]…`), which keeps them disjoint from the
 * ALLCAPS resource abbrs of a `DialOpTag` (`[CF?]`). Inert until matched to a
 * declared `list:` at the render layer, which folds the ops into running entries
 * and resolves a consult against them (falling back to the list's `default`).
 */
export interface ListOpTag {
  kind: "list-op";
  /** The list's declared name (`[Characters+ …]` → `"Characters"`). */
  name: string;
  /**
   * `add`/`remove` grow and prune the list. The two read ops mirror the resource
   * grammar (`[CF?]` inspects, `[CF=5]` sets):
   *   - `inspect` `[Characters?]`  — show the WHOLE list;
   *   - `roll`    `[Characters@]`  — draw ONE entry off the sheet.
   */
  op: "add" | "remove" | "inspect" | "roll";
  /** The entry text for add/remove, or the picked entry of a `@ entry` roll. */
  entry?: string;
  /**
   * A `roll` whose result is BAKED into the log — either the roll VALUES
   * (`[Characters@ r1=3 r2=7]`) or an explicit pick (`[Characters@ Tocky]`).
   * A bare `[Characters@]` is unrolled.
   */
  rolled?: boolean;
  /**
   * The roll values in order (`r1`, `r2`, …). Deliberately die-AGNOSTIC: which
   * polyhedron each one uses depends on how many entries the list currently
   * holds, so the log records only what came up and the list decides the rest.
   */
  rolls?: number[];
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
  kind: "event" | "clock" | "track" | "timer" | "dial";
  current: number;
  max?: number;
  /** Lower bound of a `dial`'s band (its upper bound is `max`). */
  min?: number;
}

// Thread state change
export interface ThreadChange {
  name: string;
  from: string | null;
  to: string;
}
