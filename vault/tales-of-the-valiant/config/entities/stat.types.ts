import type {
  AbilityScores,
  EntityDescriptor,
  ResolvedStatFeature,
  StatFeatureRef,
  StatGroupData,
  StatMonsterData,
  StatVehicleData,
} from "rpg-ui-toolkit";

export type StatLookup = Record<string, never>;

export type StatBlocks = {
  vehicle: StatVehicleData;
  monster: StatMonsterData;
  group: StatGroupData;
};

export type StatExpressions = Record<string, never>;

export type StatEntity = EntityDescriptor<StatBlocks, StatLookup, StatExpressions>;

export type { AbilityScores, ResolvedStatFeature, StatFeatureRef, StatGroupData, StatMonsterData, StatVehicleData };
