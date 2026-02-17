import { parse as parseYaml } from "yaml";
import { MarkdownPostProcessorContext } from "obsidian";
import { BaseView } from "./BaseView";

interface AttributeDefinition {
  name: string;
  subtitle?: string;
  alias?: string;
  description?: string;
  [key: string]: unknown;
}

export class SystemAttributesDefinitionView extends BaseView {
  public codeblock = "system.attributes";

  render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    try {
      if (!this.shouldShowSystemBlocks()) {
        el.appendChild(this.createSystemPlaceholder("system.attributes"));
        return;
      }
      const parsed = parseYaml(source);
      
      // Handle both direct array format and wrapped format
      const attributes: AttributeDefinition[] = Array.isArray(parsed) 
        ? parsed 
        : parsed.attributes || [];

      if (!attributes || attributes.length === 0) {
        el.createEl("div", {
          text: "No attributes defined",
          cls: "system-error-message",
        });
        return;
      }

      const summary = attributes
        .map((attr) => (typeof attr === "string" ? attr : attr.name))
        .filter((name) => !!name)
        .map((name) => String(name).trim())
        .filter((name) => name.length > 0)
        .map((name) => name[0].toUpperCase() + name.slice(1))
        .join(", ");

      const container = el.createDiv({ cls: "system-attributes-summary" });
      container.createSpan({ cls: "system-attributes-icon", text: "⚙" });
      container.createSpan({
        cls: "system-attributes-text",
        text: `Defining system attributes: ${summary}`,
      });
    } catch (error) {
      console.error("Failed to render system.attributes:", error);
      el.createEl("div", {
        text: `Error rendering attributes: ${error.message}`,
        cls: "system-error-message",
      });
    }
  }
}
