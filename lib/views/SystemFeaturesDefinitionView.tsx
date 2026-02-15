/**
 * System features definition view
 * 
 * Handles `rpg system.features` blocks - these define feature system configuration but don't render UI.
 * Used when features are defined in external files referenced by the main system definition.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SystemFeaturesDefinitionView extends BaseView {
  public codeblock = "system.features";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Definition blocks don't render visible UI
    // They are parsed when referenced by a system definition
    console.debug("DnD UI Toolkit: System features definition block detected (referenced by system definition)");
    return "";
  }
}
