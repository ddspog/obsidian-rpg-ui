import * as Tmpl from "lib/html-templates";
import { type SkillItem, SkillGrid } from "lib/components/skill-cards";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import * as AbilityService from "lib/domains/abilities";
import * as SkillsService from "lib/domains/skills";
import { AbilityBlock, AbilityScores } from "lib/types";
import { useFileContext } from "./filecontext";

export class SkillsView extends BaseView {
  public codeblock = "skills";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    const system = this.getSystem(ctx);
    
    let abilityBlock: AbilityBlock;

    try {
      abilityBlock = AbilityService.parseAbilityBlockFromDocument(el, ctx);
    } catch {
      console.debug("No ability block found for skills view, using default values");
      // Use default ability scores if no ability block is found
      abilityBlock = {
        abilities: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        bonuses: [],
        proficiencies: [],
      };
    }
    const skillsBlock = SkillsService.parseSkillsBlock(source);

    const data: SkillItem[] = [];

    const fc = useFileContext(this.app, ctx);
    const frontmatter = fc.frontmatter();

    // Use system's skill list instead of hardcoded Skills
    for (const skill of system.skills) {
      const skillLabel = (skill.name ?? (skill as any).label ?? "").toString();

      const isHalfProficient =
        skillsBlock.half_proficiencies.find((x) => {
          return x.toLowerCase() === skillLabel.toLowerCase();
        }) !== undefined;

      const isProficient =
        skillsBlock.proficiencies.find((x) => {
          return x.toLowerCase() === skillLabel.toLowerCase();
        }) !== undefined;

      const isExpert =
        skillsBlock.expertise.find((x) => {
          return x.toLowerCase() === skillLabel.toLowerCase();
        }) !== undefined;

      const skillAbility = abilityBlock.abilities[skill.attribute as keyof AbilityBlock["abilities"]];
      if (!skillAbility) {
        throw new Error(`Skill ${skill.attribute} not found in abilities`);
      }

      const totalAbilityScore = AbilityService.getTotalScore(
        skillAbility,
        skill.attribute as keyof AbilityScores,
        abilityBlock.bonuses
      );

      let skillCheckValue = AbilityService.calculateModifier(totalAbilityScore, system);
      if (isExpert) {
        skillCheckValue += frontmatter.proficiency_bonus * 2;
      } else if (isProficient) {
        skillCheckValue += frontmatter.proficiency_bonus;
      } else if (isHalfProficient) {
        skillCheckValue += Math.floor(frontmatter.proficiency_bonus / 2);
      }

      for (const bonus of skillsBlock.bonuses) {
        if ((bonus.target ?? "").toLowerCase() === skillLabel.toLowerCase()) {
          skillCheckValue += bonus.value;
        }
      }

      const abbreviation = (skill.attribute ?? "").substring(0, 3).toUpperCase();

      data.push({
        label: skillLabel,
        ability: abbreviation,
        modifier: skillCheckValue,
        isProficient: isProficient,
        isExpert: isExpert,
        isHalfProficient: isHalfProficient,
      });
    }

    return Tmpl.Render(SkillGrid({ items: data }));
  }
}
