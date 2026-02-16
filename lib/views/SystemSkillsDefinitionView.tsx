/**
 * System skills definition view
 * 
 * Handles `rpg system.skills` blocks - displays skills definition visually.
 */

import * as Tmpl from "lib/html-templates";
import { SkillsDisplay } from "lib/components/system-definition/skills-display";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";

export class SystemSkillsDefinitionView extends BaseView {
  public codeblock = "system.skills";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    try {
      const data = parseYaml(source);

      // Handle both direct array and wrapped array formats
      let skills: Array<{ label: string; attribute: string }>;
      
      if (Array.isArray(data)) {
        skills = data;
      } else if (data && typeof data === 'object' && 'skills' in data) {
        skills = (data as { skills: Array<{ label: string; attribute: string }> }).skills;
      } else {
        return "<div class='system-skills-display'><p>Invalid skills definition</p></div>";
      }

      if (!skills || !Array.isArray(skills) || skills.length === 0) {
        return "<div class='system-skills-display'><p>No skills defined</p></div>";
      }

      return Tmpl.Render(SkillsDisplay({ skills }));
    } catch (error) {
      console.error("Error parsing skills definition:", error);
      return "<div class='system-skills-display'><p>Error parsing skills definition</p></div>";
    }
  }
}
