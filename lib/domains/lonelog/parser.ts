/** Lonelog/Partylog Parser — tokenizes session notation into structured entries */

import type { LonelogEntry } from "./types";
import { extractTags } from "./tag-extractor";
import { parseRollField } from "./dice-expression";
import { isCardDraw } from "./card-expression";
export { extractTags } from "./tag-extractor";

export function parseLonelog(body: string): LonelogEntry[] {
  const lines = body.split("\n");
  const entries: LonelogEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const entry = parseLine(trimmed);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function parseLine(line: string): LonelogEntry | null {
  // Scene marker: S1, S1a, T1-S1, S1.1, etc.
  const sceneMatch = line.match(/^(T\d+-S\d+[a-z]?|S\d+(?:\.\d+|[a-z])?)\s+(.*)$/i);
  if (sceneMatch) {
    const number = sceneMatch[1];
    const context = sceneMatch[2].replace(/^\*|\*$/g, "").trim();
    return { type: "scene", number, context };
  }

  // Combat markers: [COMBAT] / [/COMBAT]
  if (line === "[COMBAT]") return { type: "combat_marker", state: "open" };
  if (line === "[/COMBAT]") return { type: "combat_marker", state: "close" };

  // Resource markers: [RESOURCES] / [/RESOURCES]
  if (line === "[RESOURCES]") return { type: "resource_marker", state: "open" };
  if (line === "[/RESOURCES]") return { type: "resource_marker", state: "close" };

  // Dungeon status markers: [DUNGEON STATUS] / [/DUNGEON STATUS]
  if (line === "[DUNGEON STATUS]") return { type: "dungeon_status_marker", state: "open" };
  if (line === "[/DUNGEON STATUS]") return { type: "dungeon_status_marker", state: "close" };

  // Round markers: R1, R2, etc.
  const roundMatch = line.match(/^R(\d+)$/);
  if (roundMatch) return { type: "round_marker", round: parseInt(roundMatch[1], 10) };

  // Action: @(Name) text, @(Name > Assist) text, @(Name+Name) text, or bare @ text
  if (line.startsWith("@")) {
    return parseAction(line);
  }

  // World event: ! text
  if (line.startsWith("!")) {
    const text = line.slice(1).trim();
    const tags = extractTags(text);
    return { type: "world_event", text, tags };
  }

  // Oracle question: ? text or ?(Name) text
  if (line.startsWith("?")) {
    const oracleMatch = line.match(/^\?\(([^)]+)\)\s+(.+)$/);
    if (oracleMatch) {
      return { type: "oracle_question", text: oracleMatch[2], actor: oracleMatch[1] };
    }
    return { type: "oracle_question", text: line.slice(1).trim() };
  }

  // Oracle answer: -> text
  if (line.startsWith("->")) {
    const text = line.slice(2).trim();
    const rollMatch = text.match(/\(([^)]+)\)$/);
    const roll = rollMatch ? rollMatch[1] : undefined;
    const answerText = rollMatch ? text.slice(0, -rollMatch[0].length).trim() : text;
    return { type: "oracle_answer", text: answerText, roll };
  }

  // Roll: d(Name): expression or d: expression
  if (line.startsWith("d:") || line.match(/^d\([^)]+\):/)) {
    return parseRoll(line);
  }

  // Consequence: => text [with tags]
  if (line.startsWith("=>")) {
    const text = line.slice(2).trim();
    const tags = extractTags(text);
    return { type: "consequence", text, tags };
  }

  // Dialogue: PC(Name): "text" or N(Name): "text"
  const dialogueMatch = line.match(/^(PC|N)\(([^)]+)\):\s*(?:"([^"]*)"|(.+))$/);
  if (dialogueMatch) {
    const speakerType = dialogueMatch[1] === "PC" ? "pc" as const : "npc" as const;
    const speaker = dialogueMatch[2];
    const text = dialogueMatch[3] ?? dialogueMatch[4];
    return { type: "dialogue", speaker, speakerType, text };
  }

  // Legacy dialogue: N (Name): "text" or PC: "text"
  const legacyDialogue = line.match(/^(?:N\s*\(([^)]+)\)|PC):\s*"([^"]*)"$/);
  if (legacyDialogue) {
    const speaker = legacyDialogue[1] || "PC";
    const text = legacyDialogue[2];
    return { type: "dialogue", speaker, speakerType: legacyDialogue[1] ? "npc" : "pc", text };
  }

  // Table roll: tbl: source roll -> result
  if (line.startsWith("tbl:")) {
    const content = line.slice(4).trim();
    const arrowParts = content.split("->").map((p) => p.trim());
    if (arrowParts.length >= 2) {
      const beforeArrow = arrowParts[0];
      const result = arrowParts.slice(1).join("->").trim();
      const spaceParts = beforeArrow.split(/\s+/);
      const source = spaceParts[0] || "";
      const roll = spaceParts.slice(1).join(" ");
      return { type: "table_roll", source, roll, result };
    }
    const parts = content.split(/\s+/);
    return { type: "table_roll", source: parts[0] || "", roll: parts[1] || "", result: parts.slice(2).join(" ") };
  }

  // Generator: gen: source -> result
  if (line.startsWith("gen:")) {
    const content = line.slice(4).trim();
    const arrowParts = content.split("->").map((p) => p.trim());
    if (arrowParts.length >= 2) {
      return { type: "generator", source: arrowParts[0], result: arrowParts.slice(1).join("->").trim() };
    }
    const parts = content.split(/\s+/);
    return { type: "generator", source: parts[0] || "", result: parts.slice(1).join(" ") };
  }

  // Meta note: (note: text), (rule: text), (post: text), (hook: text)
  const noteMatch = line.match(/^\((note|rule|post|hook):\s*(.+)\)$/);
  if (noteMatch) {
    return { type: "meta_note", text: `${noteMatch[1]}: ${noteMatch[2]}` };
  }

  // Standalone tag lines: [Inv:...] [Wealth:...] [PC:...] [R:...] etc. — treat as consequence
  if (line.startsWith("[") && line.match(/^\[(?:#)?(?:Inv|Wealth|PC|N|F|R|Clock|Track|Timer|Thread|E|L):/)) {
    const tags = extractTags(line);
    if (tags.length > 0) {
      return { type: "consequence", text: line, tags };
    }
  }

  // Fallback: narrative prose
  return { type: "narrative", text: line };
}

function parseAction(line: string): LonelogEntry {
  // @(Name > Assist) text — collaborative action
  const collab = line.match(/^@\(([^>)]+)\s*>\s*([^)]+)\)\s+(.+)$/);
  if (collab) {
    return { type: "action", actor: collab[1].trim(), assist: collab[2].trim(), text: collab[3] };
  }

  // @(Name+Name) text — group action
  const group = line.match(/^@\(([^)]+\+[^)]+)\)\s+(.+)$/);
  if (group) {
    return { type: "action", actor: group[1].trim(), text: group[2] };
  }

  // @(Name) text — attributed action
  const attributed = line.match(/^@\(([^)]+)\)\s+(.+)$/);
  if (attributed) {
    return { type: "action", actor: attributed[1].trim(), text: attributed[2] };
  }

  // @ text — unattributed action (legacy Lonelog)
  return { type: "action", text: line.slice(1).trim() };
}

function parseRoll(line: string): LonelogEntry {
  // d(Name): expression
  const attributed = line.match(/^d\(([^)]+)\):\s*(.+)$/);
  let rollText: string;
  let actor: string | undefined;

  if (attributed) {
    actor = attributed[1].trim();
    rollText = attributed[2];
  } else {
    rollText = line.slice(2).trim();
  }

  // Use structured dice parser for richer data
  const parsed = parseRollField(rollText);
  const firstExpr = parsed.expressions[0];

  // Reconstruct roll and result for backward compat
  const parts = rollText.split("->").map((p) => p.trim());
  const roll = parts[0] || rollText;
  const result = parsed.outcome || parts.slice(1).join("->").trim();

  let success: boolean | undefined;
  const resultLower = result.toLowerCase();
  if (resultLower.includes("success") || resultLower.includes("hit") || resultLower === "s") {
    success = true;
  } else if (resultLower.includes("fail") || resultLower.includes("miss") || resultLower === "f") {
    success = false;
  }

  return {
    type: "roll",
    roll,
    result,
    success,
    actor,
    label: firstExpr?.label,
    total: firstExpr?.total,
    breakdown: firstExpr?.breakdown,
    vsTarget: parsed.vsTarget,
    isCardDraw: isCardDraw(rollText) || undefined,
  };
}
