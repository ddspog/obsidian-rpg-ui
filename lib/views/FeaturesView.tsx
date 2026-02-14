/**
 * Features view
 * 
 * Renders the features block.
 * Phase 2: Basic read-only rendering with requirement checking.
 */

import * as Tmpl from "lib/html-templates";
import { Features } from "lib/components/features";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import * as FeaturesService from "lib/domains/features";
import * as AbilityService from "lib/domains/abilities";
import { useFileContext } from "./filecontext";

export class FeaturesView extends BaseView {
  public codeblock = "features";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    const system = this.getSystem(ctx);
    const featuresBlock = FeaturesService.parseFeaturesBlock(source);

    const fc = useFileContext(this.app, ctx);
    const frontmatter = fc.frontmatter();
    const level = frontmatter.level || 1;

    // Get ability scores for attribute requirements
    let attributes: Record<string, number> = {};
    try {
      const abilityBlock = AbilityService.parseAbilityBlockFromDocument(el, ctx);
      attributes = {
        strength: AbilityService.getTotalScore(abilityBlock.abilities.strength, "strength", abilityBlock.bonuses),
        dexterity: AbilityService.getTotalScore(abilityBlock.abilities.dexterity, "dexterity", abilityBlock.bonuses),
        constitution: AbilityService.getTotalScore(
          abilityBlock.abilities.constitution,
          "constitution",
          abilityBlock.bonuses
        ),
        intelligence: AbilityService.getTotalScore(
          abilityBlock.abilities.intelligence,
          "intelligence",
          abilityBlock.bonuses
        ),
        wisdom: AbilityService.getTotalScore(abilityBlock.abilities.wisdom, "wisdom", abilityBlock.bonuses),
        charisma: AbilityService.getTotalScore(abilityBlock.abilities.charisma, "charisma", abilityBlock.bonuses),
      };
    } catch {
      console.debug("DnD UI Toolkit: No ability block found for features view, using defaults");
      attributes = {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      };
    }

    // Get list of available features for prerequisite checking
    const availableFeatures = FeaturesService.getAvailableFeatures(featuresBlock.categories, {
      level,
      attributes,
    });

    const availableFeatureNames = availableFeatures.map((f) => f.name);

    return Tmpl.Render(
      Features({
        data: featuresBlock,
        level,
        attributes,
        availableFeatures: availableFeatureNames,
        system,
      })
    );
  }
}
