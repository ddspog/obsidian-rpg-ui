/**
 * Session Log View
 * Renders Lonelog session logs with interactive action cards and delta tracking
 */

import { BaseView } from "./BaseView";
import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { KeyValueStore } from "lib/services/kv/kv";
import { ReactMarkdown } from "./ReactMarkdown";
import { parseSessionLogBlock, processSessionLog } from "lib/domains/session-log";
import type { SessionLogData } from "lib/domains/session-log";
import { EntityResolver } from "lib/services/entity-resolver";
import type { EntityData } from "lib/services/entity-resolver";
import { EventList } from "lib/components/session-log/event-list";
import { ChangeOverview } from "lib/components/session-log/change-overview";
import { BottomDrawer } from "lib/components/session-log/bottom-drawer";
import { SessionActionsPanel } from "lib/components/session-log/session-actions-panel";
import { extractCardsFromEntity, getEntitySpentState } from "lib/services/session-feature-loader";
import { buildGMStacks } from "lib/domains/session-log/gm-cards";
import { buildCardStacks } from "lib/domains/session-log/extract-cards";
import type { CardStack, SessionFeatureCard } from "lib/domains/session-log/card-types";
import { initSessionConsumables, spendUse } from "lib/domains/session-log/consumable-state";
import type { SessionConsumableState } from "lib/domains/session-log/consumable-state";

export class SessionLogView extends BaseView {
  public codeblock = "log";

  private kv: KeyValueStore;
  private entityResolver: EntityResolver;

  constructor(app: App, kv: KeyValueStore) {
    super(app);
    this.kv = kv;
    this.entityResolver = new EntityResolver(app);
  }

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const sessionLogMarkdown = new SessionLogMarkdown(
      el,
      source,
      this.kv,
      this.entityResolver,
      ctx.sourcePath,
      ctx,
      this
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
    baseView: BaseView
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
      const block = parseSessionLogBlock(this.source);
      this.logData = processSessionLog(block);

      if (block.entities && block.entities.length > 0) {
        this.entities = await this.entityResolver.resolveEntities(block.entities);
      }

      this.renderSessionLog();
    } catch (error) {
      console.error("Error processing session log:", error);
      this.containerEl.innerHTML = `<div class="notice notice-error">Error processing session log: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
  }

  private async appendToLogBody(newText: string) {
    try {
      const file = this.baseView.app.vault.getAbstractFileByPath(this.filePath);
      if (!file || !(file instanceof TFile)) {
        console.error("File not found:", this.filePath);
        return;
      }

      const content = await this.baseView.app.vault.read(file);
      const codeBlockRegex = /(```rpg log\n[\s\S]*?---\n)([\s\S]*?)(```)/;
      const match = content.match(codeBlockRegex);

      if (!match) {
        console.error("Could not find rpg log code block in file");
        return;
      }

      const [, header, body, closing] = match;
      const updatedBody = body + newText;
      const updatedBlock = `${header}${updatedBody}${closing}`;
      const updatedContent = content.replace(codeBlockRegex, updatedBlock);

      await this.baseView.app.vault.modify(file as any, updatedContent);
    } catch (error) {
      console.error("Error appending to log:", error);
    }
  }

  private buildActionCards(): {
    pcStacks: Map<string, CardStack[]>;
    gmStacks: CardStack[];
    allCards: SessionFeatureCard[];
    sheetSpent: Record<string, number>;
  } {
    const pcStacks = new Map<string, CardStack[]>();
    let allCards: SessionFeatureCard[] = [];
    let sheetSpent: Record<string, number> = {};

    for (const entity of this.entities) {
      const cards = extractCardsFromEntity(entity);
      if (cards.length > 0) {
        const stacks = buildCardStacks(cards, entity.name);
        pcStacks.set(entity.name, stacks);
        allCards = allCards.concat(cards);
        const entitySpent = getEntitySpentState(entity);
        sheetSpent = { ...sheetSpent, ...entitySpent };
      }
    }

    const gmStacks = buildGMStacks();
    return { pcStacks, gmStacks, allCards, sheetSpent };
  }

  private renderSessionLog() {
    if (!this.logData) {
      this.containerEl.innerHTML = '<div class="notice">No log data available</div>';
      return;
    }

    const root = ReactDOM.createRoot(this.containerEl);
    const { pcStacks, gmStacks, allCards, sheetSpent } = this.buildActionCards();
    const entityNames = this.entities.map((e) => e.name);
    const initialConsumableState = initSessionConsumables(allCards, sheetSpent);

    const handleAppendText = async (text: string) => {
      await this.appendToLogBody(text);
    };

    root.render(
      <SessionLogRoot
        logData={this.logData}
        pcStacks={pcStacks}
        gmStacks={gmStacks}
        entityNames={entityNames}
        initialConsumableState={initialConsumableState}
        onAppendText={handleAppendText}
      />
    );
  }
}

interface SessionLogRootProps {
  logData: SessionLogData;
  pcStacks: Map<string, CardStack[]>;
  gmStacks: CardStack[];
  entityNames: string[];
  initialConsumableState: SessionConsumableState;
  onAppendText: (text: string) => void;
}

function SessionLogRoot({
  logData,
  pcStacks,
  gmStacks,
  entityNames,
  initialConsumableState,
  onAppendText,
}: SessionLogRootProps) {
  const [consumableState, setConsumableState] = React.useState(initialConsumableState);

  const handleSpend = (cardId: string) => {
    setConsumableState((s) => spendUse(s, cardId));
  };

  const hasActions = pcStacks.size > 0 || gmStacks.length > 0;

  return (
    <div className="session-log-container">
      <EventList entries={logData.entries} />

      {hasActions ? (
        <BottomDrawer
          actionsPanel={
            <SessionActionsPanel
              pcStacks={pcStacks}
              gmStacks={gmStacks}
              consumableState={consumableState}
              entities={entityNames}
              onAppendText={onAppendText}
              onSpend={handleSpend}
            />
          }
          changesPanel={
            <ChangeOverview
              entityDeltas={logData.entityDeltas}
              progressChanges={logData.progressChanges}
              threadChanges={logData.threadChanges}
            />
          }
        />
      ) : (
        <ChangeOverview
          entityDeltas={logData.entityDeltas}
          progressChanges={logData.progressChanges}
          threadChanges={logData.threadChanges}
        />
      )}
    </div>
  );
}
