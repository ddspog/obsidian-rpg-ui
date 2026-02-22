/**
 * System conditions definition view
 *
 * Handles `rpg system.conditions` blocks - displays conditions definition visually.
 */

import * as Tmpl from "lib/html-templates";
import { ConditionsDisplay } from "lib/components/system-definition/conditions-display";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";

export class SystemConditionsDefinitionView extends BaseView {
  public codeblock = "system.conditions";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    try {
      if (!this.shouldShowSystemBlocks()) {
        const placeholder = this.createSystemPlaceholder("system.conditions");
        return placeholder.outerHTML;
      }
      const data = parseYaml(source);

      // Handle both direct array and wrapped array formats
      let conditions: Array<{ name: string; icon?: string; description?: string }>;

      if (Array.isArray(data)) {
        conditions = data;
      } else if (data && typeof data === "object" && "conditions" in data) {
        conditions = (
          data as {
            conditions: Array<{ name: string; icon?: string; description?: string }>;
          }
        ).conditions;
      } else {
        return "<div class='system-conditions-display'><p>Invalid conditions definition</p></div>";
      }

      if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
        return "<div class='system-conditions-display'><p>No conditions defined</p></div>";
      }

      return Tmpl.Render(ConditionsDisplay({ conditions }));
    } catch (error) {
      console.error("Error parsing conditions definition:", error);
      return "<div class='system-conditions-display'><p>Error parsing conditions definition</p></div>";
    }
  }
}
