import { BaseView } from "./BaseView";
import { App, MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import * as ConsumableService from "lib/domains/consumables";
import { ConsumableCheckboxes } from "lib/components/consumable-checkboxes";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { KeyValueStore } from "lib/services/kv/kv";
import { ConsumableState } from "lib/domains/consumables";
import { msgbus } from "lib/services/event-bus";
import { shouldResetOnEvent, getResetAmount } from "lib/domains/events";
import { ParsedConsumableBlock } from "lib/types";

export class ConsumableView extends BaseView {
  public codeblock = "consumable";

  private kv: KeyValueStore;

  constructor(app: App, kv: KeyValueStore) {
    super(app);
    this.kv = kv;
  }

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const consumableMarkdown = new ConsumableMarkdown(el, source, this.kv, ctx.sourcePath);
    ctx.addChild(consumableMarkdown);
  }
}

class ConsumableMarkdown extends MarkdownRenderChild {
  private reactRoots: Map<string, ReactDOM.Root> = new Map();
  private source: string;
  private kv: KeyValueStore;
  private filePath: string;
  private consumablesContainer: HTMLElement;
  private eventUnsubscribers: (() => void)[] = [];

  constructor(el: HTMLElement, source: string, kv: KeyValueStore, filePath: string) {
    super(el);
    this.source = source;
    this.kv = kv;
    this.filePath = filePath;
    this.consumablesContainer = document.createElement("div");
    this.consumablesContainer.className = "consumables-column";
    el.appendChild(this.consumablesContainer);
  }

  async onload() {
    const consumablesBlock = ConsumableService.parseConsumablesBlock(this.source);

    let maxLabelLength = 0;
    consumablesBlock.items.forEach((item) => {
      if (item.label && item.label.length > maxLabelLength) maxLabelLength = item.label.length;
    });
    this.consumablesContainer.style.setProperty("--consumable-label-width", `${Math.max(3, maxLabelLength * 0.55)}em`);

    await Promise.all(
      consumablesBlock.items.map(async (consumableBlock, index) => {
        const stateKey = consumableBlock.state_key;
        if (!stateKey) throw new Error(`Consumable item at index ${index} must contain a 'state_key' property.`);

        const itemContainer = document.createElement("div");
        itemContainer.className = "consumable-item";
        itemContainer.setAttribute("data-state-key", stateKey);
        this.consumablesContainer.appendChild(itemContainer);

        const defaultState = ConsumableService.getDefaultConsumableState(consumableBlock);
        let consumableState = defaultState;
        try {
          const savedState = await this.kv.get<ConsumableState>(stateKey);
          consumableState = savedState || defaultState;
          if (!savedState) await this.kv.set(stateKey, defaultState).catch((e) => console.error(`Error saving initial consumable state for ${stateKey}:`, e));
        } catch (error) {
          console.error(`Error loading consumable state for ${stateKey}:`, error);
        }

        if (consumableBlock.reset_on) {
          this.eventUnsubscribers.push(
            msgbus.subscribe(this.filePath, "reset", (resetEvent) => {
              if (shouldResetOnEvent(consumableBlock.reset_on, resetEvent.eventType)) {
                const resetAmount = getResetAmount(consumableBlock.reset_on, resetEvent.eventType) || resetEvent.amount;
                this.handleResetEvent(consumableBlock, resetAmount);
              }
            })
          );
        }
        this.renderComponent(itemContainer, consumableBlock, consumableState);
      })
    );
  }

  private renderComponent(container: HTMLElement, consumableBlock: ParsedConsumableBlock, state: ConsumableState) {
    const stateKey = consumableBlock.state_key || "";
    const data = {
      static: consumableBlock,
      state,
      onStateChange: (newState: ConsumableState) => {
        this.handleStateChange(consumableBlock, newState);
        this.renderComponent(container, consumableBlock, newState);
      },
    };
    const root = this.reactRoots.get(stateKey) ?? ReactDOM.createRoot(container);
    if (!this.reactRoots.has(stateKey)) this.reactRoots.set(stateKey, root);
    root.render(React.createElement(ConsumableCheckboxes, data));
  }

  private async handleStateChange(consumableBlock: ParsedConsumableBlock, newState: ConsumableState) {
    const stateKey = consumableBlock.state_key;
    if (!stateKey) return;
    await this.kv.set(stateKey, newState).catch((e) => console.error(`Error saving consumable state for ${stateKey}:`, e));
  }

  private async handleResetEvent(consumableBlock: ParsedConsumableBlock, amount?: number) {
    const stateKey = consumableBlock.state_key;
    if (!stateKey) return;
    try {
      const currentState = await this.kv.get<ConsumableState>(stateKey);
      const currentValue = currentState?.value || 0;
      const resetState: ConsumableState = { value: amount !== undefined ? Math.max(0, currentValue - amount) : 0 };
      await this.kv.set(stateKey, resetState);
      const container = this.consumablesContainer.querySelector(`[data-state-key="${stateKey}"]`) as HTMLElement;
      if (container) this.renderComponent(container, consumableBlock, resetState);
    } catch (error) {
      console.error(`Error resetting consumable state for ${stateKey}:`, error);
    }
  }

  onunload() {
    this.reactRoots.forEach((root) => {
      try { root.unmount(); } catch (e) { console.error("Error unmounting React component:", e); }
    });
    this.reactRoots.clear();
    this.eventUnsubscribers.forEach((unsub) => {
      try { unsub(); } catch (e) { console.error("Error unsubscribing from event:", e); }
    });
    this.eventUnsubscribers.length = 0;
  }
}
