/**
 * System spellcasting definition view
 * 
 * Handles `rpg system-spellcasting` blocks - these define spellcasting system configuration but don't render UI.
 * Used when spellcasting is defined in external files referenced by the main system definition.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SystemSpellcastingDefinitionView extends BaseView {
  public codeblock = "system-spellcasting";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Definition blocks don't render visible UI
    // They are parsed when referenced by a system definition
    console.debug("DnD UI Toolkit: System spellcasting definition block detected (referenced by system definition)");
    return "";
  }
}
