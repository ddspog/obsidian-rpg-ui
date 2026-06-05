import { CardStack } from "./card-types";

export interface GMCard {
  id: string;
  name: string;
  category: GMCategory;
  icon: string;
  logTemplate: string;
  placeholders: string[];
}

export type GMCategory = "narration" | "oracle" | "mechanics" | "meta";

export const GM_CATEGORY_LABELS: Record<GMCategory, string> = {
  narration: "Narration",
  oracle: "Oracle",
  mechanics: "Mechanics",
  meta: "Meta",
};

export const GM_ACTOR = "Game Master";

const GM_CARD_DEFS: GMCard[] = [
  {
    id: "gm:world-event",
    name: "World Event",
    category: "narration",
    icon: "!",
    logTemplate: "! {{text}}",
    placeholders: ["text"],
  },
  {
    id: "gm:consequence",
    name: "Consequence",
    category: "narration",
    icon: "=>",
    logTemplate: "=> {{text}}",
    placeholders: ["text"],
  },
  {
    id: "gm:question",
    name: "Oracle Question",
    category: "oracle",
    icon: "?",
    logTemplate: "? {{question}}",
    placeholders: ["question"],
  },
  {
    id: "gm:answer",
    name: "Oracle Answer",
    category: "oracle",
    icon: "->",
    logTemplate: "-> {{answer}}",
    placeholders: ["answer"],
  },
  {
    id: "gm:roll",
    name: "Roll",
    category: "mechanics",
    icon: "d:",
    logTemplate: "d: {{expression}} -> {{result}}",
    placeholders: ["expression", "result"],
  },
  {
    id: "gm:table",
    name: "Table",
    category: "mechanics",
    icon: "tbl:",
    logTemplate: "tbl: {{source}} {{roll}} -> {{result}}",
    placeholders: ["source", "roll", "result"],
  },
  {
    id: "gm:generator",
    name: "Generator",
    category: "mechanics",
    icon: "gen:",
    logTemplate: "gen: {{source}} -> {{result}}",
    placeholders: ["source", "result"],
  },
  {
    id: "gm:note",
    name: "Note",
    category: "meta",
    icon: "()",
    logTemplate: "(note: {{text}})",
    placeholders: ["text"],
  },
  {
    id: "gm:scene",
    name: "Scene",
    category: "meta",
    icon: "S",
    logTemplate: "S{{number}} *{{context}}*",
    placeholders: ["number", "context"],
  },
];

export function getGMCards(): GMCard[] {
  return GM_CARD_DEFS;
}

export function buildGMStacks(): CardStack[] {
  const categories: GMCategory[] = ["narration", "oracle", "mechanics", "meta"];
  const stacks: CardStack[] = [];

  for (const category of categories) {
    const categoryCards = GM_CARD_DEFS.filter((c) => c.category === category);
    if (categoryCards.length === 0) continue;
    stacks.push({
      actor: GM_ACTOR,
      actorType: "gm",
      bucket: category,
      label: GM_CATEGORY_LABELS[category],
      cards: categoryCards.map((gm) => ({
        id: gm.id,
        name: gm.name,
        bucket: category as any,
        logTemplate: gm.logTemplate,
        text: gm.icon,
        source: "gm",
        actor: GM_ACTOR,
      })),
    });
  }

  return stacks;
}
