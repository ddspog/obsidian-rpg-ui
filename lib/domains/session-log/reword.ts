/**
 * Rewording a log's prose. A log line that tells the story (an outcome, a line
 * of narration, a line of dialogue) is a passage: its words can be improved,
 * while what frames them (the `=>`, a speaker, the tags at its end) and every
 * other line (rolls, oracles, tables, markers) stay exactly as they are.
 *
 * Pure: the lines in, a prompt out, the model's answer checked and put back.
 */

export type PassageKind = "outcome" | "narration" | "dialogue" | "event";

export interface Passage {
  /** Its line in the log's body (0-based). */
  line: number;
  kind: PassageKind;
  /** What comes before the words on the line (`=> `, `N(Kowyn): `). */
  lead: string;
  text: string;
  /** What follows them (` [Talon/XP+87] [Time: +1h]`). */
  tail: string;
  speaker?: string;
  /** The scene it is in (`S02 With Kowyn`). */
  scene?: string;
}

const SCENE = /^(?:=>\s*)?((?:T\d+-)?S\d+[a-z]?(?:\.\d+)?)\b\s*(.*)$/;
/** Lines that are machinery, never prose. */
const MACHINERY = /^(@|\?|->|d:|d\(|tbl:|o:|gen:|\[|\(|R\(|\+\+$|\+ |[TR]\d+$|```|---$)/;

/** A line's words and the tags after them: `[Talon/XP+87]` goes, `[[Healing Draft]]` stays. */
export function splitTail(text: string): { words: string; tail: string } {
  let end = text.length;
  for (;;) {
    const trimmed = text.slice(0, end).replace(/\s+$/, "");
    if (!trimmed.endsWith("]")) break;
    let depth = 0;
    let at = -1;
    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (trimmed[i] === "]") depth++;
      else if (trimmed[i] === "[") depth--;
      if (depth === 0) {
        at = i;
        break;
      }
    }
    // Unbalanced, or a wikilink (`[[…]]`): the words end here.
    if (at < 0 || trimmed.startsWith("[[", at)) break;
    end = at;
  }
  const words = text.slice(0, end).replace(/\s+$/, "");
  return { words, tail: text.slice(words.length) };
}

/** The passages of a log's body, in order. */
export function passagesOf(body: string): Passage[] {
  const out: Passage[] = [];
  let scene: string | undefined;
  body.split("\n").forEach((raw, line) => {
    // An indented line belongs to the generator or the roll above it.
    if (!raw.trim() || /^\s/.test(raw)) return;
    const head = raw.match(SCENE);
    if (head) {
      scene = `${head[1]} ${splitTail(head[2]).words}`.trim();
      return;
    }
    let kind: PassageKind;
    let lead = "";
    let speaker: string | undefined;
    const said = raw.match(/^((?:N|PC)\(([^)]*)\):\s*)/);
    if (raw.startsWith("=>")) {
      kind = "outcome";
      lead = raw.match(/^=>\s*/)![0];
    } else if (raw.startsWith("!")) {
      kind = "event";
      lead = raw.match(/^!\s*/)![0];
    } else if (said) {
      kind = "dialogue";
      lead = said[1];
      speaker = said[2].trim();
    } else if (MACHINERY.test(raw)) return;
    else kind = "narration";
    const { words, tail } = splitTail(raw.slice(lead.length));
    if (!words.trim()) return;
    out.push({ line, kind, lead, text: words, tail, ...(speaker ? { speaker } : {}), ...(scene ? { scene } : {}) });
  });
  return out;
}

const links = (text: string) => (text.match(/\[\[[^\]]+\]\]/g) ?? []).sort();

/** What a rewording must keep to be accepted, or why it is not. */
export function refusal(passage: Passage, next: string): string | null {
  const clean = next.trim();
  if (!clean) return "empty";
  if (clean.includes("\n")) return "more than one line";
  if (links(clean).join("\u0000") !== links(passage.text).join("\u0000")) return "its links changed";
  // A tag or a roll slipped in would be read as mechanics.
  if (/(^|\s)\[(?!\[)/.test(clean.replace(/\[\[[^\]]+\]\]/g, ""))) return "it holds a tag";
  if (/^(=>|->|@|\?|!|d:|o:|tbl:|gen:)/.test(clean)) return "it starts like a log line";
  if (clean.length > Math.max(400, passage.text.length * 2.5)) return "far longer than the original";
  return null;
}

/** The body with some passages' words replaced. A passage whose line changed since it was read is left alone. */
export function applyRewording(
  body: string,
  edits: Array<{ passage: Passage; text: string }>
): { body: string; applied: number } {
  const lines = body.split("\n");
  let applied = 0;
  for (const { passage, text } of edits) {
    const was = `${passage.lead}${passage.text}${passage.tail}`;
    if (lines[passage.line] !== was || refusal(passage, text)) continue;
    lines[passage.line] = `${passage.lead}${text.trim()}${passage.tail}`;
    applied++;
  }
  return { body: lines.join("\n"), applied };
}

export const REWORD_SYSTEM = `You are an editor improving the prose of a tabletop role-playing session journal.

You are given numbered passages from the journal, each with the scene it belongs to and, where there are any, the game mechanics that produced it (dice, oracle answers, actions). Rewrite each passage so that it reads better, and change nothing else.

Rules:
- Keep every fact: who does what, to whom, with what result. The mechanics shown are what happened; never contradict them, never add an event, a character, an object or an outcome that is not in the passage.
- Keep the language of the passage, its person and its tense, and the voice of the journal around it.
- Keep every [[wikilink]] exactly as written, brackets and all, once each. You may move it within the sentence.
- Dialogue stays what that character would say: improve the line, do not change its meaning. Do not add a speaker's name or quotation marks.
- One passage in, one passage out: a single line, about the same length (never more than half again as long). No tags in square brackets, no dice, no notes.
- If a passage is already good, return it unchanged.

Answer with only a JSON array, one object per passage, in the order given: [{"id": 1, "text": "…"}].`;

/** The user message: each passage with what frames it. */
export function rewordPrompt(body: string, chosen: Passage[], wish: string): string {
  const lines = body.split("\n");
  const all = passagesOf(body);
  const parts: string[] = [];
  if (wish.trim()) parts.push(`What the writer asks for, above all: ${wish.trim()}`, "");
  // A few passages from before the first chosen one, for the journal's voice.
  const first = chosen[0]?.line ?? 0;
  const before = all.filter((p) => p.line < first).slice(-4);
  if (before.length)
    parts.push("The journal just before (for its voice; do not rewrite):", ...before.map((p) => `> ${p.text}`), "");
  chosen.forEach((p, i) => {
    // The machinery since the last passage: what this one tells.
    const prev = all.filter((q) => q.line < p.line).pop()?.line ?? -1;
    const mechanics = lines
      .slice(prev + 1, p.line)
      .filter((l) => l.trim())
      .slice(-12);
    parts.push(`## Passage ${i + 1}`);
    if (p.scene) parts.push(`Scene: ${p.scene}`);
    parts.push(p.kind === "dialogue" ? `Spoken by: ${p.speaker}` : `Kind: ${p.kind}`);
    if (mechanics.length) parts.push("Mechanics it tells:", "```", ...mechanics, "```");
    parts.push("Text:", p.text, "");
  });
  return parts.join("\n");
}

/** The model's answer read: the new words by passage, in the order asked. */
export function readRewording(
  answer: string,
  chosen: Passage[]
): Array<{ passage: Passage; text: string; refused?: string }> {
  const json = answer.match(/\[[\s\S]*\]/)?.[0];
  if (!json) throw new Error("The answer held no list of passages.");
  let items: Array<{ id?: number; text?: string }>;
  try {
    items = JSON.parse(json) as Array<{ id?: number; text?: string }>;
  } catch {
    throw new Error("The answer's list could not be read.");
  }
  return chosen.map((passage, i) => {
    const text = String(items.find((it) => Number(it.id) === i + 1)?.text ?? "").trim();
    const why = text ? refusal(passage, text) : "no answer for it";
    return { passage, text: why ? passage.text : text, ...(why ? { refused: why } : {}) };
  });
}
