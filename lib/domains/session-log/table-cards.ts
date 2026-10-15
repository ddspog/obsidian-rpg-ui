/**
 * The cards of the table — the Game Master's and the Party's together — sorted
 * two ways for the hotbar: by AREA (its tabs: story, combat, the party's own)
 * and by MECHANISM (its pills: what kind of machine the card is — an oracle
 * asking, a generator rolling its steps, a table consulted, plain dice, a
 * compound of several, an event or a scene, a control of the fight, a
 * procedure the party walks through).
 */

import type { SessionFeatureCard } from "./card-types";

export type TableMechanism =
  | "Oracles"
  | "Generators"
  | "Tables"
  | "Rolls"
  | "Compound"
  | "Events & scenes"
  | "Controls"
  | "Procedures";

/** The pills' order, and a Lucide glyph for each. */
export const TABLE_MECHANISMS: Array<{ id: TableMechanism; glyph: string; hint: string }> = [
  { id: "Oracles", glyph: "HelpCircle", hint: "Ask a question, read the answer" },
  { id: "Generators", glyph: "Sparkles", hint: "Roll steps that build something" },
  { id: "Tables", glyph: "Table", hint: "Consult a table" },
  { id: "Rolls", glyph: "Dices", hint: "Plain dice" },
  { id: "Compound", glyph: "Layers", hint: "Several of these at once" },
  { id: "Events & scenes", glyph: "Clapperboard", hint: "Open a scene, trigger an event" },
  { id: "Controls", glyph: "Swords", hint: "Start or end the fight, turn and round" },
  { id: "Procedures", glyph: "ScrollText", hint: "The party's rests, loot, road and group checks" },
];

const FIGHT_KINDS = new Set(["start-combat", "end-combat", "next-round", "next-turn"]);

/** The tab a table card sits under: the story's tools, the fight's, the party's own. */
export function tableAreaOf(card: SessionFeatureCard, bucket?: string): "Story" | "Combat" | "Party" {
  if (card.kind === "party") return "Party";
  if (card.kind && FIGHT_KINDS.has(card.kind)) return "Combat";
  if (bucket === "combat") return "Combat";
  return "Story";
}

/** What kind of machine a table card is, by the lines it writes; none when it can't tell. */
export function mechanismOf(card: SessionFeatureCard, bucket?: string): TableMechanism | undefined {
  if (card.kind === "party") return "Procedures";
  if (card.kind && FIGHT_KINDS.has(card.kind)) return "Controls";
  if (bucket === "scene" || bucket === "event") return "Events & scenes";
  const t = card.logTemplate ?? "";
  const kinds: TableMechanism[] = [];
  if (/^\s*\?/m.test(t)) kinds.push("Oracles");
  if (/^\s*gen:/m.test(t)) kinds.push("Generators");
  if (/^\s*tbl:/m.test(t)) kinds.push("Tables");
  if (/^\s*d(\([^)]*\))?:/m.test(t)) kinds.push("Rolls");
  if (/^\s*!/m.test(t)) kinds.push("Events & scenes");
  if (kinds.length > 1) return "Compound";
  if (kinds.length === 1) return kinds[0];
  if (bucket === "oracle") return "Oracles";
  if (bucket === "meaning" || bucket === "list") return "Generators";
  if (bucket === "table") return "Tables";
  if (bucket === "roll") return "Rolls";
  if (bucket === "generator") return "Generators";
  return undefined;
}

/** Whether a stack belongs to the table (the GM's cards, or the party's). */
export const isTableStack = (stack: { actorType?: string; cards: SessionFeatureCard[] }): boolean =>
  stack.actorType === "gm" || stack.cards.some((c) => c.kind === "party");
