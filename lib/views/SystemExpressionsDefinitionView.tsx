/**
 * System expressions definition view
 * 
 * Handles `rpg system.expressions` blocks - displays expressions definition visually.
 * Supports both YAML-based Handlebars expressions and JavaScript function definitions.
 */

import * as Tmpl from "lib/html-templates";
import { ExpressionsDisplay } from "lib/components/system-definition/expressions-display";
import { FunctionExpressionsDisplay } from "lib/components/system-definition/function-expressions-display";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";
import { isFunctionExpressionBlock, parseFunctionBlock } from "lib/systems/parser/function-expressions";

export class SystemExpressionsDefinitionView extends BaseView {
  public codeblock = "system.expressions";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    try {
      if (!this.shouldShowSystemBlocks()) {
        const placeholder = this.createSystemPlaceholder("system.expressions");
        return placeholder.outerHTML;
      }

      // Check if this is a JS function expression block
      if (isFunctionExpressionBlock(source)) {
        const functions = parseFunctionBlock(source);
        if (functions.length === 0) {
          return "<div class='system-expressions-display'><p>No function expressions defined</p></div>";
        }
        return Tmpl.Render(FunctionExpressionsDisplay({ functions }));
      }

      // Original YAML-based expression display
      const data = parseYaml(source);

      // Handle both direct array and wrapped array formats
      let expressions: Array<{ id: string; params?: string[]; formula: string }>;
      
      if (Array.isArray(data)) {
        expressions = data;
      } else if (data && typeof data === 'object' && 'expressions' in data) {
        expressions = (data as { expressions: Array<{ id: string; params?: string[]; formula: string }> }).expressions;
      } else {
        return "<div class='system-expressions-display'><p>Invalid expressions definition</p></div>";
      }

      if (!expressions || !Array.isArray(expressions) || expressions.length === 0) {
        return "<div class='system-expressions-display'><p>No expressions defined</p></div>";
      }

      return Tmpl.Render(ExpressionsDisplay({ expressions }));
    } catch (error) {
      console.error("Error parsing expressions definition:", error);
      return "<div class='system-expressions-display'><p>Error parsing expressions definition</p></div>";
    }
  }
}
