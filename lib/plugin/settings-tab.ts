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
  /** Invoked after the author edits the footer-fields list so the
   *  injector can re-render every open reading-view immediately. */
  refreshPageFooter?(): void;
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

    containerEl.createEl("h3", { text: "Page footer fields" });
    containerEl.createEl("p", {
      text:
        "Frontmatter keys rendered at the end of every reading-view note, in order. " +
        "Values are rendered as markdown (wikilinks, bold, italics all work). " +
        "Auto-hidden inside transclusions — a `![[Foo]]` embed won't drag the footer into the host note.",
      cls: "setting-item-description",
    });

    const footerContainer = containerEl.createDiv({ cls: "rpg-page-footer-fields" });
    this.renderPageFooterFields(footerContainer);

    new Setting(containerEl)
      .setName("Add footer field")
      .setDesc("Add a frontmatter key to render at the end of the page")
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          this.plugin.settings.pageFooterFields.push({ key: "" });
          await this.plugin.saveSettings();
          this.plugin.refreshPageFooter?.();
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

  /** One row per configured field. Each row exposes key + optional
   *  label text inputs and a Remove button. Changes propagate to the
   *  plugin immediately so live reading-view footers re-render as the
   *  author types. */
  private renderPageFooterFields(container: HTMLElement): void {
    container.empty();
    const fields = this.plugin.settings.pageFooterFields;
    if (fields.length === 0) {
      container.createEl("p", {
        text: "No footer fields configured. Click 'Add footer field' to render a frontmatter key (e.g. `source`) at the end of every note.",
        cls: "setting-item-description",
      });
      return;
    }
    fields.forEach((field, idx) => {
      const setting = new Setting(container)
        .setName(`Field ${idx + 1}`)
        .setDesc("Frontmatter key, and an optional label prefix. Leave the label empty to use the capitalized key.");
      setting.addText((text) =>
        text
          .setPlaceholder("source")
          .setValue(field.key)
          .onChange(async (value) => {
            field.key = value.trim();
            await this.plugin.saveSettings();
            this.plugin.refreshPageFooter?.();
          })
      );
      setting.addText((text) =>
        text
          .setPlaceholder("Source")
          .setValue(field.label ?? "")
          .onChange(async (value) => {
            // Preserve the distinction between "unset" (auto-cap from
            // key) and "explicitly empty string" (suppress the label)
            // so authors who want a bare value can get it by entering
            // a single space; trimming back to empty keeps the
            // auto-cap behaviour.
            field.label = value === "" ? undefined : value;
            await this.plugin.saveSettings();
            this.plugin.refreshPageFooter?.();
          })
      );
      setting.addExtraButton((btn) =>
        btn
          .setIcon("trash")
          .setTooltip("Remove this footer field")
          .onClick(async () => {
            this.plugin.settings.pageFooterFields.splice(idx, 1);
            await this.plugin.saveSettings();
            this.plugin.refreshPageFooter?.();
            this.display();
          })
      );
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
