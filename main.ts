import { App, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext } from "obsidian";
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
import { KeyValueStore } from "lib/services/kv/kv";
import { JsonDataStore } from "./lib/services/kv/local-file-store";
import { DEFAULT_SETTINGS, DndUIToolkitSettings } from "settings";
import { THEMES } from "lib/themes";
import { msgbus } from "lib/services/event-bus";
import * as Fm from "lib/domains/frontmatter";
import { extractMeta } from "lib/utils/meta-extractor";
import { SystemRegistry } from "lib/systems/registry";
import { FileSuggest } from "lib/utils/file-suggest";

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
      mappings.set(mapping.folderPath, mapping.systemFilePath);
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

      console.log(`DnD UI Toolkit: Processing rpg block with meta: ${meta}`);
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
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Reinitialize data store with the new path
    this.initDataStore();
    
    // Update system registry with new mappings
    const registry = SystemRegistry.getInstance();
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      mappings.set(mapping.folderPath, mapping.systemFilePath);
    }
    registry.setFolderMappings(mappings);
  }
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
            folderPath: "",
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

    for (let i = 0; i < this.plugin.settings.systemMappings.length; i++) {
      const mapping = this.plugin.settings.systemMappings[i];
      
      const mappingSetting = new Setting(containerEl)
        .setName(`Mapping ${i + 1}`)
        .addText((text) => {
          text
            .setPlaceholder("Folder path (e.g., Characters/Pathfinder)")
            .setValue(mapping.folderPath)
            .onChange(async (value) => {
              mapping.folderPath = value;
              await this.saveAndUpdateRegistry();
            });
          text.inputEl.style.width = "200px";
          return text;
        })
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
      mappings.set(mapping.folderPath, mapping.systemFilePath);
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
