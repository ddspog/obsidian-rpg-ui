/**
 * Inventory view
 * 
 * Renders the inventory block.
 * Phase 2: Basic read-only rendering.
 */

import * as Tmpl from "lib/html-templates";
import { Inventory } from "lib/components/inventory";
import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext } from "obsidian";
import * as InventoryService from "lib/domains/inventory";
import { useFileContext } from "./filecontext";
import { createTemplateContext, hasTemplateVariables, processTemplate } from "lib/utils/template";

export class InventoryView extends BaseView {
  public codeblock = "inventory";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
    const inventoryBlock = InventoryService.parseInventoryBlock(source);
    const totalWeight = InventoryService.calculateTotalWeight(inventoryBlock.sections || []);

    // Calculate capacity from template if provided
    let capacity: number | undefined;
    if (inventoryBlock.encumbrance?.capacity) {
      const fc = useFileContext(this.app, ctx);
      try {
        if (hasTemplateVariables(inventoryBlock.encumbrance.capacity)) {
          const templateContext = createTemplateContext(el, fc);
          const result = processTemplate(inventoryBlock.encumbrance.capacity, templateContext);
          const numericResult = Number(result);
          if (!Number.isNaN(numericResult)) {
            capacity = numericResult;
          }
        } else {
          const numericResult = Number(inventoryBlock.encumbrance.capacity);
          if (!Number.isNaN(numericResult)) {
            capacity = numericResult;
          }
        }
      } catch (e) {
        console.error("DnD UI Toolkit: Error evaluating encumbrance capacity:", e);
      }
    }

    return Tmpl.Render(
      Inventory({
        data: inventoryBlock,
        totalWeight,
        capacity,
      })
    );
  }
}
