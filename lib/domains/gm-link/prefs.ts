/**
 * How the player wants the Game Master to run a session: kept in the session
 * note's frontmatter, so it travels with every hand-over and the GM reads it
 * at each turn (`rpg gm brief`). The plugin sets it from a dialog; it can be
 * written by hand as well.
 *
 *   gm-mode: secret            secret | open (where prep is kept)
 *   gm-autonomy: decision      beat | decision | scene (how far a GM's turn goes)
 *   gm-ask-first: [..]         what the GM asks about before it happens
 *   gm-profile: "[[note]]"     a note of tone, difficulty, house rules, language
 */

export type GmAutonomy = "beat" | "decision" | "scene";

export const AUTONOMY: Array<{ value: GmAutonomy; label: string; forGm: string }> = [
  {
    value: "beat",
    label: "One beat at a time",
    forGm: "Resolve only what the player just did and its immediate result, then give the turn back.",
  },
  {
    value: "decision",
    label: "Until the party must decide",
    forGm: "Carry the scene forward until a choice belongs to the party, then give the turn back.",
  },
  {
    value: "scene",
    label: "A whole scene",
    forGm:
      "Play the scene through to its end when the party's intent is clear, stopping only where a choice would change its course; then close it and give the turn back.",
  },
];

/** Things a GM may be told to ask about first. The player can add their own. */
export const ASK_FIRST: Array<{ id: string; label: string }> = [
  { id: "harm", label: "Dropping a character to 0 HP, or lasting harm" },
  { id: "death", label: "A character's death" },
  { id: "loot", label: "Giving loot, coins or XP" },
  { id: "threads", label: "Closing or adding a thread" },
  { id: "scene", label: "Ending the scene" },
  { id: "pcs", label: "Rolling for a player character" },
  { id: "world", label: "A lasting change to a place or an NPC" },
];

/** What a hand-over asks of the GM. */
export type TurnKind = "play" | "prep" | "ruling" | "recap" | "foes";

export const TURN_KINDS: Array<{ value: TurnKind; label: string; forGm: string }> = [
  { value: "play", label: "Go on with the story", forGm: "Play your part as the loop says." },
  {
    value: "prep",
    label: "Prepare only",
    forGm:
      "Do not advance the story or write to the log. Prepare (the guide's Prep), then give the turn back saying only that you have.",
  },
  {
    value: "ruling",
    label: "A rules question",
    forGm:
      "Answer the player's question from the books, naming the note you read. Write a (rule: …) line only if it is a ruling. Do not advance the story.",
  },
  {
    value: "recap",
    label: "A recap",
    forGm:
      "Tell the player where play stands, from the log: the scene, the threads, what is unresolved. Write nothing to the log.",
  },
  {
    value: "foes",
    label: "Run the foes' turn",
    forGm:
      "In the open fight, play the turn of each foe that is next (their statblocks, your rolls), up to the next player character's turn. Nothing else.",
  },
];

export interface GmPrefs {
  mode: "secret" | "open";
  autonomy: GmAutonomy;
  /** Ids from `ASK_FIRST`, and the player's own sentences. */
  askFirst: string[];
  /** The profile note, as a link (`[[GM profile]]`). */
  profile?: string;
}

export const DEFAULT_PREFS: GmPrefs = { mode: "secret", autonomy: "decision", askFirst: [] };

export function readPrefs(fm: Record<string, unknown> | undefined | null): GmPrefs {
  const f = fm ?? {};
  const autonomy = String(f["gm-autonomy"] ?? "").toLowerCase();
  const ask = f["gm-ask-first"];
  const profile = typeof f["gm-profile"] === "string" ? (f["gm-profile"] as string).trim() : "";
  return {
    mode: String(f["gm-mode"] ?? "").toLowerCase() === "open" ? "open" : "secret",
    autonomy: AUTONOMY.some((a) => a.value === autonomy) ? (autonomy as GmAutonomy) : DEFAULT_PREFS.autonomy,
    askFirst: (Array.isArray(ask) ? ask : ask ? [ask] : []).map((a) => String(a).trim()).filter(Boolean),
    ...(profile ? { profile } : {}),
  };
}

/** The frontmatter keys for some prefs (a key set to undefined is removed). */
export function prefsFrontmatter(p: GmPrefs): Record<string, unknown> {
  return {
    "gm-mode": p.mode,
    "gm-autonomy": p.autonomy,
    "gm-ask-first": p.askFirst.length ? p.askFirst : undefined,
    "gm-profile": p.profile || undefined,
  };
}

/** The ask-first entries in words: a known id's label, or the player's own sentence. */
export const askFirstWords = (p: GmPrefs): string[] =>
  p.askFirst.map((a) => ASK_FIRST.find((k) => k.id === a)?.label ?? a);

/** What the GM is told, as the lines `rpg gm brief` prints. */
export function prefsForGm(p: GmPrefs, profileText?: string): string[] {
  const autonomy = AUTONOMY.find((a) => a.value === p.autonomy) ?? AUTONOMY[1];
  const out = [`- How far your turn goes: **${autonomy.label.toLowerCase()}**. ${autonomy.forGm}`];
  const ask = askFirstWords(p);
  out.push(
    ask.length
      ? `- Ask first, and do not do it until the player answers: ${ask.join("; ")}. To ask, give the turn back with the question.`
      : "- Nothing is marked ask-first."
  );
  if (p.profile)
    out.push(
      profileText?.trim()
        ? `- The player's GM profile (${p.profile}); follow it where it does not break the contract:\n\n${profileText
            .trim()
            .split("\n")
            .map((l) => `  > ${l}`)
            .join("\n")}`
        : `- A GM profile is named (${p.profile}) but the note is not in the vault.`
    );
  return out;
}

/** A profile note to start from. */
export const PROFILE_TEMPLATE = `---
gm-profile: true
---
# GM profile

What the Game Master should know about how this table plays. Change anything; delete what does not matter.

## Voice
- Write in the same language, person and tense as the session's journal.
- Narration: short paragraphs, concrete senses, no summary of what the characters feel.

## Difficulty
- Fights are fair and can be lost. Foes act with sense: they flee, bargain, use the ground.
- Roll in the open what the table would see.

## Pacing
- Favour the party's threads over new ones. One complication at a time.

## Content
- Lines not to cross: (none written yet)

## House rules
- (none written yet)
`;
