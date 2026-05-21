export interface StatVehicleData {
  name: string;
  size: string;
  type: string;
  dimensions?: string;
  stats: Record<string, string>;
  abilities: AbilityScores;
  features: StatFeatureRef[];
  text?: string;
  view?: string;
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
