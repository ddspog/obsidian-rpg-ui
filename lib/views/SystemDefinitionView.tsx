/**
 * System definition view
 *
 * Handles `rpg system` blocks - displays a summary banner identical in style
 * to the `rpg system.attributes` banner.
 */

import { parse as parseYaml } from "yaml";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SystemDefinitionView extends BaseView {
  public codeblock = "system";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    try {
      if (!this.shouldShowSystemBlocks()) {
        el.appendChild(this.createSystemPlaceholder("system"));
        return;
      }

      const data = parseYaml(source) as {
        name?: string;
        attributes?: string | string[];
        skills?: string | string[];
        expressions?: string | string[];
        features?: string | string[];
        spellcasting?: string | string[];
        conditions?: string | string[];
      };

      if (!data) {
        el.createEl("div", { text: "Invalid system definition", cls: "system-error-message" });
        return;
      }

      const name = data.name || "RPG System";

      const parts: string[] = [];
      if (data.attributes) parts.push("attributes");
      if (data.skills) parts.push("skills");
      if (data.expressions) parts.push("expressions");
      if (data.features) parts.push("features");
      if (data.spellcasting) parts.push("spellcasting");
      if (data.conditions) parts.push("conditions");

      const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";

      const container = el.createDiv({ cls: "system-attributes-summary" });
      container.createSpan({ cls: "system-attributes-icon", text: "⚙" });
      container.createSpan({
        cls: "system-attributes-text",
        text: `Defining system: ${name}${detail}`,
      });
    } catch (error: any) {
      console.error("Error parsing system definition:", error);
      el.createEl("div", {
        text: `Error rendering system: ${error.message}`,
        cls: "system-error-message",
      });
    }
  }
}
