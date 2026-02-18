import { BaseView } from "./BaseView";
import { MarkdownPostProcessorContext, parseYaml, MarkdownRenderer, TFile, Component } from "obsidian";
import { buildInlineCards, buildInlineTable, DataRecord } from "lib/utils/inline-rendering";
import { SystemRegistry } from "lib/systems/registry";
import { RPGSystem } from "lib/systems/types";

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

    // Start async resolution
    this.resolveData(config.data, ctx)
      .then((data) => {
        if (!data) {
          el.innerHTML = `<div class="notice">Data '${config.data}' not found</div>`;
          return;
        }

        const component = new Component();
        const cardsEl = buildInlineCards(data, config.properties, ctx.sourcePath, (text, element, path) => {
          MarkdownRenderer.renderMarkdown(text, element, path, component);
        });

        el.replaceChildren(cardsEl);
      })
      .catch((err) => {
        console.error("Error resolving data for cards:", err);
        el.innerHTML = `<div class="notice">Error loading data: ${err}</div>`;
      });

    // Show loading state initially
    el.innerHTML = '<div class="notice">Loading...</div>';
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

    // Start async resolution
    this.resolveData(config.data, ctx)
      .then((data) => {
        if (!data) {
          el.innerHTML = `<div class="notice">Data '${config.data}' not found</div>`;
          return;
        }

        const tableEl = buildInlineTable(data, config.columns);
        el.replaceChildren(tableEl);
      })
      .catch((err) => {
        console.error("Error resolving data for table:", err);
        el.innerHTML = `<div class="notice">Error loading data: ${err}</div>`;
      });

    // Show loading state initially
    el.innerHTML = '<div class="notice">Loading...</div>';
  }

  private renderEntries(
    config: ShowBlockConfig["entries"],
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    if (!config || !config.data || !config.properties || !Array.isArray(config.properties)) {
      el.innerHTML = "<div class=\"notice\">Invalid entries configuration. Need 'data' and 'properties' array</div>";
      return;
    }

    // Start async resolution
    this.resolveSystemData(config.data, ctx)
      .then((data) => {
        if (!data) {
          el.innerHTML = `<div class="notice">Data '${config.data}' not found</div>`;
          return;
        }

        const entriesEl = this.buildEntries(data, config);
        el.replaceChildren(entriesEl);
      })
      .catch((err) => {
        console.error("Error resolving data for entries:", err);
        el.innerHTML = `<div class="notice">Error loading data: ${err}</div>`;
      });

    // Show loading state initially
    el.innerHTML = '<div class="notice">Loading...</div>';
  }

  private buildEntries(entries: any[], config: ShowBlockConfig["entries"]): HTMLElement {
    const container = document.createElement("div");
    container.className = "rpg-entries";

    const properties = config?.properties || ["name", "subtitle", "description"];

    for (const entry of entries) {
      const entryDiv = document.createElement("div");
      entryDiv.className = "rpg-entry";

      // Build the title row: bold main name + italic subtitle
      const titleDiv = document.createElement("div");
      titleDiv.className = "rpg-entry-title";

      // First property is the main label (bold)
      if (properties.length > 0) {
        const mainProp = properties[0];
        const label = entry[mainProp] || entry.label || entry.name || String(entry);
        const strong = document.createElement("strong");
        strong.textContent = String(label);
        titleDiv.appendChild(strong);
      }

      // Second property is the subtitle (italic)
      if (properties.length > 1) {
        const subtitleProp = properties[1];
        const subtitle = entry[subtitleProp];
        if (subtitle) {
          const em = document.createElement("em");
          em.textContent = String(subtitle);
          titleDiv.appendChild(em);
        }
      }

      entryDiv.appendChild(titleDiv);

      // Remaining properties are displayed as descriptions
      if (properties.length > 2) {
        const descDiv = document.createElement("div");
        descDiv.className = "rpg-entry-description";

        for (let i = 2; i < properties.length; i++) {
          const prop = properties[i];
          const value = entry[prop];

          if (value) {
            if (i > 2) {
              descDiv.appendChild(document.createElement("br"));
            }

            // Preserve line breaks for multi-line descriptions
            const lines = String(value).split("\n");
            for (let j = 0; j < lines.length; j++) {
              if (j > 0) {
                descDiv.appendChild(document.createElement("br"));
              }
              descDiv.appendChild(document.createTextNode(lines[j]));
            }
          }
        }

        if (descDiv.children.length > 0 || descDiv.textContent) {
          entryDiv.appendChild(descDiv);
        }
      }

      container.appendChild(entryDiv);
    }

    return container;
  }

  private async resolveSystemData(dataPath: string, ctx: MarkdownPostProcessorContext): Promise<any[] | null> {
    const system = SystemRegistry.getInstance().getSystemForFile(ctx.sourcePath);
    const parts = dataPath.split(".");
    const rootKey = parts[0];

    // Handle system data references
    if (rootKey === "skills") {
      if (parts.length === 1) {
        // Return all skills
        return system.skills;
      } else if (parts.length === 2) {
        // Return single skill by name
        const skillName = parts[1].toLowerCase();
        const skill = system.skills.find((s) => s.label.toLowerCase() === skillName);
        return skill ? [skill] : null;
      }
    }

    if (rootKey === "attributes") {
      if (parts.length === 1) {
        // Return all attribute definitions
        return system.attributeDefinitions || [];
      } else if (parts.length === 2) {
        // Return single attribute by name
        const attrName = parts[1].toLowerCase();
        const attr = system.attributeDefinitions?.find((a) => a.name.toLowerCase() === attrName);
        return attr ? [attr] : null;
      }
    }

    return null;
  }

  private async resolveData(dataName: string, ctx: MarkdownPostProcessorContext): Promise<DataRecord[] | null> {
    // Try to resolve from system registry
    const system = SystemRegistry.getInstance().getSystemForFile(ctx.sourcePath);
    if (system && dataName === "attributes" && system.attributeDefinitions) {
      return system.attributeDefinitions as DataRecord[];
    }

    // Try to find in current file's system blocks
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (file instanceof TFile) {
      const content = await this.app.vault.cachedRead(file);
      const blockPattern = new RegExp(`\`\`\`rpg system\\.${dataName}\\b[\\s\\S]*?\`\`\``, "g");
      const matches = content.match(blockPattern);

      if (matches) {
        for (const match of matches) {
          const blockContent = match.replace(/```rpg system\.\w+\n?/, "").replace(/```$/, "");
          try {
            const parsed = parseYaml(blockContent);
            if (Array.isArray(parsed)) {
              return parsed as DataRecord[];
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }
    }

    return null;
  }
}
