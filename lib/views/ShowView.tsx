import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext, parseYaml, MarkdownRenderer, Component } from "obsidian";
import { buildInlineCards, buildInlineTable, DataRecord } from "lib/utils/inline-rendering";
import { resolveData, resolveSystemData } from "./show-data-resolver";
import { buildEntries } from "./show-entries-builder";

interface ShowBlockConfig {
  cards?: {
    data: string;
    properties: string[];
  };
  table?: {
    data: string;
    columns: Array<{
      header: string;
      property: string;
    }>;
  };
  entries?: {
    data: string;
    properties: string[];
    /** Heading level (1–6) to use when rendering the entry name. Defaults to 5. */
    level?: number;
  };
}

export class ShowView extends BaseView {
  public codeblock = "show";

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    try {
      const config = parseYaml(source) as ShowBlockConfig;
      const container = document.createElement("div");
      container.setAttribute("data-rpg-show-block", "true");

      if (config.cards) {
        this.renderCards(config.cards, container, ctx);
      } else if (config.table) {
        this.renderTable(config.table, container, ctx);
      } else if (config.entries) {
        this.renderEntries(config.entries, container, ctx);
      } else {
        container.innerHTML =
          '<div class="notice"><p>rpg show block needs either "cards", "table", or "entries" configuration</p></div>';
      }

      el.replaceWith(container);
    } catch (err) {
      console.error("DnD UI Toolkit: Error rendering show block:", err);
      el.innerHTML = `<div class="notice" style="color: red;">Error rendering show block: ${err}</div>`;
    }
  }

  private renderCards(
    config: ShowBlockConfig["cards"],
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    if (!config || !config.data || !config.properties) {
      el.innerHTML = "<div class=\"notice\">Invalid cards configuration. Need 'data' and 'properties'</div>";
      return;
    }
    el.innerHTML = '<div class="notice">Loading...</div>';
    resolveData(this.app, config.data, ctx)
      .then((data) => {
        if (!data) { el.innerHTML = `<div class="notice">Data '${config.data}' not found</div>`; return; }
        const component = new Component();
        const cardsEl = buildInlineCards(data, config.properties, ctx.sourcePath, (text, element, path) => {
          MarkdownRenderer.renderMarkdown(text, element, path, component);
        });
        el.replaceChildren(cardsEl);
      })
      .catch((err) => { el.innerHTML = `<div class="notice">Error loading data: ${err}</div>`; });
  }

  private renderTable(
    config: ShowBlockConfig["table"],
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    if (!config || !config.data || !config.columns) {
      el.innerHTML = "<div class=\"notice\">Invalid table configuration. Need 'data' and 'columns'</div>";
      return;
    }
    el.innerHTML = '<div class="notice">Loading...</div>';
    resolveData(this.app, config.data, ctx)
      .then((data) => {
        if (!data) { el.innerHTML = `<div class="notice">Data '${config.data}' not found</div>`; return; }
        el.replaceChildren(buildInlineTable(data, config.columns));
      })
      .catch((err) => { el.innerHTML = `<div class="notice">Error loading data: ${err}</div>`; });
  }

  private renderEntries(
    config: ShowBlockConfig["entries"],
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    if (!config || !config.data || !Array.isArray(config.properties)) {
      el.innerHTML = "<div class=\"notice\">Invalid entries configuration. Need 'data' and 'properties' array</div>";
      return;
    }
    el.innerHTML = '<div class="notice">Loading...</div>';
    resolveSystemData(this.app, config.data, ctx)
      .then((data) => {
        if (!data) { el.innerHTML = `<div class="notice">Data '${config.data}' not found</div>`; return; }
        const component = new Component();
        const renderMd = (text: string, element: HTMLElement) => {
          MarkdownRenderer.renderMarkdown(text, element, ctx.sourcePath, component);
        };
        el.replaceChildren(buildEntries(data, config, renderMd));
      })
      .catch((err) => { el.innerHTML = `<div class="notice">Error loading data: ${err}</div>`; });
  }
}
