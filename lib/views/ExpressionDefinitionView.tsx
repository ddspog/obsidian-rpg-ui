/**
 * Expression definition view
 * 
 * Handles `rpg expression` blocks - these define formulas but don't render UI.
 * Phase 2: Just a placeholder that acknowledges the block exists.
 * Phase 3: Will parse the expression and add it to the system.
 */

import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";

export class ExpressionDefinitionView extends BaseView {
  public codeblock = "expression";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    // Phase 2: Definition blocks don't render visible UI
    // Phase 3: Will parse and register the expression
    console.debug("DnD UI Toolkit: Expression definition block detected (not yet parsed in Phase 2)");
    return "";
  }
}
