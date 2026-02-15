/**
 * System skills definition view
 * 
 * Handles `rpg system.skills` blocks - these define skills in external files referenced by system definitions.
 * These blocks don't render UI, they're parsed by the system parser.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SystemSkillsDefinitionView extends BaseView {
  public codeblock = "system.skills";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Definition blocks don't render visible UI
    console.debug("DnD UI Toolkit: System skills definition block detected (parsed by system loader)");
    return "";
  }
}
