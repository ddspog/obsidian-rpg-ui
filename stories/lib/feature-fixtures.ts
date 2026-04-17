/**
 * feature-fixtures.ts
 *
 * Helpers for building the `header` and `features` block YAML fixtures
 * consumed by character.features.stories. The features block carries only
 * `choices` — class, level, lineage, heritage, and background all live in
 * the sibling `header` block.
 */

import { stringify as stringifyYaml } from "yaml";

export interface HeaderFixture {
  classes: { name: string; level: number; subclass?: string }[];
  lineage?: string;
  heritage?: string;
  background?: string;
  banner?: string;
  xp?: number;
  luck?: number;
}

/** Build a YAML string for the sibling `header` block. */
export function buildHeaderYaml(h: HeaderFixture): string {
  const obj: Record<string, unknown> = {
    banner: h.banner ?? "",
    classes: h.classes,
    xp: h.xp ?? 0,
    luck: h.luck ?? 0,
  };
  if (h.lineage) obj.lineage = { file: `[[${h.lineage}]]` };
  if (h.heritage) obj.heritage = { file: `[[${h.heritage}]]` };
  if (h.background) obj.background = { file: `[[${h.background}]]` };
  return stringifyYaml(obj);
}

/** Build a YAML string for the `features` block (choices only). */
export function buildFeaturesYaml(
  choices: Record<string, Record<string, string | string[]>> = {},
): string {
  return stringifyYaml({ choices });
}
