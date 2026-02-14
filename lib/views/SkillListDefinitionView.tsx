/**
 * Skill list definition view
 * 
 * Handles `rpg skill-list` blocks - these define skills but don't render UI.
 * Phase 2: Just a placeholder that acknowledges the block exists.
 * Phase 3: Will parse the skill list and add it to the system.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SkillListDefinitionView extends BaseView {
  public codeblock = "skill-list";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Phase 2: Definition blocks don't render visible UI
    // Phase 3: Will parse and register the skill list
    console.debug("DnD UI Toolkit: Skill list definition block detected (not yet parsed in Phase 2)");
    return "";
  }
}
