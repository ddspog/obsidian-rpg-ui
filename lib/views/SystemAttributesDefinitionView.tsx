import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { parse as parseYaml } from "yaml";
import { AttributesDisplay } from "../components/system-definition/attributes-display";
import BaseView from "./BaseView";

interface AttributeDefinition {
  name: string;
  subtitle?: string;
  alias?: string;
  description?: string;
}

export default class SystemAttributesDefinitionView extends BaseView {
  private roots: Map<HTMLElement, Root> = new Map();

  registerView(): void {
    this.plugin.registerMarkdownCodeBlockProcessor(
      "rpg system.attributes",
      (source, el, ctx) => {
        this.render(source, el, ctx);
      }
    );
  }

  render(source: string, el: HTMLElement, ctx: any): void {
    try {
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

      const container = el.createDiv({ cls: "system-attributes-view" });
      const root = createRoot(container);
      this.roots.set(container, root);

      root.render(
        <AttributesDisplay 
          attributes={attributes}
          vault={this.plugin.app.vault}
        />
      );
    } catch (error) {
      console.error("Failed to render system.attributes:", error);
      el.createEl("div", {
        text: `Error rendering attributes: ${error.message}`,
        cls: "system-error-message",
      });
    }
  }

  cleanup(): void {
    this.roots.forEach((root) => {
      try {
        root.unmount();
      } catch (e) {
        console.warn("Error unmounting attribute view:", e);
      }
    });
    this.roots.clear();
  }
}
