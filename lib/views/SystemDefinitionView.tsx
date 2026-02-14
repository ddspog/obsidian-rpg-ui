/**
 * System definition view
 * 
 * Handles `rpg system` blocks - these define system rules but don't render UI.
 * Phase 2: Just a placeholder that acknowledges the block exists.
 * Phase 3: Will parse the system definition and register it.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SystemDefinitionView extends BaseView {
  public codeblock = "system";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Phase 2: Definition blocks don't render visible UI
    // Phase 3: Will parse and register the system
    console.debug("DnD UI Toolkit: System definition block detected (not yet parsed in Phase 2)");
    return "";
  }
}
