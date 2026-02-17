/**
 * System spellcasting definition view
 * 
 * Handles `rpg system.spellcasting` blocks - displays spellcasting definition visually.
 */

import * as Tmpl from "lib/html-templates";
import { SpellcastingDisplay } from "lib/components/system-definition/spellcasting-display";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";

export class SystemSpellcastingDefinitionView extends BaseView {
  public codeblock = "system.spellcasting";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    try {
      if (!this.shouldShowSystemBlocks()) {
        const placeholder = this.createSystemPlaceholder("system.spellcasting");
        return placeholder.outerHTML;
      }
      const data = parseYaml(source) as {
        ability?: string;
        spells_known?: number | string;
        cantrips_known?: number | string;
        spell_slots?: Record<string, number>;
      };

      if (!data || typeof data !== 'object') {
        return "<div class='system-spellcasting-display'><p>Invalid spellcasting definition</p></div>";
      }

      return Tmpl.Render(SpellcastingDisplay({ data }));
    } catch (error) {
      console.error("Error parsing spellcasting definition:", error);
      return "<div class='system-spellcasting-display'><p>Error parsing spellcasting definition</p></div>";
    }
  }
}
