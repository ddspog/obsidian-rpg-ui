import type {
  AbilityScores,
  EntityDescriptor,
  ResolvedStatFeature,
  StatFeatureRef,
  StatCategoryData,
  StatGroupData,
  StatMonsterData,
  StatVehicleData,
} from "rpg-ui-toolkit";

export type StatLookup = Record<string, never>;

export type StatBlocks = {
  vehicle: StatVehicleData;
  monster: StatMonsterData;
  category: StatCategoryData;
};

export type StatExpressions = Record<string, never>;

export type StatEntity = EntityDescriptor<StatBlocks, StatLookup, StatExpressions>;

export type { AbilityScores, ResolvedStatFeature, StatFeatureRef, StatCategoryData, StatGroupData, StatMonsterData, StatVehicleData };
