import { BaseView } from "./BaseView";
import { App, MarkdownPostProcessorContext } from "obsidian";
import * as HealthService from "lib/domains/healthpoints";
import { HealthCard } from "lib/components/health-card";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { KeyValueStore } from "lib/services/kv/kv";
import { HealthState } from "lib/domains/healthpoints";
import { ParsedHealthBlock } from "lib/types";
import { msgbus } from "lib/services/event-bus";
import { hasTemplateVariables, processTemplate, createTemplateContext } from "lib/utils/template";
import { useFileContext, FileContext } from "./filecontext";
import { shouldResetOnEvent } from "lib/domains/events";
import { ReactMarkdown } from "./ReactMarkdown";

export class HealthView extends BaseView {
  public codeblock = "healthpoints";

  private kv: KeyValueStore;

  constructor(app: App, kv: KeyValueStore) {
    super(app);
    this.kv = kv;
  }

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const healthMarkdown = new HealthMarkdown(el, source, this.kv, ctx.sourcePath, ctx, this);
    ctx.addChild(healthMarkdown);
  }
}

class HealthMarkdown extends ReactMarkdown {
  private source: string;
  private kv: KeyValueStore;
  private filePath: string;
  private fileContext: FileContext;
  private currentHealthBlock: ParsedHealthBlock | null = null;
  private originalHealthValue: number | string;

  constructor(
    el: HTMLElement,
    source: string,
    kv: KeyValueStore,
    filePath: string,
    ctx: MarkdownPostProcessorContext,
    baseView: BaseView
  ) {
    super(el);
    this.source = source;
    this.kv = kv;
    this.filePath = filePath;
    this.fileContext = useFileContext(baseView.app, ctx);
    this.originalHealthValue = HealthService.parseHealthBlock(this.source).health;
  }

  async onload() {
    // Set up frontmatter change listener using filecontext
    this.setupFrontmatterChangeListener();

    // Process and render initial state
    await this.processAndRender();
  }

  private async processAndRender() {
    let healthBlock = HealthService.parseHealthBlock(this.source);
    healthBlock = this.processTemplateInHealthBlock(healthBlock);
    this.currentHealthBlock = healthBlock;

    const stateKey = healthBlock.state_key;
    if (!stateKey) throw new Error("Health block must contain a 'state_key' property.");

    const defaultState = HealthService.getDefaultHealthState(healthBlock);
    try {
      const savedState = await this.kv.get<HealthState>(stateKey);
      let healthState = savedState || defaultState;

      if (savedState) {
        healthState = HealthService.migrateHealthState(savedState, healthBlock);
        if (healthState !== savedState) {
          await this.kv.set(stateKey, healthState).catch((e) => console.error("Error saving migrated health state:", e));
        }
      } else {
        await this.kv.set(stateKey, defaultState).catch((e) => console.error("Error saving initial health state:", e));
      }

      this.setupEventSubscription(healthBlock);
      this.renderComponent(healthBlock, healthState);
    } catch (error) {
      console.error("Error loading health state:", error);
      this.setupEventSubscription(healthBlock);
      this.renderComponent(healthBlock, defaultState);
    }
  }

  private processTemplateInHealthBlock(healthBlock: ParsedHealthBlock): ParsedHealthBlock {
    if (typeof healthBlock.health !== "string" || !hasTemplateVariables(healthBlock.health)) {
      return healthBlock;
    }
    const ctx = createTemplateContext(this.containerEl, this.fileContext);
    const processed = processTemplate(healthBlock.health, ctx);
    const healthValue = parseInt(processed, 10);
    if (!isNaN(healthValue)) return { ...healthBlock, health: healthValue };
    console.warn(`Template processed health value "${processed}" is not a valid number, using original value`);
    return healthBlock;
  }

  private setupFrontmatterChangeListener() {
    this.addUnloadFn(
      this.fileContext.onFrontmatterChange(() => {
        if (typeof this.originalHealthValue === "string" && hasTemplateVariables(this.originalHealthValue)) {
          this.handleFrontmatterChange();
        }
      })
    );
  }

  private setupEventSubscription(healthBlock: ParsedHealthBlock) {
    const resetOn = healthBlock.reset_on || [{ event: "long-rest" }];
    this.addUnloadFn(
      msgbus.subscribe(this.filePath, "reset", (resetEvent) => {
        if (shouldResetOnEvent(resetOn, resetEvent.eventType)) {
          this.handleResetEvent(healthBlock);
        }
      })
    );
  }

  private async handleFrontmatterChange() {
    if (!this.currentHealthBlock) return;
    try {
      const updatedHealthBlock = this.processTemplateInHealthBlock({
        ...this.currentHealthBlock,
        health: this.originalHealthValue,
      });

      const oldHealth = typeof this.currentHealthBlock.health === "number" ? this.currentHealthBlock.health : 6;
      const newHealth = typeof updatedHealthBlock.health === "number" ? updatedHealthBlock.health : 6;

      if (oldHealth !== newHealth) {
        this.currentHealthBlock = updatedHealthBlock;
        const stateKey = updatedHealthBlock.state_key;
        if (stateKey) {
          const currentState = await this.kv.get<HealthState>(stateKey).catch(() => null);
          if (currentState) this.renderComponent(updatedHealthBlock, currentState);
        }
      }
    } catch (error) {
      console.error("Error handling frontmatter change:", error);
    }
  }

  private renderComponent(healthBlock: ParsedHealthBlock, state: HealthState) {
    const stateKey = healthBlock.state_key;
    if (!stateKey) return;
    const data = {
      static: healthBlock,
      state,
      onStateChange: (newState: HealthState) => {
        this.handleStateChange(healthBlock, newState);
        this.renderComponent(healthBlock, newState);
      },
    };
    if (!this.reactRoot) this.reactRoot = ReactDOM.createRoot(this.containerEl);
    this.reactRoot.render(React.createElement(HealthCard, data));
  }

  private async handleStateChange(healthBlock: ParsedHealthBlock, newState: HealthState) {
    const stateKey = healthBlock.state_key;
    if (!stateKey) return;
    await this.kv.set(stateKey, newState).catch((e) => console.error(`Error saving health state for ${stateKey}:`, e));
  }

  private async handleResetEvent(healthBlock: ParsedHealthBlock) {
    const stateKey = healthBlock.state_key;
    if (!stateKey) return;
    try {
      const maxHealth = typeof healthBlock.health === "number" ? healthBlock.health : 6;
      const defaultState = HealthService.getDefaultHealthState(healthBlock);
      const resetState: HealthState = {
        current: maxHealth,
        temporary: 0,
        hitdiceUsed: defaultState.hitdiceUsed,
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
      };
      await this.kv.set(stateKey, resetState);
      this.renderComponent(healthBlock, resetState);
    } catch (error) {
      console.error(`Error resetting health state for ${stateKey}:`, error);
    }
  }
}
