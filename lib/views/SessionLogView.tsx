/**
 * Session Log View
 * Renders Lonelog session logs with interactive HUD and delta tracking
 */

import { BaseView } from "./BaseView";
import { App, MarkdownPostProcessorContext } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { KeyValueStore } from "lib/services/kv/kv";
import { ReactMarkdown } from "./ReactMarkdown";
import { parseSessionLogBlock, processSessionLog } from "lib/domains/session-log";
import type { SessionLogData } from "lib/domains/session-log";
import { EntityResolver } from "lib/services/entity-resolver";
import type { EntityData } from "lib/services/entity-resolver";
import { EventList } from "lib/components/session-log/event-list";
import { HUD } from "lib/components/session-log/hud";
import { ChangeOverview } from "lib/components/session-log/change-overview";

export class SessionLogView extends BaseView {
  public codeblock = "log";

  private kv: KeyValueStore;
  private entityResolver: EntityResolver;

  constructor(app: App, kv: KeyValueStore) {
    super(app);
    this.kv = kv;
    this.entityResolver = new EntityResolver(app);
  }

  public render(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): void {
    const sessionLogMarkdown = new SessionLogMarkdown(
      el,
      source,
      this.kv,
      this.entityResolver,
      ctx.sourcePath,
      ctx,
      this,
    );
    ctx.addChild(sessionLogMarkdown);
  }
}

class SessionLogMarkdown extends ReactMarkdown {
  private source: string;
  private kv: KeyValueStore;
  private entityResolver: EntityResolver;
  private filePath: string;
  private ctx: MarkdownPostProcessorContext;
  private baseView: BaseView;
  private logData: SessionLogData | null = null;
  private entities: EntityData[] = [];

  constructor(
    el: HTMLElement,
    source: string,
    kv: KeyValueStore,
    entityResolver: EntityResolver,
    filePath: string,
    ctx: MarkdownPostProcessorContext,
    baseView: BaseView,
  ) {
    super(el);
    this.source = source;
    this.kv = kv;
    this.entityResolver = entityResolver;
    this.filePath = filePath;
    this.ctx = ctx;
    this.baseView = baseView;
  }

  async onload() {
    await this.processAndRender();
  }

  private async processAndRender() {
    try {
      // Parse the session log block
      const block = parseSessionLogBlock(this.source);

      // Process Lonelog to extract entries and deltas
      this.logData = processSessionLog(block);

      // Resolve entity references if provided
      if (block.entities && block.entities.length > 0) {
        this.entities = await this.entityResolver.resolveEntities(
          block.entities,
        );
      }

      // Render the session log
      this.renderSessionLog();
    } catch (error) {
      console.error("Error processing session log:", error);
      this.containerEl.innerHTML = `<div class="notice notice-error">Error processing session log: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
  }

  private renderSessionLog() {
    if (!this.logData) {
      this.containerEl.innerHTML =
        '<div class="notice">No log data available</div>';
      return;
    }

    const root = ReactDOM.createRoot(this.containerEl);

    const handleAppendText = (text: string) => {
      console.log("Append text requested:", text);
      // TODO: Implement append-only text updates to the markdown file
      // This would use app.vault.process() to append to the Lonelog body
    };

    root.render(
      <div className="session-log-container">
        {this.entities.length > 0 && (
          <HUD entities={this.entities} onAppendText={handleAppendText} />
        )}

        <EventList entries={this.logData.entries} />

        <ChangeOverview
          entityDeltas={this.logData.entityDeltas}
          progressChanges={this.logData.progressChanges}
          threadChanges={this.logData.threadChanges}
        />
      </div>,
    );
  }
}
