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
  | TravelMarkerEntry
  | RoundMarkerEntry
  | TurnMarkerEntry
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
  /** Map tags written on the action line (`[Mv: E3]`), lifted off its text. */
  tags?: PersistentTag[];
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
  /** The line as written (trimmed), so a roll entered in the Log can be
   *  written back into it. */
  raw?: string;
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
  /** Foes the question brings in (`? Combat begins. [F:Kobold|HP 9]`). */
  foes?: FoeTag[];
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
  /** The line as written (trimmed), so a roll entered in the Log can be
   *  written back into it. */
  raw?: string;
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
  /** The battle map the fight is on — `[COMBAT: [[Kobold Ambush]]]`. */
  map?: string;
}

/**
 * A journey on an overworld hex map (hex-map-design §14.2):
 * `[TRAVEL: [[Caulkin coast]]]` (a finer level: `[TRAVEL: [[Caulkin coast]] level 1]`)
 * opens it; `[/TRAVEL: arrive Day 4, 18:00 | 92 mi | 3 days | outcome Reached
 * Featherbark]` closes it with when it ended, its numbers and what came of it.
 */
export interface TravelMarkerEntry {
  type: "travel_marker";
  state: "open" | "close";
  /** The hex map, as written (`[[Caulkin coast]]`). */
  map?: string;
  /** A finer level of that map: its length is the depth (`level 2`, or the older path `(1,0) (0,0)`). */
  level?: Array<[number, number]>;
  /** The close's fields. */
  end?: {
    /** `arrive Day 4, 18:00` — sets the log's clock, as `[Time:]` does. */
    arrive?: string;
    /** `outcome …` */
    outcome?: string;
    /** Everything else, in order (`92 mi`, `3 days`, `rations -6`). */
    stats: string[];
  };
}

/**
 * A pass through the initiative order — written `T2` (the table calls it a
 * TURN; Lonelog's `R2` reads the same). Internally the rules' "round".
 */
export interface RoundMarkerEntry {
  type: "round_marker";
  round: number;
}

/** `R(Talon)` — one creature's slot in the pass (the table calls it their
 *  ROUND), before what they do. Internally the rules' "turn". */
export interface TurnMarkerEntry {
  type: "turn_marker";
  actor: string;
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
  | RoomTag
  | InitiativeTag
  | PositionTag
  | MoveTag
  | TimeTag
  | WeatherTag
  | GroupTag
  | MarkTag;

/**
 * Who travels together (hex-map-design §14.2). One tag, a small verb each:
 *   `[Group: Party = Elara, Thorne]`           define
 *   `[Group: Party > Scouts = Talon, Lilith]`  split those off into a new group
 *   `[Group: Scouts > Party]`                  merge back (Scouts is gone)
 *   `[Group: Scouts as Wolfpack]`              rename
 *   `[Group: Wolfpack + Kowyn]` / `- Lilith`   add / remove (removed: goes solo)
 */
export interface GroupTag {
  kind: "group";
  op: "define" | "split" | "merge" | "rename" | "add" | "remove";
  group: string;
  /** split / merge / rename: the other group. */
  to?: string;
  members?: string[];
}

/**
 * A marker for a while on a travel map: `[Mark: Ambush|here-red[skull]@(4,-1)]`
 * starts it (`|until long rest` says when it ends), `[Mark: Ambush|@(5,-1)]`
 * moves it, `[Mark: -Ambush]` ends it.
 */
export interface MarkTag {
  kind: "mark";
  name: string;
  end?: boolean;
  spec?: string;
  /** `(q,r)`, fractions allowed. */
  at?: [number, number];
  until?: string;
}

/**
 * Where combatants stand on the battle map — `[Pos: Talon C4; [[Kobold, Elite]] H2]`.
 * Squares are named like a chessboard (columns A…, rows 1…); on a travel's hex
 * map, hexes are axial in parentheses (`[Pos: Party (2,0)]`, written `(2,0)`).
 */
export interface PositionTag {
  kind: "position";
  entries: Array<{ name: string; at: string }>;
}

/**
 * A move on the battle map. `[Mv: E3]` moves the acting creature; `[Mv: G4>F4>E4]`
 * gives the route; `[Mv: Lilith D5]` moves someone else (shoved, carried).
 */
export interface MoveTag {
  kind: "move";
  /** Who moves, when it isn't the actor. */
  who?: string;
  /** Written after the action on its line (`Shortsword → Kobold [Mv: J14]`):
   *  the move comes once the action is done. Before it, it comes first. */
  after?: boolean;
  /** The squares passed through, ending where it stops (`["G4", "F4", "E4"]`). */
  path: string[];
  /** How, when not on foot: `[Mv: Party (5,-2) | teleport]`, `| ship`. On a travel map
   *  it's drawn as a jump of that kind, and needs no `[TRAVEL]` around it. */
  via?: string;
}

/** One combatant in an `[Init: …]` tag: a name and, when written, its value. */
export interface InitiativeEntry {
  /** As written — may be a `[[wikilink]]`. */
  name: string;
  /** The initiative: a plain number, or the total a written roll came to. */
  value?: number;
  /** The roll that produced `value`, when written (`d20+1=`). */
  roll?: string;
  /** Where it starts on the battle map, written after it (`@J14`). */
  at?: string;
  /** Its token's emoji in this fight (`🐸`), over its page's `token:`. */
  icon?: string;
}

/**
 * Combat order. `[Init: Talon 17; Kobold 12]` SETS the order (sorted by value,
 * highest first; ties and unvalued names keep the written order).
 * `[Init:+ Kobold Archer 14]` adds combatants mid-fight; `[Init:- Kobold]`
 * removes them (dead, fled).
 */
export interface InitiativeTag {
  kind: "initiative";
  op: "set" | "add" | "remove";
  entries: InitiativeEntry[];
}

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
  /** Synthesized from a question's leading `[CF:n]` rather than written as an op. */
  stated?: boolean;
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

/**
 * The day's clock: `[Time: +8h]` moves it on (hours, or `+2d` days),
 * `[Time: Day 2, 08:00]` sets it. What a long rest's once-a-day and a
 * stage's hours on the road are read against.
 */
export interface TimeTag {
  kind: "time";
  /** Hours it moves the clock on. */
  advance?: number;
  /** The day and hour it sets. */
  set?: { day?: number; hour?: number };
  raw: string;
}

/** The weather now, a running tag: `[Weather: Autumn · warm · calm · clear]`. */
export interface WeatherTag {
  kind: "weather";
  parts: string[];
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
  /** As written — may be or hold a `[[wikilink]]` (`Fat [[Kobold, A]]`). */
  name: string;
  tags: string[];
  /** `[#F:Name]` — a mention of a foe already in play, not a new entry. */
  ref?: boolean;
  /** HP as written: `HP 26` sets it, `HP-5` / `HP+3` moves it, `HP 21/26`
   *  sets the value and its max. */
  hp?: { set?: number; delta?: number; max?: number };
  /** An end state written as a tag (`dead`, `fled`, `defeated`, `unconscious`). */
  state?: string;
}

export interface InventoryTag {
  kind: "inventory";
  name: string;
  ref: boolean;
  /** Whose item it is, when written (`[Inv:Talon/Rope+1]`). Otherwise the
   *  line's actor owns it, or the party when nobody acts. */
  owner?: string;
  /** The containers it's in, below the owner, outermost first
   *  (`[Inv:Kowyn's Bag/[[Pouch]]/[[Sling bullets]]+15]` → `["Pouch"]`). */
  path?: string[];
  /** The name was written as a `[[wikilink]]`, so it names a note. */
  link?: boolean;
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
