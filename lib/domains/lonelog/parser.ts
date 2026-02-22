/** Lonelog Parser — tokenizes Lonelog notation into structured entries (Lonelog v1.0.0, CC BY-SA 4.0, by Roberto Bisceglie) */

import type { LonelogEntry } from "./types";
import { extractTags } from "./tag-extractor";
export { extractTags } from "./tag-extractor";

/**
 * Parse Lonelog body text into structured entries
 */
export function parseLonelog(body: string): LonelogEntry[] {
  const lines = body.split("\n");
  const entries: LonelogEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // Skip empty lines

    const entry = parseLine(trimmed);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Parse a single line into a LonelogEntry
 */
function parseLine(line: string): LonelogEntry | null {
  // Scene marker: S1, S1a, T1-S1, S1.1, etc.
  const sceneMatch = line.match(/^(T\d+-S\d+[a-z]?|S\d+(?:\.\d+|[a-z])?)\s+(.*)$/i);
  if (sceneMatch) {
    const number = sceneMatch[1];
    const context = sceneMatch[2].replace(/^\*|\*$/g, "").trim(); // Remove optional asterisks
    return { type: "scene", number, context };
  }

  // Action: @ text
  if (line.startsWith("@")) {
    return { type: "action", text: line.slice(1).trim() };
  }

  // Oracle question: ? text
  if (line.startsWith("?")) {
    return { type: "oracle_question", text: line.slice(1).trim() };
  }

  // Oracle answer: -> text
  if (line.startsWith("->")) {
    const text = line.slice(2).trim();
    // Extract optional roll: (d6=3)
    const rollMatch = text.match(/\(([^)]+)\)$/);
    const roll = rollMatch ? rollMatch[1] : undefined;
    const answerText = rollMatch
      ? text.slice(0, -rollMatch[0].length).trim()
      : text;
    return { type: "oracle_answer", text: answerText, roll };
  }

  // Roll: d: expression
  if (line.startsWith("d:")) {
    const rollText = line.slice(2).trim();
    // Split on "->" to separate roll from result
    const parts = rollText.split("->").map((p) => p.trim());
    const roll = parts[0] || rollText;
    const result = parts[1] || "";

    // Try to detect success/failure
    let success: boolean | undefined;
    const resultLower = result.toLowerCase();
    if (resultLower.includes("success") || resultLower.includes("hit")) {
      success = true;
    } else if (
      resultLower.includes("fail") ||
      resultLower.includes("miss")
    ) {
      success = false;
    }

    return { type: "roll", roll, result, success };
  }

  // Consequence: => text [with tags]
  if (line.startsWith("=>")) {
    const text = line.slice(2).trim();
    const tags = extractTags(text);
    return { type: "consequence", text, tags };
  }

  // Dialogue: N (Name): "text" or PC: "text"
  const dialogueMatch = line.match(/^(?:N\s*\(([^)]+)\)|PC):\s*"([^"]*)"$/);
  if (dialogueMatch) {
    const speaker = dialogueMatch[1] || "PC";
    const text = dialogueMatch[2];
    return { type: "dialogue", speaker, text };
  }

  // Table roll: tbl: source roll result
  if (line.startsWith("tbl:")) {
    const content = line.slice(4).trim();
    // Format: "source roll result"
    const parts = content.split(/\s+/);
    const source = parts[0] || "";
    const roll = parts[1] || "";
    const result = parts.slice(2).join(" ");
    return { type: "table_roll", source, roll, result };
  }

  // Generator: gen: source result
  if (line.startsWith("gen:")) {
    const content = line.slice(4).trim();
    const parts = content.split(/\s+/);
    const source = parts[0] || "";
    const result = parts.slice(1).join(" ");
    return { type: "generator", source, result };
  }

  // Meta note: (note: text)
  const noteMatch = line.match(/^\(note:\s*(.+)\)$/);
  if (noteMatch) {
    return { type: "meta_note", text: noteMatch[1] };
  }

  // Fallback: narrative prose
  return { type: "narrative", text: line };
}
