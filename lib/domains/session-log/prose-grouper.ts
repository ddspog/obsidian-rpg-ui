import type {
  LonelogEntry,
  SceneEntry,
  ActionEntry,
  WorldEventEntry,
  RollEntry,
  ConsequenceEntry,
  OracleQuestionEntry,
  OracleAnswerEntry,
  DialogueEntry,
  NarrativeEntry,
  MetaNoteEntry,
  CombatMarkerEntry,
  RoundMarkerEntry,
  ResourceMarkerEntry,
  DungeonStatusMarkerEntry,
} from "lib/domains/lonelog/types";

export type ProseSegment =
  | { type: "scene"; entry: SceneEntry }
  | { type: "action-group"; action: ActionEntry; rolls: RollEntry[]; consequences: ConsequenceEntry[] }
  | { type: "world-event"; entry: WorldEventEntry; rolls: RollEntry[]; consequences: ConsequenceEntry[] }
  | { type: "oracle"; question: OracleQuestionEntry; answer?: OracleAnswerEntry; consequence?: ConsequenceEntry }
  | { type: "dialogue"; entry: DialogueEntry }
  | { type: "narrative"; entry: NarrativeEntry }
  | { type: "meta"; entry: MetaNoteEntry }
  | { type: "standalone-consequence"; entry: ConsequenceEntry }
  | { type: "standalone-roll"; entry: RollEntry }
  | { type: "combat-start"; entry: CombatMarkerEntry }
  | { type: "combat-end"; entry: CombatMarkerEntry }
  | { type: "round"; round: number }
  | { type: "resource-start"; entry: ResourceMarkerEntry }
  | { type: "resource-end"; entry: ResourceMarkerEntry }
  | { type: "dungeon-status-start"; entry: DungeonStatusMarkerEntry }
  | { type: "dungeon-status-end"; entry: DungeonStatusMarkerEntry };

export function groupIntoProse(entries: LonelogEntry[]): ProseSegment[] {
  const segments: ProseSegment[] = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i];

    switch (entry.type) {
      case "scene":
        segments.push({ type: "scene", entry });
        i++;
        break;

      case "combat_marker":
        segments.push({ type: entry.state === "open" ? "combat-start" : "combat-end", entry });
        i++;
        break;

      case "resource_marker":
        segments.push({ type: entry.state === "open" ? "resource-start" : "resource-end", entry });
        i++;
        break;

      case "dungeon_status_marker":
        segments.push({ type: entry.state === "open" ? "dungeon-status-start" : "dungeon-status-end", entry });
        i++;
        break;

      case "round_marker":
        segments.push({ type: "round", round: entry.round });
        i++;
        break;

      case "action": {
        const rolls: RollEntry[] = [];
        const consequences: ConsequenceEntry[] = [];
        i++;
        while (i < entries.length) {
          const next = entries[i];
          if (next.type === "roll") {
            rolls.push(next);
            i++;
          } else if (next.type === "consequence") {
            consequences.push(next);
            i++;
          } else {
            break;
          }
        }
        segments.push({ type: "action-group", action: entry, rolls, consequences });
        break;
      }

      case "world_event": {
        const rolls: RollEntry[] = [];
        const consequences: ConsequenceEntry[] = [];
        i++;
        while (i < entries.length) {
          const next = entries[i];
          if (next.type === "roll") {
            rolls.push(next);
            i++;
          } else if (next.type === "consequence") {
            consequences.push(next);
            i++;
          } else {
            break;
          }
        }
        segments.push({ type: "world-event", entry, rolls, consequences });
        break;
      }

      case "oracle_question": {
        const question = entry;
        i++;
        let answer: OracleAnswerEntry | undefined;
        let consequence: ConsequenceEntry | undefined;
        if (i < entries.length && entries[i].type === "oracle_answer") {
          answer = entries[i] as OracleAnswerEntry;
          i++;
        }
        if (i < entries.length && entries[i].type === "consequence") {
          consequence = entries[i] as ConsequenceEntry;
          i++;
        }
        segments.push({ type: "oracle", question, answer, consequence });
        break;
      }

      case "consequence":
        segments.push({ type: "standalone-consequence", entry });
        i++;
        break;

      case "roll":
        segments.push({ type: "standalone-roll", entry });
        i++;
        break;

      case "dialogue":
        segments.push({ type: "dialogue", entry });
        i++;
        break;

      case "narrative":
        segments.push({ type: "narrative", entry });
        i++;
        break;

      case "meta_note":
        segments.push({ type: "meta", entry });
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
