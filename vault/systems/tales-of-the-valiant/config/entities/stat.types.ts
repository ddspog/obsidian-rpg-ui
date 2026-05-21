import type {
  AbilityScores,
  EntityDescriptor,
  ResolvedStatFeature,
  StatFeatureRef,
  StatVehicleData,
} from "rpg-ui-toolkit";

export type StatLookup = Record<string, never>;

export type StatBlocks = {
  vehicle: StatVehicleData;
};

export type StatExpressions = Record<string, never>;

export type StatEntity = EntityDescriptor<StatBlocks, StatLookup, StatExpressions>;

export type { AbilityScores, ResolvedStatFeature, StatFeatureRef, StatVehicleData };
