/**
 * A tab's icon and colour from the words of its title. Rules of thumb; the
 * optional model step (llm.ts) may replace them.
 */

import type { TabLook } from "./types";

const ICONS: Array<[RegExp, string]> = [
  [/spell|magic|arcane|ritual|cantrip|sorcer|wizard|warlock/i, "sparkles"],
  [/class|fighter|barbarian|paladin|warrior|combat|battle|attack|weapon|martial/i, "swords"],
  [/armor|armour|shield|defen[cs]e/i, "shield"],
  [/equipment|gear|item|treasure|loot|inventory|pack/i, "backpack"],
  [/coin|currency|wealth|price|cost|trade|shop|selling|buy|service|expense/i, "coins"],
  [/lineage|heritage|ancestr|race|species|people|folk/i, "dna"],
  [/background|talent|feat|origin/i, "scroll"],
  [/monster|creature|beast|bestiary|animal|mount|companion/i, "paw-print"],
  [/god|pantheon|deit|faith|religio|cleric|divine|temple/i, "church"],
  [/condition|status|disease|poison|madness|curse/i, "activity"],
  [/rule|playing|how to play|mechanic|check|dice|roll|ability/i, "dices"],
  [/character|creation|level|advancement|step|hero/i, "user"],
  [/adventur|explor|travel|journey|wilderness|movement|vehicle/i, "compass"],
  [/world|setting|plane|realm|land|region|city|town|map|geograph/i, "map"],
  [/dungeon|ruin|trap|tomb|lair/i, "landmark"],
  [/npc|social|faction|guild|organi[sz]ation|downtime/i, "users"],
  [/death|dying|rest|healing|life|health|hit point/i, "heart-pulse"],
  [/time|calendar|season|weather/i, "clock"],
  [/tool|craft|kit|alchem|mechanist|artific/i, "hammer"],
  [/safety|intro|welcome|using this|what is|about|overview|basics/i, "book-open"],
  [/table|chart|list|index|appendix|reference|glossary/i, "table"],
  [/story|plot|quest|mission|campaign|scene|encounter/i, "feather"],
  [/language|name|rune|script/i, "languages"],
];

const COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"];

export function lookFor(title: string, index: number): TabLook {
  const icon = ICONS.find(([re]) => re.test(title))?.[1] ?? "bookmark";
  return { icon, color: `var(--color-${COLORS[index % COLORS.length]})` };
}

/** The icon names a model may pick from. */
export const ICON_NAMES = [
  ...new Set(ICONS.map(([, name]) => name)),
  "bookmark",
  "star",
  "flame",
  "skull",
  "crown",
  "gem",
  "leaf",
  "moon",
  "sun",
  "eye",
  "key",
  "anchor",
  "mountain",
  "tent",
  "wand-2",
  "flask-conical",
  "music",
  "footprints",
  "hand",
  "brain",
];
