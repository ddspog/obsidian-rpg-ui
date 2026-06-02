export interface StatVehicleData {
  name: string;
  size: string;
  type: string;
  dimensions?: string;
  stats: Record<string, string>;
  abilities: AbilityScores;
  features: StatFeatureRef[];
  text?: string;
  image?: string;
  view?: string;
}

export interface StatMonsterData {
  name: string;
  /** Full type line, e.g. `Large [[Beast]]` (may contain a wikilink). */
  type: string;
  /** Challenge-rating display value, e.g. `1` or `1/4`. */
  cr?: string;
  /** Habitat line, e.g. `[[Arctic]], [[Forest]]` (may contain wikilinks). */
  habitat?: string;
  /** Treasure line, e.g. `None` / `Individual`. */
  treasure?: string;
  /** Link to a `stat.group` note (e.g. `[[Bears]]`). When set, the monster
   *  inherits habitat/treasure from the group and renders neither. */
  group?: string;
  /** Display-ordered stat rows (Armor Class, Hit Points, Speed, …). */
  stats: Record<string, string>;
  /** Ability modifiers (str/dex/… as signed numbers). */
  abilities: AbilityScores;
  features: StatFeatureRef[];
  text?: string;
  /** Markdown image ref (`![[creature.webp|384]]`). */
  image?: string;
}

/** A monster group — shared habitat/treasure + flavor for several monsters. */
export interface StatGroupData {
  name: string;
  subtitle?: string;
  habitat?: string;
  treasure?: string;
  /** Descriptive prose (the group's contents), rendered below the
   *  habitat/treasure line. */
  text?: string;
}

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface StatFeatureRef {
  ref: string;
  [key: string]: unknown;
}

export interface ResolvedStatFeature {
  name?: string;
  type?: string;
  text: string;
}

export type StatFeatureCategory = "action" | "bonus" | "reaction" | "legendary";

export const STAT_SECTION_LABELS: Record<StatFeatureCategory, string> = {
  action: "ACTIONS",
  bonus: "BONUS ACTIONS",
  reaction: "REACTIONS",
  legendary: "LEGENDARY ACTIONS",
};

export const STAT_SECTION_ORDER: StatFeatureCategory[] = [
  "action",
  "bonus",
  "reaction",
  "legendary",
];
