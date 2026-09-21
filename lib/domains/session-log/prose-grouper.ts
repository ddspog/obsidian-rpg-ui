import type {
  LonelogEntry,
  SceneEntry,
  ActionEntry,
  WorldEventEntry,
  RollEntry,
  ConsequenceEntry,
  OracleQuestionEntry,
  OracleCallEntry,
  OracleAnswerEntry,
  DialogueEntry,
  NarrativeEntry,
  MetaNoteEntry,
  TableRollEntry,
  GeneratorEntry,
  CombatMarkerEntry,
  ResourceMarkerEntry,
  DungeonStatusMarkerEntry,
} from "lib/domains/lonelog/types";

/** The discriminated shape of a prose segment, before shared fields are mixed in. */
export type ProseSegmentKind =
  | { type: "scene"; entry: SceneEntry }
  | { type: "action-group"; action: ActionEntry; rolls: RollEntry[]; consequences: ConsequenceEntry[] }
  | { type: "world-event"; entry: WorldEventEntry; rolls: RollEntry[]; consequences: ConsequenceEntry[] }
  | {
      type: "oracle";
      /** `o:` lines consulted for this question. */
      oracles: OracleCallEntry[];
      question: OracleQuestionEntry;
      answer?: OracleAnswerEntry;
      rolls: RollEntry[];
      generators: GeneratorEntry[];
      tables: TableRollEntry[];
      consequences: ConsequenceEntry[];
    }
  | { type: "dialogue"; entry: DialogueEntry }
  | { type: "narrative"; entry: NarrativeEntry }
  | { type: "meta"; entry: MetaNoteEntry }
  | { type: "standalone-consequence"; entry: ConsequenceEntry }
  | { type: "standalone-roll"; entry: RollEntry }
  | { type: "standalone-table"; entry: TableRollEntry }
  | { type: "standalone-generator"; entry: GeneratorEntry }
  | { type: "concat" }
  | { type: "combat-start"; entry: CombatMarkerEntry }
  | { type: "combat-end"; entry: CombatMarkerEntry }
  | { type: "round"; round: number }
  | { type: "resource-start"; entry: ResourceMarkerEntry }
  | { type: "resource-end"; entry: ResourceMarkerEntry }
  | { type: "dungeon-status-start"; entry: DungeonStatusMarkerEntry }
  | { type: "dungeon-status-end"; entry: DungeonStatusMarkerEntry };

export type ProseSegment = ProseSegmentKind & {
  /**
   * Index of this segment's anchor entry in the source `entries[]` array — a
   * stable id shared by the prose dot, the sidebar card, and the scroll target.
   */
  sourceIndex: number;
  /** Working/detail lines (indented under the block) — surfaced in the sidebar only. */
  continuations?: string[];
};

export function groupIntoProse(entries: LonelogEntry[]): ProseSegment[] {
  const segments: ProseSegment[] = [];
  let i = 0;

  const push = (seg: ProseSegmentKind, sourceIndex: number, continuations?: string[]) => {
    const full = { ...seg, sourceIndex } as ProseSegment;
    if (continuations && continuations.length > 0) full.continuations = continuations;
    segments.push(full);
  };

  while (i < entries.length) {
    const start = i;
    const entry = entries[i];

    switch (entry.type) {
      case "continuation": {
        // A continuation that wasn't absorbed by a resolution block above
        // attaches to whatever segment precedes it (scene, narration, …).
        const last = segments[segments.length - 1];
        if (last) (last.continuations ??= []).push(entry.text);
        i++;
        break;
      }

      case "concat":
        push({ type: "concat" }, start);
        i++;
        break;

      case "scene":
        push({ type: "scene", entry }, start);
        i++;
        break;

      case "combat_marker":
        push({ type: entry.state === "open" ? "combat-start" : "combat-end", entry }, start);
        i++;
        break;

      case "resource_marker":
        push({ type: entry.state === "open" ? "resource-start" : "resource-end", entry }, start);
        i++;
        break;

      case "dungeon_status_marker":
        push({ type: entry.state === "open" ? "dungeon-status-start" : "dungeon-status-end", entry }, start);
        i++;
        break;

      case "round_marker":
        push({ type: "round", round: entry.round }, start);
        i++;
        break;

      case "action": {
        const rolls: RollEntry[] = [];
        const consequences: ConsequenceEntry[] = [];
        const continuations: string[] = [];
        i++;
        while (i < entries.length) {
          const next = entries[i];
          if (next.type === "roll") rolls.push(next);
          else if (next.type === "consequence") consequences.push(next);
          else if (next.type === "continuation") continuations.push(next.text);
          else break;
          i++;
        }
        push({ type: "action-group", action: entry, rolls, consequences }, start, continuations);
        break;
      }

      case "world_event": {
        const rolls: RollEntry[] = [];
        const consequences: ConsequenceEntry[] = [];
        const continuations: string[] = [];
        i++;
        while (i < entries.length) {
          const next = entries[i];
          if (next.type === "roll") rolls.push(next);
          else if (next.type === "consequence") consequences.push(next);
          else if (next.type === "continuation") continuations.push(next.text);
          else break;
          i++;
        }
        push({ type: "world-event", entry, rolls, consequences }, start, continuations);
        break;
      }

      case "oracle_question": {
        // A GM interaction groups the question with its resolution mechanics
        // (answer, generators, tables, rolls) and the consequence(s) it yields,
        // mirroring how an action absorbs its rolls + consequences.
        const question = entry;
        let answer: OracleAnswerEntry | undefined;
        const rolls: RollEntry[] = [];
        const generators: GeneratorEntry[] = [];
        const tables: TableRollEntry[] = [];
        const oracles: OracleCallEntry[] = [];
        const consequences: ConsequenceEntry[] = [];
        const continuations: string[] = [];
        i++;
        while (i < entries.length) {
          const next = entries[i];
          if (next.type === "oracle_answer") {
            if (!answer) answer = next;
          } else if (next.type === "oracle_call") oracles.push(next);
          else if (next.type === "roll") rolls.push(next);
          else if (next.type === "generator") generators.push(next);
          else if (next.type === "table_roll") tables.push(next);
          else if (next.type === "consequence") consequences.push(next);
          else if (next.type === "continuation") continuations.push(next.text);
          else break;
          i++;
        }
        push(
          { type: "oracle", question, answer, oracles, rolls, generators, tables, consequences },
          start,
          continuations
        );
        break;
      }

      case "consequence":
        push({ type: "standalone-consequence", entry }, start);
        i++;
        break;

      case "roll":
        push({ type: "standalone-roll", entry }, start);
        i++;
        break;

      case "table_roll":
        push({ type: "standalone-table", entry }, start);
        i++;
        break;

      case "generator":
        push({ type: "standalone-generator", entry }, start);
        i++;
        break;

      case "dialogue":
        push({ type: "dialogue", entry }, start);
        i++;
        break;

      case "narrative":
        push({ type: "narrative", entry }, start);
        i++;
        break;

      case "meta_note":
        push({ type: "meta", entry }, start);
        i++;
        break;

      default:
        i++;
        break;
    }
  }

  return segments;
}

export function summarizeRoll(roll: RollEntry): { label: string; success: boolean | undefined } {
  const expr = roll.roll;
  const firstWord = expr.split(/\s/)[0];
  const label = firstWord.match(/^[A-Z]/i) ? firstWord : expr.split(/\s+vs\s/i)[0];
  return { label: label.replace(/\s*d\d.*$/, "").trim() || expr, success: roll.success };
}
