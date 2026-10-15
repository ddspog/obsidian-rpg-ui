import type {
  AbilityScores,
  EntityDescriptor,
  FeatureEntry,
  SessionAction,
  ResolvedStatFeature,
  StatFeatureRef,
  StatCategoryData,
  StatGroupData,
  StatMonsterData,
  StatVehicleData,
} from "rpg-ui-toolkit";

export type StatLookup = {
  /** The basic actions any creature can take (Dash, Dodge, Opportunity Attack, …). */
  $defaultFeatures?: FeatureEntry[];
};

export type StatBlocks = {
  vehicle: StatVehicleData;
  monster: StatMonsterData;
  category: StatCategoryData;
};

export type StatExpressions = {
  /** A named roll term's value for this creature (`Initiative`, `DEX`); undefined when unknown. */
  Modifier: (name: string) => number | undefined;
  /** The basic actions it can take in a session, as cards. */
  SessionActions: () => SessionAction[];
  /** Its Armor Class (`ac: 14 (leather armor)` → 14). */
  ArmorClass: () => number | undefined;
  /** Its hit points (`hp: 26 (4d8 + 8)` → 26 of 26). */
  HitPoints: () => { current: number; max: number } | undefined;
  /** What defeating it is worth in XP — its `xp:`, or its CR on the table. */
  ExperiencePoints: () => number | undefined;
};

export type StatEntity = EntityDescriptor<StatBlocks, StatLookup, StatExpressions>;

export type {
  AbilityScores,
  ResolvedStatFeature,
  StatFeatureRef,
  StatCategoryData,
  StatGroupData,
  StatMonsterData,
  StatVehicleData,
};
