import { CardStack } from "./card-types";
import type { GMFeature, GMStack } from "../features/types";
import { emitGMFeature, emitCard, cardPrimaryStack, gmPrimaryStack, gmStacks } from "../gm/emit";

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

/** Stack order + labels for authored `feature.gm` cards (one stack per aspect). */
const GM_STACK_ORDER: GMStack[] = ["oracle", "roll", "table", "generator", "event", "scene"];
const GM_STACK_LABELS: Record<GMStack, string> = {
  oracle: "Oracle",
  roll: "Roll",
  table: "Table",
  generator: "Generator",
  event: "Event",
  scene: "Scene",
};

/**
 * Build GM card stacks from authored `feature.gm` features (a linked GM Screen
 * file). A feature carrying `cards:` contributes one clickable card per declared
 * card (each emitting its composed `emits`); a feature without `cards:` is itself
 * one card from its aspects. Each card lands in the stack of its primary aspect;
 * stacks render in canonical aspect order.
 */
export function buildGMStacksFromFeatures(features: GMFeature[]): CardStack[] {
  interface Entry {
    name: string;
    stack: GMStack;
    logTemplate: string;
    text?: string;
    uses?: number;
    recovery?: string;
  }
  const byStack = new Map<GMStack, Entry[]>();
  const add = (e: Entry) => {
    const list = byStack.get(e.stack) ?? [];
    list.push(e);
    byStack.set(e.stack, list);
  };

  for (const feature of features) {
    if (feature.cards?.length) {
      for (const card of feature.cards) {
        const stack = cardPrimaryStack(card, feature.generators);
        if (!stack) continue; // no emittable piece
        add({
          name: card.name,
          stack,
          logTemplate: emitCard(card, feature.generators),
          text: card.text,
          uses: card.uses,
          recovery: card.recovery,
        });
      }
      continue; // a `cards:` feature is a container — its own aspects aren't a card
    }
    if (gmStacks(feature).length === 0) continue; // no emittable aspect
    add({
      name: feature.name,
      stack: gmPrimaryStack(feature)!,
      logTemplate: emitGMFeature(feature),
      text: feature.text,
      uses: feature.uses,
      recovery: feature.recovery,
    });
  }

  const stacks: CardStack[] = [];
  for (const stack of GM_STACK_ORDER) {
    const entries = byStack.get(stack);
    if (!entries || entries.length === 0) continue;
    stacks.push({
      actor: GM_ACTOR,
      actorType: "gm",
      bucket: stack,
      label: GM_STACK_LABELS[stack],
      cards: entries.map((e) => ({
        id: `gm:${stack}:${e.name}`,
        name: e.name,
        bucket: stack as any,
        logTemplate: e.logTemplate,
        text: e.text,
        source: "gm",
        actor: GM_ACTOR,
        maxUses: e.uses,
        recovery: e.recovery,
      })),
    });
  }

  return stacks;
}
