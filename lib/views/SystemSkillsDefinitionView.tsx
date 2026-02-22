/**
 * System skills definition view
 *
 * Handles `rpg system.skills` blocks - displays a summary banner identical to
 * the `rpg system.attributes` banner.
 *
 * Supports two block formats:
 *
 * **YAML format**
 * ```rpg system.skills
 * - name: Acrobatics
 *   attribute: dexterity
 * ```
 *
 * **Wikilink list format** – skill notes referenced by Obsidian wikilinks:
 * ```rpg system.skills
 * - [[Acrobatics]]
 * - [[Athletics]]
 * ```
 */

import { parse as parseYaml } from "yaml";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

/** Extract display names from a wikilink list format block. */
function extractWikilinkNames(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*-\s*\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/);
    if (match) {
      const filePath = match[1].trim();
      const displayName = match[2]?.trim() || (filePath.split("/").pop() ?? filePath);
      names.push(displayName);
    }
  }
  return names;
}

export class SystemSkillsDefinitionView extends BaseView {
  public codeblock = "system.skills";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    try {
      if (!this.shouldShowSystemBlocks()) {
        el.appendChild(this.createSystemPlaceholder("system.skills"));
        return;
      }

      // ── Wikilink list format ──────────────────────────────────────────────
      const hasWikilinks = source.split("\n").some((line) => /^\s*-\s*\[\[/.test(line));
      if (hasWikilinks) {
        const names = extractWikilinkNames(source);
        if (names.length === 0) {
          el.createEl("div", { text: "No skills defined", cls: "system-error-message" });
          return;
        }
        const summary = names.map((n) => n[0].toUpperCase() + n.slice(1)).join(", ");
        const container = el.createDiv({ cls: "system-attributes-summary" });
        container.createSpan({ cls: "system-attributes-icon", text: "⚙" });
        container.createSpan({
          cls: "system-attributes-text",
          text: `Defining system skills: ${summary}`,
        });
        return;
      }

      // ── YAML format ───────────────────────────────────────────────────────
      const parsed = parseYaml(source);

      // Support direct array or wrapped {skills: [...]} format
      const rawSkills: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.skills)
          ? parsed.skills
          : [];

      if (rawSkills.length === 0) {
        el.createEl("div", { text: "No skills defined", cls: "system-error-message" });
        return;
      }

      const summary = rawSkills
        .map((s) => s.name || s.label || "")
        .filter((n) => n.length > 0)
        .map((n) => n[0].toUpperCase() + n.slice(1))
        .join(", ");

      const container = el.createDiv({ cls: "system-attributes-summary" });
      container.createSpan({ cls: "system-attributes-icon", text: "⚙" });
      container.createSpan({
        cls: "system-attributes-text",
        text: `Defining system skills: ${summary}`,
      });
    } catch (error: any) {
      console.error("Failed to render system.skills:", error);
      el.createEl("div", {
        text: `Error rendering skills: ${error.message}`,
        cls: "system-error-message",
      });
    }
  }
}
