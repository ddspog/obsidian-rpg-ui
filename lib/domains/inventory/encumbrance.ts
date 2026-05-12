/**
 * Encumbrance bands for a given Strength score.
 *
 * D&D 5e base rules:
 *   - Carry capacity    = STR × 15
 *   - Push / drag / lift = STR × 30
 *
 * Variant "encumbrance" rule (the one the reference statblock screenshot uses):
 *   - Light encumbered  > STR × 5
 *   - Heavily encumbered > STR × 10
 *
 * We expose all four thresholds so the segmented bar can highlight bands.
 */

import type { EncumbranceOverrides } from "./schema";

export interface EncumbranceBands {
  encumbered: number;
  heavy: number;
  carry: number;
  push: number;
}

export type LoadState = "free" | "encumbered" | "heavy" | "over";

export function computeBands(strength: number, overrides?: EncumbranceOverrides): EncumbranceBands {
  const str = Number.isFinite(strength) && strength > 0 ? strength : 0;
  return {
    encumbered: overrides?.encumbered ?? str * 5,
    heavy: overrides?.heavy ?? str * 10,
    carry: overrides?.carry ?? str * 15,
    push: overrides?.push ?? str * 30,
  };
}

export function classifyLoad(total: number, bands: EncumbranceBands): LoadState {
  if (total > bands.carry) return "over";
  if (total > bands.heavy) return "heavy";
  if (total > bands.encumbered) return "encumbered";
  return "free";
}
