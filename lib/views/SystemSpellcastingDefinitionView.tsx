/**
 * System spellcasting definition view
 *
 * Handles `rpg system.spellcasting` blocks - displays a summary banner
 * describing what the block is defining (lists, circles, schools, tags,
 * spell-elements, etc.), consistent with `rpg system.attributes` and
 * `rpg system.skills`.
 *
 * Supports blocks that define any combination of:
 * - lists   (spell source lists like Arcane, Divine, …)
 * - circles (cantrip, 1st Circle, … 9th Circle)
 * - schools (Abjuration, Conjuration, …)
 * - tags    (Ritual, …)
 * - spell-elements (Casting, Range, Area, Components, Duration)
 */

import { parse as parseYaml } from "yaml";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

/** Mapping from YAML key → human-readable label */
const SECTION_LABELS: Record<string, string> = {
  lists: "spell lists",
  circles: "spell circles",
  schools: "spell schools",
  tags: "spell tags",
  "spell-elements": "spell elements",
  providers: "spellcasting providers",
  collectors: "spellcasting collectors",
};

/** Extract a display-friendly summary of names from a data value. */
function summarizeValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    const names = value.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return (item as any).label || (item as any).name || (item as any).id || "";
      }
      return String(item);
    }).filter((n) => n.length > 0);

    return names.length > 0 ? names.join(", ") : null;
  }
  return null;
}

export class SystemSpellcastingDefinitionView extends BaseView {
  public codeblock = "system.spellcasting";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    try {
      if (!this.shouldShowSystemBlocks()) {
        el.appendChild(this.createSystemPlaceholder("system.spellcasting"));
        return;
      }

      const parsed = parseYaml(source);

      if (!parsed || typeof parsed !== "object") {
        el.createEl("div", {
          text: "Invalid spellcasting definition",
          cls: "system-error-message",
        });
        return;
      }

      const data = parsed as Record<string, unknown>;
      const keys = Object.keys(data);

      // Filter to known spellcasting keys that have displayable content
      const sections = keys
        .filter((key) => key in SECTION_LABELS)
        .map((key) => ({
          label: SECTION_LABELS[key],
          summary: summarizeValue(data[key]),
        }))
        .filter((s) => s.summary !== null);

      if (sections.length === 0) {
        el.createEl("div", {
          text: "No spellcasting properties defined",
          cls: "system-error-message",
        });
        return;
      }

      for (const section of sections) {
        const container = el.createDiv({ cls: "system-attributes-summary" });
        container.createSpan({ cls: "system-attributes-icon", text: "⚙" });
        container.createSpan({
          cls: "system-attributes-text",
          text: `Defining ${section.label}: ${section.summary}`,
        });
      }
    } catch (error: any) {
      console.error("Failed to render system.spellcasting:", error);
      el.createEl("div", {
        text: `Error rendering spellcasting: ${error.message}`,
        cls: "system-error-message",
      });
    }
  }
}
