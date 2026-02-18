import { App, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext, MarkdownRenderer, parseYaml, TFile, MarkdownView } from "obsidian";
import { AbilityScoreView } from "lib/views/AbilityScoreView";
import { BaseView } from "lib/views/BaseView";
import { SkillsView } from "lib/views/SkillsView";
import { HealthView } from "lib/views/HealthView";
import { ConsumableView } from "lib/views/ConsumableView";
import { BadgesView, StatsView } from "lib/views/BadgesView";
import { InitiativeView } from "lib/views/InitiativeView";
import { SpellComponentsView } from "lib/views/SpellComponentsView";
import { EventButtonsView } from "lib/views/EventButtonsView";
import { SystemDefinitionView } from "lib/views/SystemDefinitionView";
import { ExpressionDefinitionView } from "lib/views/ExpressionDefinitionView";
import { SkillListDefinitionView } from "lib/views/SkillListDefinitionView";
import { SystemExpressionsDefinitionView } from "lib/views/SystemExpressionsDefinitionView";
import { SystemSkillsDefinitionView } from "lib/views/SystemSkillsDefinitionView";
import { SystemFeaturesDefinitionView } from "lib/views/SystemFeaturesDefinitionView";
import { SystemSpellcastingDefinitionView } from "lib/views/SystemSpellcastingDefinitionView";
import { SystemAttributesDefinitionView } from "lib/views/SystemAttributesDefinitionView";
import { InventoryView } from "lib/views/InventoryView";
import { FeaturesView } from "lib/views/FeaturesView";
import { SessionLogView } from "lib/views/SessionLogView";
import { ShowView } from "lib/views/ShowView";
import { KeyValueStore } from "lib/services/kv/kv";
import { JsonDataStore } from "./lib/services/kv/local-file-store";
import { DEFAULT_SETTINGS, DndUIToolkitSettings } from "settings";
import { THEMES } from "lib/themes";
import { msgbus } from "lib/services/event-bus";
import * as Fm from "lib/domains/frontmatter";
import { extractMeta } from "lib/utils/meta-extractor";
import { SystemRegistry } from "lib/systems/registry";
import { FileSuggest } from "lib/utils/file-suggest";
import { FolderSuggest } from "lib/utils/folder-suggest";
import { settingsStore } from "lib/services/settings-store";
import { RPGSystem } from "lib/systems/types";
import { extractCodeBlocks } from "lib/utils/codeblock-extractor";
import { buildInlineCards, buildInlineTable, DataRecord, getValue, formatValue, formatFieldLabel } from "lib/utils/inline-rendering";

export default class DndUIToolkitPlugin extends Plugin {
  settings: DndUIToolkitSettings;
  dataStore: JsonDataStore;

  applyColorSettings(): void {
    const apply = (root: HTMLElement) => {
      Object.entries(this.settings).forEach(([key, value]) => {
        if (key.startsWith("color")) {
          const cssVarName = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
          root.style.setProperty(cssVarName, value as string);
        }
      });
    };

    // Apply to main document
    const root = document.documentElement;
    if (root) {
      apply(root);
    }

    // Apply to all open windows
    this.app.workspace.iterateAllLeaves((leaf) => {
      const windowDoc = leaf.view.containerEl.ownerDocument;
      if (windowDoc) {
        apply(windowDoc.documentElement);
      }
    });
  }

  async onload() {
    await this.loadSettings();
    settingsStore.setSettings(this.settings);

    // Apply color settings on load
    this.applyColorSettings();

    // Listen for new windows and apply settings to them
    this.registerEvent(
      this.app.workspace.on("window-open", () => {
        // Use setTimeout to ensure the window is fully initialized
        setTimeout(() => this.applyColorSettings(), 100);
      })
    );

    // Initialize the JsonDataStore with the configured path
    this.initDataStore();

    // Initialize system registry with vault access and folder mappings
    const registry = SystemRegistry.getInstance();
    registry.initialize(this.app.vault);
    
    // Load system mappings from settings
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFilePath);
      }
    }
    registry.setFolderMappings(mappings);

    // Setup Listener for frontmatter changes
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const filefm = this.app.metadataCache.getCache(file.path)?.frontmatter;
        const fm = Fm.anyIntoFrontMatter(filefm || {});

        msgbus.publish(file.path, "fm:changed", fm);
      })
    );

    const kv = new KeyValueStore(this.dataStore);
    const { app } = this;

    // Create view registry with meta-based keys
    const views: BaseView[] = [
      // Static
      new StatsView(app),
      new AbilityScoreView(app),
      new SkillsView(app),
      new BadgesView(app),
      new SpellComponentsView(app),
      new EventButtonsView(app),

      // Dynamic/Stateful
      new HealthView(app, kv),
      new ConsumableView(app, kv),
      new InitiativeView(app, kv),
      new SessionLogView(app, kv),

      // New blocks
      new InventoryView(app),
      new FeaturesView(app),
      new ShowView(app),

      // Definition blocks (parse-only, no UI)
      new SystemDefinitionView(app),
      new ExpressionDefinitionView(app),
      new SkillListDefinitionView(app),
      new SystemExpressionsDefinitionView(app),
      new SystemSkillsDefinitionView(app),
      new SystemAttributesDefinitionView(app),
      new SystemFeaturesDefinitionView(app),
      new SystemSpellcastingDefinitionView(app),
    ];

    // Build a map of meta -> view for dispatch
    const viewRegistry = new Map<string, BaseView>();
    for (const view of views) {
      viewRegistry.set(view.codeblock, view);
    }

    // Register single "rpg" code block processor with meta dispatch
    this.registerMarkdownCodeBlockProcessor("rpg", (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      // Extract meta from the fence line
      const meta = extractMeta(ctx, el);

      if (!meta) {
        console.error("DnD UI Toolkit: Failed to extract meta from rpg block");
        el.innerHTML = '<div class="notice">Error: rpg block missing meta type (e.g., rpg attributes)</div>';
        return;
      }
      const view = viewRegistry.get(meta);

      if (view) {
        view.register(source, el, ctx);
      } else {
        console.error(`DnD UI Toolkit: Unknown rpg block type: ${meta}`);
        el.innerHTML = `<div class="notice">Unknown rpg block type: ${meta}</div>`;
      }
    });

    // Keep backward compatibility: register old block types that redirect to views
    const legacyMappings: { [key: string]: string } = {
      ability: "attributes",
      skills: "skills",
      healthpoints: "healthpoints",
      stats: "stats",
      badges: "badges",
      consumable: "consumable",
      initiative: "initiative",
      "spell-components": "spell",
      "event-btns": "events",
    };

    for (const [oldType, meta] of Object.entries(legacyMappings)) {
      this.registerMarkdownCodeBlockProcessor(oldType, (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const view = viewRegistry.get(meta);
        if (view) {
          view.register(source, el, ctx);
        }
      });
    }

    this.registerInlineDataRenderers();

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new DndSettingsTab(this.app, this));
  }

  /**
   * Initialize or reinitialize the data store with the current path setting
   */
  initDataStore() {
    // Initialize with the vault adapter and the configured path
    this.dataStore = new JsonDataStore(this.app.vault, this.settings.statePath);
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.systemMappings = this.normalizeSystemMappings(this.settings.systemMappings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    settingsStore.setSettings(this.settings);
    // Reinitialize data store with the new path
    this.initDataStore();
    
    // Update system registry with new mappings
    const registry = SystemRegistry.getInstance();
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFilePath);
      }
    }
    registry.setFolderMappings(mappings);
  }

  private normalizeSystemMappings(rawMappings: unknown): DndUIToolkitSettings["systemMappings"] {
    if (!Array.isArray(rawMappings)) {
      return [];
    }

    return rawMappings.map((mapping) => {
      const typed = mapping as { folderPath?: string; folderPaths?: string[]; systemFilePath?: string };
      const folderPaths = Array.isArray(typed.folderPaths)
        ? typed.folderPaths
        : typed.folderPath !== undefined
          ? [typed.folderPath]
          : [];

      return {
        folderPaths: folderPaths.filter((path) => path !== undefined) as string[],
        systemFilePath: typed.systemFilePath ?? "",
      };
    });
  }

  private registerInlineDataRenderers(): void {
    // Inline rendering has been replaced with rpg show code blocks for better Live Preview support
    // See ShowView.tsx for the new implementation
  }

  // Disabled - using enhanced post-processor instead
  // All inline rendering methods have been replaced with the ShowView code block handler
  // See lib/views/ShowView.tsx for the new implementation
}

class DndSettingsTab extends PluginSettingTab {
  plugin: DndUIToolkitPlugin;

  constructor(app: App, plugin: DndUIToolkitPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "DnD UI Toolkit Settings" });

    // State File Path Setting
    new Setting(containerEl)
      .setName("State File Path")
      .setDesc(
        "Relative path (from vault root) where the state file will be stored. The statefile contains all the stateful data for components that are interactive and need to be saved. This is a JSON file."
      )
      .addText((text) =>
        text
          .setPlaceholder(".dnd-ui-toolkit-state.json")
          .setValue(this.plugin.settings.statePath)
          .onChange(async (value) => {
            this.plugin.settings.statePath = value;
            await this.plugin.saveSettings();
          })
      );

    // Systems section
    containerEl.createEl("h3", { text: "Systems" });
    containerEl.createEl("p", {
      text: "Map folders to RPG system definition files. Files in these folders will use the specified system rules.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Show system definition blocks")
      .setDesc("Show visual rendering for system definition blocks (system, system.skills, system.expressions, etc.).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSystemBlocks)
          .onChange(async (value) => {
            this.plugin.settings.showSystemBlocks = value;
            await this.plugin.saveSettings();
          })
      );

    // Display current mappings
    const mappingsContainer = containerEl.createDiv({ cls: "rpg-systems-mappings" });
    this.renderSystemMappings(mappingsContainer);

    // Add new mapping button
    new Setting(containerEl)
      .setName("Add System Mapping")
      .setDesc("Add a folder-to-system mapping")
      .addButton((button) =>
        button.setButtonText("Add").onClick(() => {
          this.plugin.settings.systemMappings.push({
            folderPaths: [],
            systemFilePath: "",
          });
          this.display(); // Refresh to show new mapping
        })
      );

    containerEl.createEl("h3", { text: "Styles" });

    // Theme selector
    new Setting(containerEl)
      .setName("Theme Preset")
      .setDesc("Choose a predefined color theme. Selecting a theme will update all color values.")
      .addDropdown((dropdown) => {
        Object.entries(THEMES).forEach(([key, theme]) => {
          dropdown.addOption(key, theme.name);
        });
        dropdown.setValue(this.plugin.settings.selectedTheme).onChange(async (value) => {
          this.plugin.settings.selectedTheme = value;
          const theme = THEMES[value];
          if (theme) {
            Object.assign(this.plugin.settings, theme.colors);
            await this.plugin.saveSettings();
            this.plugin.applyColorSettings();
            this.display(); // Refresh the settings display
          }
        });
      });

    // Add color inputs for each color variable
    this.addColorSetting(containerEl, "Background Primary", "colorBgPrimary");
    this.addColorSetting(containerEl, "Background Secondary", "colorBgSecondary");
    this.addColorSetting(containerEl, "Background Tertiary", "colorBgTertiary");
    this.addColorSetting(containerEl, "Background Hover", "colorBgHover");
    this.addColorSetting(containerEl, "Background Darker", "colorBgDarker");
    this.addColorSetting(containerEl, "Background Group", "colorBgGroup");
    this.addColorSetting(containerEl, "Background Proficient", "colorBgProficient");

    this.addColorSetting(containerEl, "Text Primary", "colorTextPrimary");
    this.addColorSetting(containerEl, "Text Secondary", "colorTextSecondary");
    this.addColorSetting(containerEl, "Text Sublabel", "colorTextSublabel");
    this.addColorSetting(containerEl, "Text Bright", "colorTextBright");
    this.addColorSetting(containerEl, "Text Muted", "colorTextMuted");
    this.addColorSetting(containerEl, "Text Group", "colorTextGroup");

    this.addColorSetting(containerEl, "Border Primary", "colorBorderPrimary");
    this.addColorSetting(containerEl, "Border Active", "colorBorderActive");
    this.addColorSetting(containerEl, "Border Focus", "colorBorderFocus");

    this.addColorSetting(containerEl, "Accent Teal", "colorAccentTeal");
    this.addColorSetting(containerEl, "Accent Red", "colorAccentRed");
    this.addColorSetting(containerEl, "Accent Purple", "colorAccentPurple");

    new Setting(containerEl).setName("Reset Styles").addButton((b) => {
      b.setButtonText("Reset").onClick(async () => {
        this.plugin.settings.selectedTheme = "default";
        const defaultTheme = THEMES.default;
        Object.assign(this.plugin.settings, defaultTheme.colors);
        await this.plugin.saveSettings();
        this.plugin.applyColorSettings();
        this.display();
      });
    });
  }

  private renderSystemMappings(containerEl: HTMLElement): void {
    containerEl.empty();

    if (this.plugin.settings.systemMappings.length === 0) {
      containerEl.createEl("p", {
        text: "No system mappings configured. Using D&D 5e as default for all files.",
        cls: "setting-item-description",
      });
      return;
    }

    const fileSuggests: FileSuggest[] = [];
    const folderSuggests: FolderSuggest[] = [];

    for (let i = 0; i < this.plugin.settings.systemMappings.length; i++) {
      const mapping = this.plugin.settings.systemMappings[i];
      
      const mappingSetting = new Setting(containerEl)
        .setName(`Mapping ${i + 1}`);

      const folderContainer = mappingSetting.controlEl.createDiv({ cls: "rpg-folder-mapping" });
      const folderList = folderContainer.createDiv({ cls: "rpg-folder-list" });

      const renderFolderList = () => {
        folderList.empty();
        const paths = mapping.folderPaths.length > 0 ? mapping.folderPaths : [];
        paths.forEach((path) => {
          const chip = folderList.createDiv({ cls: "rpg-folder-chip" });
          const label = path === "" ? "(root)" : path;
          chip.createSpan({ text: label, cls: "rpg-folder-chip-label" });
          const removeButton = chip.createEl("button", { text: "x", cls: "rpg-folder-chip-remove" });
          removeButton.addEventListener("click", async () => {
            mapping.folderPaths = mapping.folderPaths.filter((entry) => entry !== path);
            await this.saveAndUpdateRegistry();
            renderFolderList();
          });
        });
      };

      renderFolderList();

      mappingSetting.addText((text) => {
        text
          .setPlaceholder("Add folders (Enter to add)")
          .setValue("")
          .onChange(() => {
            // No-op: handled on Enter/Comma for multi-add
          });
        text.inputEl.classList.add("rpg-folder-input");
        text.inputEl.style.width = "200px";

        const addFromInput = async () => {
          const value = text.inputEl.value;
          const entries = value
            .split(/[\n,;]+/)
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
            .map((entry) => normalizeFolderPath(entry));

          const uniqueEntries = entries
            .filter((entry): entry is string => entry !== null)
            .filter((entry) => !mapping.folderPaths.includes(entry));

          if (uniqueEntries.length === 0) {
            text.setValue("");
            return;
          }

          mapping.folderPaths = [...mapping.folderPaths, ...uniqueEntries];
          text.setValue("");
          await this.saveAndUpdateRegistry();
          renderFolderList();
        };

        text.inputEl.addEventListener("keydown", async (event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            await addFromInput();
          }
        });

        const folderSuggest = new FolderSuggest(this.app, text, async (selection) => {
          const normalized = normalizeFolderPath(selection);
          if (normalized === null || mapping.folderPaths.includes(normalized)) {
            text.setValue("");
            return;
          }
          mapping.folderPaths = [...mapping.folderPaths, normalized];
          text.setValue("");
          await this.saveAndUpdateRegistry();
          renderFolderList();
        });
        folderSuggests.push(folderSuggest);

        return text;
      });

      mappingSetting
        .addText((text) => {
          text
            .setPlaceholder("System file (e.g., Systems/Pathfinder 2e.md)")
            .setValue(mapping.systemFilePath)
            .onChange(async (value) => {
              mapping.systemFilePath = value;
              await this.saveAndUpdateRegistry();
            });
          text.inputEl.style.width = "250px";
          
          // Add autocomplete for system file path
          const fileSuggest = new FileSuggest(this.app, text);
          fileSuggests.push(fileSuggest);
          
          return text;
        })
        .addButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Remove mapping")
            .onClick(async () => {
              this.plugin.settings.systemMappings.splice(i, 1);
              await this.saveAndUpdateRegistry();
              // Clean up file suggests
              fileSuggests.forEach(fs => fs.destroy());
              folderSuggests.forEach(fs => fs.destroy());
              this.display(); // Refresh display
            })
        );
    }
  }

  private async saveAndUpdateRegistry(): Promise<void> {
    await this.plugin.saveSettings();
    
    // Update system registry with new mappings
    const registry = SystemRegistry.getInstance();
    const mappings = new Map<string, string>();
    for (const mapping of this.plugin.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFilePath);
      }
    }
    registry.setFolderMappings(mappings);
  }

  // Helper method to add color picker setting
  private addColorSetting(containerEl: HTMLElement, name: string, settingKey: keyof DndUIToolkitSettings): void {
    new Setting(containerEl).setName(name).addColorPicker((colorPicker) =>
      colorPicker.setValue(this.plugin.settings[settingKey] as string).onChange(async (value) => {
        (this.plugin.settings as any)[settingKey] = value;
        await this.plugin.saveSettings();
        this.plugin.applyColorSettings();
      })
    );
  }
}

function normalizeFolderPath(value: string): string | null {
  const trimmed = value.replace(/\\/g, "/").trim();
  if (trimmed.length === 0) return null;
  if (trimmed === "/" || trimmed === ".") return "";
  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized.length === 0 ? "" : normalized;
}

type InlineCallType = "table" | "cards";
type InlineCall = {
  type: InlineCallType;
  argsText: string;
  start: number;
  end: number;
};

async function aggressiveInlineCodeReplacement(el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: DndUIToolkitPlugin): Promise<void> {
  // This is a more aggressive approach: find ALL code elements and try to process them
  const codeElements = Array.from(el.querySelectorAll("code"));

  for (const codeEl of codeElements) {
    const text = codeEl.textContent?.trim() ?? "";
    
    if (!text.startsWith("rpg.")) {
      continue;
    }

    // Try to parse as an inline call
    const call = findNextInlineCall(text, 0);
    if (!call) {
      continue;
    }

    // Check if this code element contains the full call
    if (call.start === 0 && call.end === text.length) {

      try {
        const replacement = await renderInlineCall(call, ctx, plugin);
        codeEl.replaceWith(replacement);
      } catch (err) {
        console.error("DnD UI Toolkit: Error in aggressive replacement:", err, { text });
      }
    }
  }
}

async function processInlineRpgCalls(el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: DndUIToolkitPlugin): Promise<void> {
  
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Don't filter on .cm-line - we need to process Live Preview content!
      if (parent.closest("code, pre")) return NodeFilter.FILTER_REJECT;
      if (!node.textContent || !node.textContent.includes("rpg.")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  if (textNodes.length === 0) {
    // No text nodes found with rpg. - still try to process code elements
    // Don't return early, continue to processInlineCodeElements
  } else {
    // Process text nodes that have inline rpg calls
    for (const node of textNodes) {
      const text = node.textContent ?? "";
      const fragments = await replaceInlineCalls(text, ctx, plugin);
      if (!fragments) continue;
      node.parentNode?.replaceChild(fragments, node);
    }
  }

  // Always process inline code elements regardless of text nodes
  await processInlineCodeElements(el, ctx, plugin);
}

async function processInlineCodeElements(el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: DndUIToolkitPlugin): Promise<void> {
  const codeNodes = Array.from(el.querySelectorAll("code"))
    .filter((node) => !node.closest("pre"));

  for (const codeNode of codeNodes) {
    const raw = codeNode.textContent?.trim() ?? "";
    
    if (!raw.startsWith("rpg.")) {
      continue;
    }

    const call = findNextInlineCall(raw, 0);
    if (!call || call.start !== 0 || call.end !== raw.length) {
      continue;
    }

    const replacement = await renderInlineCall(call, ctx, plugin);
    const parent = codeNode.parentElement;

    if (parent && parent.tagName === "P" && parent.textContent?.trim() === raw) {
      parent.replaceWith(replacement);
    } else {
      codeNode.replaceWith(replacement);
    }
  }
}

async function replaceInlineCalls(text: string, ctx: MarkdownPostProcessorContext, plugin: DndUIToolkitPlugin): Promise<DocumentFragment | null> {
  let cursor = 0;
  const fragment = document.createDocumentFragment();
  let replaced = false;

  while (cursor < text.length) {
    const call = findNextInlineCall(text, cursor);
    if (!call) break;

    if (call.start > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, call.start)));
    }

    const replacement = await renderInlineCall(call, ctx, plugin);
    fragment.appendChild(replacement);
    cursor = call.end;
    replaced = true;
  }

  if (!replaced) return null;

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)));
  }

  return fragment;
}

function findNextInlineCall(text: string, startIndex: number): InlineCall | null {
  const regex = /rpg\.(table|cards)\(/g;
  regex.lastIndex = startIndex;
  const match = regex.exec(text);
  if (!match) return null;

  const type = match[1] as InlineCallType;
  const openParenIndex = match.index + match[0].length - 1;
  const argsResult = readArgs(text, openParenIndex + 1);
  if (!argsResult) return null;

  return {
    type,
    argsText: argsResult.argsText,
    start: match.index,
    end: argsResult.endIndex + 1,
  };
}

function readArgs(text: string, startIndex: number): { argsText: string; endIndex: number } | null {
  let depth = 1;
  let inString: string | null = null;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (depth === 0) {
      return { argsText: text.slice(startIndex, i), endIndex: i };
    }
  }

  return null;
}

function splitArgs(argsText: string): [string, string] | null {
  let depth = 0;
  let inString: string | null = null;
  let escapeNext = false;

  for (let i = 0; i < argsText.length; i++) {
    const char = argsText[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "[" || char === "{" || char === "(") depth += 1;
    if (char === "]" || char === "}" || char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      const left = argsText.slice(0, i).trim();
      const right = argsText.slice(i + 1).trim();
      return [left, right];
    }
  }

  return null;
}

async function renderInlineCall(call: InlineCall, ctx: MarkdownPostProcessorContext, plugin: DndUIToolkitPlugin): Promise<HTMLElement> {
  const errorEl = (message: string): HTMLElement => {
    const span = document.createElement("span");
    span.className = "rpg-inline-error";
    span.textContent = message;
    return span;
  };

  const args = splitArgs(call.argsText);
  if (!args) {
    return errorEl(`Invalid rpg.${call.type} arguments`);
  }

  const dataName = args[0].replace(/^['"]|['"]$/g, "").trim();
  const system = SystemRegistry.getInstance().getSystemForFile(ctx.sourcePath);
  const dataResult = await resolveDataSource(dataName, system, ctx, plugin);
  if (!dataResult.data) {
    return errorEl(dataResult.error ?? `Unknown data source: ${dataName}`);
  }
  const data = dataResult.data;

  if (call.type === "table") {
    let columns: unknown;
    try {
      columns = parseYaml(args[1]);
    } catch (error) {
      return errorEl("Invalid table columns");
    }
    if (!Array.isArray(columns)) {
      return errorEl("Invalid table columns");
    }
    return buildInlineTable(data, columns as Array<Record<string, unknown>>);
  }

  let fields: unknown;
  try {
    fields = parseYaml(args[1]);
  } catch (error) {
    return errorEl("Invalid card fields");
  }
  if (!Array.isArray(fields)) {
    return errorEl("Invalid card fields");
  }
  return buildInlineCards(data, fields as string[], ctx.sourcePath, (text, element, path) => {
    MarkdownRenderer.renderMarkdown(text, element, path, plugin);
  });
}

async function resolveDataSource(
  name: string,
  system: RPGSystem,
  ctx: MarkdownPostProcessorContext,
  plugin: DndUIToolkitPlugin
): Promise<{ data: DataRecord[] | null; error?: string }> {
  if (name !== "attributes") return { data: null };

  const hasMapping = hasSystemMapping(ctx.sourcePath);
  if (!hasMapping) {
    const localAttributes = await loadAttributesFromFile(ctx, plugin);
    if (localAttributes && localAttributes.length > 0) {
      return { data: normalizeAttributeRecords(localAttributes) };
    }
    return { data: null, error: "No system mapping for this file and no rpg system.attributes block found." };
  }

  if (system.attributeDefinitions && system.attributeDefinitions.length > 0) {
    return { data: normalizeAttributeRecords(system.attributeDefinitions as DataRecord[]) };
  }

  return { data: system.attributes.map((attribute) => ({ name: attribute })) };
}

function hasSystemMapping(filePath: string): boolean {
  const settings = settingsStore.getSettings();
  if (!settings || settings.systemMappings.length === 0) return false;

  const parts = filePath.split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    const folderPath = parts.slice(0, i).join("/");
    if (settings.systemMappings.some((mapping) => mapping.folderPaths.includes(folderPath))) {
      return true;
    }
  }

  return settings.systemMappings.some((mapping) => mapping.folderPaths.includes(""));
}

async function loadAttributesFromFile(
  ctx: MarkdownPostProcessorContext,
  plugin: DndUIToolkitPlugin
): Promise<Array<Record<string, unknown> | string> | null> {
  const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
  if (!file || !(file instanceof TFile)) {
    return null;
  }

  const content = await plugin.app.vault.cachedRead(file);
  const blocks = extractCodeBlocks(content, "rpg system.attributes");
  for (const block of blocks) {
    const parsed = parseAttributeDefinitions(block);
    if (parsed && parsed.length > 0) {
      return parsed;
    }
  }

  return null;
}

function parseAttributeDefinitions(block: string): Array<Record<string, unknown> | string> | null {
  let parsed: unknown;
  try {
    parsed = parseYaml(block);
  } catch (error) {
    return null;
  }

  if (Array.isArray(parsed)) {
    return parsed as Array<Record<string, unknown> | string>;
  }

  if (parsed && typeof parsed === "object" && "attributes" in parsed) {
    const attributes = (parsed as { attributes?: unknown }).attributes;
    if (Array.isArray(attributes)) {
        return attributes as Array<Record<string, unknown> | string>;
    }
  }

  return null;
}

function normalizeAttributeRecords(records: Array<Record<string, unknown> | string>): DataRecord[] {
  return records.map((record) => {
    if (typeof record === "string") {
      return { name: record };
    }
    return record;
  });
}






