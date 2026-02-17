/**
 * System definition view
 * 
 * Handles `rpg system` blocks - displays system configuration visually.
 */

import * as Tmpl from "lib/html-templates";
import { SystemInfo } from "lib/components/system-definition/system-info";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";

export class SystemDefinitionView extends BaseView {
  public codeblock = "system";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    try {
      if (!this.shouldShowSystemBlocks()) {
        const placeholder = this.createSystemPlaceholder("system");
        return placeholder.outerHTML;
      }
      const data = parseYaml(source) as {
        name?: string;
        attributes?: string[];
        skills?: string | string[];
        expressions?: string | string[];
        features?: string | string[];
        spellcasting?: string | string[];
      };

      if (!data) {
        return "<div class='system-info-container'><p>Invalid system definition</p></div>";
      }

      return Tmpl.Render(SystemInfo({
        name: data.name || "RPG System",
        attributes: data.attributes || [],
        skillsSource: data.skills,
        expressionsSource: data.expressions,
        featuresSource: data.features,
        spellcastingSource: data.spellcasting,
      }));
    } catch (error) {
      console.error("Error parsing system definition:", error);
      return "<div class='system-info-container'><p>Error parsing system definition</p></div>";
    }
  }
}
