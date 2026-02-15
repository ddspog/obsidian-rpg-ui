/**
 * System expressions definition view
 * 
 * Handles `rpg system-expressions` blocks - these define expressions in external files referenced by system definitions.
 * These blocks don't render UI, they're parsed by the system parser.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class SystemExpressionsDefinitionView extends BaseView {
  public codeblock = "system-expressions";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Definition blocks don't render visible UI
    console.debug("DnD UI Toolkit: System expressions definition block detected (parsed by system loader)");
    return "";
  }
}
