/**
 * Applying a creature template read from its note (monster-template.ts) to a
 * `stat.monster` block's data: the note is turned into a template block
 * (template-block.ts) and that is applied. Pure: no Obsidian and no I/O.
 */

import type { MonsterTemplate } from "./monster-template";
import {
  applyTemplateBlock,
  templateBlockOf,
  type ApplyTemplateOptions as BlockOptions,
  type ApplyTemplateResult,
} from "./template-block";

export {
  formatDefences,
  parseDefences,
  pbOfCr,
  withSpeeds,
  withTag,
  withType,
  type ApplyTemplateResult,
  type Defences,
} from "./template-block";

export interface ApplyTemplateOptions extends BlockOptions {
  /** The features note's link path, without `.md`. */
  featureNote: string;
}

export function applyTemplate(
  input: Record<string, unknown>,
  template: MonsterTemplate,
  options: ApplyTemplateOptions
): ApplyTemplateResult {
  return applyTemplateBlock(input, templateBlockOf(template, options.featureNote), options);
}
