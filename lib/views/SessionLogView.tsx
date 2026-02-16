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

  private async appendToLogBody(newText: string) {
    try {
      const file = this.baseView.app.vault.getAbstractFileByPath(this.filePath);
      if (!file || !(file instanceof (this.baseView.app.vault.getAbstractFileByPath(this.filePath)?.constructor))) {
        console.error("File not found:", this.filePath);
        return;
      }

      // Read current file content
      const content = await this.baseView.app.vault.read(file as any);
      
      // Find the rpg log code block
      const codeBlockRegex = /(```rpg log\n[\s\S]*?---\n)([\s\S]*?)(```)/;
      const match = content.match(codeBlockRegex);
      
      if (!match) {
        console.error("Could not find rpg log code block in file");
        return;
      }

      // Extract parts: header (with YAML), body, closing backticks
      const [fullMatch, header, body, closing] = match;
      
      // Append new text to the body
      const updatedBody = body + newText;
      
      // Reconstruct the code block
      const updatedBlock = `${header}${updatedBody}${closing}`;
      
      // Replace the old block with the updated one
      const updatedContent = content.replace(codeBlockRegex, updatedBlock);
      
      // Write back to file
      await this.baseView.app.vault.modify(file as any, updatedContent);
      
      console.log("Successfully appended text to log");
    } catch (error) {
      console.error("Error appending to log:", error);
    }
  }

  private renderSessionLog() {
    if (!this.logData) {
      this.containerEl.innerHTML =
        '<div class="notice">No log data available</div>';
      return;
    }

    const root = ReactDOM.createRoot(this.containerEl);

    const handleAppendText = async (text: string) => {
      await this.appendToLogBody(text);
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
