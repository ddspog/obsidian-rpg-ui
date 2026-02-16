/**
 * System features definition view
 * 
 * Handles `rpg system.features` blocks - displays features definition visually.
 */

import * as Tmpl from "lib/html-templates";
import { FeaturesDisplay } from "lib/components/system-definition/features-display";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";

export class SystemFeaturesDefinitionView extends BaseView {
  public codeblock = "system.features";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    try {
      const data = parseYaml(source);

      // Handle both direct array and wrapped array formats
      let features: Array<{ name: string; description?: string; level?: number; uses?: number | string }>;
      
      if (Array.isArray(data)) {
        features = data;
      } else if (data && typeof data === 'object' && 'features' in data) {
        features = (data as { features: Array<{ name: string; description?: string; level?: number; uses?: number | string }> }).features;
      } else {
        return "<div class='system-features-display'><p>Invalid features definition</p></div>";
      }

      if (!features || !Array.isArray(features) || features.length === 0) {
        return "<div class='system-features-display'><p>No features defined</p></div>";
      }

      return Tmpl.Render(FeaturesDisplay({ features }));
    } catch (error) {
      console.error("Error parsing features definition:", error);
      return "<div class='system-features-display'><p>Error parsing features definition</p></div>";
    }
  }
}
