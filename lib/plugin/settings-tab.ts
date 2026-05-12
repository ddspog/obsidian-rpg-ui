/**
 * Settings Tab
 * Plugin settings UI for the DnD UI Toolkit.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import { DndUIToolkitSettings } from "settings";
import { THEMES } from "lib/themes";
import { renderSystemMappings } from "lib/plugin/system-mappings-ui";
import { renderFolderLinkStyles } from "lib/plugin/folder-link-styles-ui";

// Forward-declared plugin type to avoid circular imports
interface PluginWithSettings {
  app: App;
  settings: DndUIToolkitSettings;
  saveSettings(): Promise<void>;
  applyColorSettings(): void;
}

export class DndSettingsTab extends PluginSettingTab {
  plugin: PluginWithSettings;

  constructor(app: App, plugin: PluginWithSettings) {
    super(app, plugin as any);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "DnD UI Toolkit Settings" });

    new Setting(containerEl)
      .setName("State File Path")
      .setDesc(
        "Relative path (from vault root) where the state file will be stored. " +
          "The statefile contains all the stateful data for components that are interactive and need to be saved. " +
          "This is a JSON file."
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

    new Setting(containerEl)
      .setName("Scroll restore window (ms)")
      .setDesc(
        "Total time the plugin keeps re-applying your scroll position " +
          "after a button click that rewrites a YAML block. " +
          "RPG fences mount their content asynchronously, so a single restore " +
          "lands too early on long sheets and the page jumps near the top. " +
          "Increase this value if you still see jumps; lower it if restores feel sluggish."
      )
      .addText((text) =>
        text
          .setPlaceholder("600")
          .setValue(String(this.plugin.settings.scrollRestoreDelayMs))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.scrollRestoreDelayMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : 600;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Systems" });
    containerEl.createEl("p", {
      text: "Map content folders to TypeScript system definitions. Files in these folders will use the specified system rules.",
      cls: "setting-item-description",
    });

    const mappingsContainer = containerEl.createDiv({ cls: "rpg-systems-mappings" });
    renderSystemMappings(mappingsContainer, {
      app: this.app,
      settings: this.plugin.settings,
      onSave: () => this.plugin.saveSettings(),
      onRefresh: () => this.display(),
    });

    new Setting(containerEl)
      .setName("Add System Mapping")
      .setDesc("Add a folder-to-system mapping")
      .addButton((button) =>
        button.setButtonText("Add").onClick(() => {
          this.plugin.settings.systemMappings.push({ folderPaths: [], systemFolderPath: "" });
          this.display();
        })
      );

    containerEl.createEl("h3", { text: "Folder link styles" });
    containerEl.createEl("p", {
      text: "Tag internal links (wikilinks) by the folder of their resolved target. Longest matching folder prefix wins.",
      cls: "setting-item-description",
    });

    const folderLinkStylesContainer = containerEl.createDiv({
      cls: "rpg-folder-link-styles",
    });
    renderFolderLinkStyles(folderLinkStylesContainer, {
      app: this.app,
      settings: this.plugin.settings,
      onSave: () => this.plugin.saveSettings(),
      onRefresh: () => this.display(),
    });

    new Setting(containerEl)
      .setName("Add folder link style")
      .setDesc("Add a new per-folder link styling entry")
      .addButton((button) =>
        button.setButtonText("Add").onClick(() => {
          // Stable id per entry. Taken once at creation so later edits
          // (adding / removing paths, changing the label) don't bump the
          // generated CSS class name. Fallback to a timestamp makes
          // collisions effectively impossible even across quick clicks.
          const nextIndex = this.plugin.settings.folderLinkStyles.length + 1;
          this.plugin.settings.folderLinkStyles.push({
            id: `style-${nextIndex}-${Date.now().toString(36)}`,
            folderPaths: [],
            borderStyle: "none",
          });
          this.display();
        })
      );

    containerEl.createEl("h3", { text: "Styles" });

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
            this.display();
          }
        });
      });

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
        Object.assign(this.plugin.settings, THEMES.default.colors);
        await this.plugin.saveSettings();
        this.plugin.applyColorSettings();
        this.display();
      });
    });
  }

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
