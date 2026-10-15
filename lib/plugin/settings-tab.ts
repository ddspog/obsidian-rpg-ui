/**
 * Settings Tab
 * Plugin settings UI for the DnD UI Toolkit.
 */

import { App, DropdownComponent, ExtraButtonComponent, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import { DndUIToolkitSettings } from "settings";
import { THEMES } from "lib/themes";
import { renderSystemMappings } from "lib/plugin/system-mappings-ui";
import { renderFolderLinkStyles } from "lib/plugin/folder-link-styles-ui";
import { ImageStudioModal } from "lib/plugin/image-studio-modal";
import { createSection, setSectionsOpen } from "lib/plugin/settings-sections";
import { FRAME_KINDS, type FrameNameMode } from "lib/services/card-frame-config";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { CardFramePreview } from "lib/components/card-frame/CardFramePreview";
import { generateImage } from "lib/services/image-gen";
import { finishFrame } from "lib/services/image-post";
import { hexPackIndex } from "lib/services/hex-pack-index";
import { HexPackStudio } from "lib/components/hexmap/hex-pack-studio";
import { FLAT_PACK } from "lib/domains/hexmap/layout";
import { LAYERS, type TileFolder } from "lib/domains/hexmap/packs";

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

type TabId = "general" | "content" | "appearance" | "images" | "hexmaps";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "content", label: "Systems & links" },
  { id: "appearance", label: "Appearance" },
  { id: "images", label: "Image studio" },
  { id: "hexmaps", label: "Hex maps" },
];

type ColorKey = keyof DndUIToolkitSettings;

const COLOR_GROUPS: [string, [string, ColorKey][]][] = [
  [
    "Background",
    [
      ["Primary", "colorBgPrimary"],
      ["Secondary", "colorBgSecondary"],
      ["Tertiary", "colorBgTertiary"],
      ["Hover", "colorBgHover"],
      ["Darker", "colorBgDarker"],
      ["Group", "colorBgGroup"],
      ["Proficient", "colorBgProficient"],
    ],
  ],
  [
    "Text",
    [
      ["Primary", "colorTextPrimary"],
      ["Secondary", "colorTextSecondary"],
      ["Sublabel", "colorTextSublabel"],
      ["Bright", "colorTextBright"],
      ["Muted", "colorTextMuted"],
      ["Group", "colorTextGroup"],
    ],
  ],
  [
    "Border",
    [
      ["Primary", "colorBorderPrimary"],
      ["Active", "colorBorderActive"],
      ["Focus", "colorBorderFocus"],
    ],
  ],
  [
    "Accent",
    [
      ["Teal", "colorAccentTeal"],
      ["Red", "colorAccentRed"],
      ["Purple", "colorAccentPurple"],
    ],
  ],
];

/** "3 fields", "1 field", "none". */
const count = (n: number, noun: string): string => (n === 0 ? "none" : `${n} ${noun}${n === 1 ? "" : "s"}`);

export class DndSettingsTab extends PluginSettingTab {
  plugin: PluginWithSettings;
  private previews: ReactDOM.Root[] = [];
  /** Kept across `display()` rebuilds so an edit doesn't jump back to the first tab. */
  private activeTab: TabId = "general";

  hide(): void {
    this.previews.forEach((r) => r.unmount());
    this.previews = [];
  }

  constructor(app: App, plugin: PluginWithSettings) {
    super(app, plugin as any);
    this.plugin = plugin;
  }

  display(): void {
    this.hide();
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("rpg-settings");

    const bar = containerEl.createDiv({ cls: "rpg-settings-bar" });
    const tabs = bar.createEl("menu", { cls: "rpg-settings-tabs", attr: { role: "tablist" } });
    const panel = containerEl.createDiv({ cls: "rpg-settings-panel", attr: { role: "tabpanel" } });
    for (const tab of TABS) {
      const selected = tab.id === this.activeTab;
      const button = tabs.createEl("li").createEl("button", {
        text: tab.label,
        cls: selected ? "rpg-settings-tab is-active" : "rpg-settings-tab",
        attr: { role: "tab", "aria-selected": String(selected) },
      });
      button.addEventListener("click", () => {
        if (this.activeTab === tab.id) return;
        this.activeTab = tab.id;
        this.display();
      });
    }

    const actions = bar.createDiv({ cls: "rpg-settings-bar-actions" });
    new ExtraButtonComponent(actions)
      .setIcon("chevrons-down-up")
      .setTooltip("Collapse all")
      .onClick(() => setSectionsOpen(panel, false));
    new ExtraButtonComponent(actions)
      .setIcon("chevrons-up-down")
      .setTooltip("Expand all")
      .onClick(() => setSectionsOpen(panel, true));

    switch (this.activeTab) {
      case "general":
        this.renderGeneral(panel);
        break;
      case "content":
        this.renderSystems(panel);
        this.renderFolderLinks(panel);
        break;
      case "appearance":
        this.renderStyles(panel);
        this.renderCardFrame(panel);
        break;
      case "images":
        this.renderImageStudio(panel);
        break;
      case "hexmaps":
        this.renderHexMaps(panel);
        break;
    }
  }

  /** The state file, scroll restore and the page footer. */
  private renderGeneral(panel: HTMLElement): void {
    const containerEl = createSection(panel, "general:behaviour", "Storage & behaviour", { open: true }).body;

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

    const footer = createSection(panel, "general:footer", "Page footer fields", {
      open: true,
      note: count(this.plugin.settings.pageFooterFields.length, "field"),
      desc:
        "Frontmatter keys rendered at the end of every reading-view note, in order. " +
        "Values are rendered as markdown (wikilinks, bold, italics all work). " +
        "Auto-hidden inside transclusions — a `![[Foo]]` embed won't drag the footer into the host note.",
    }).body;

    const footerContainer = footer.createDiv({ cls: "rpg-page-footer-fields" });
    this.renderPageFooterFields(footerContainer);

    new Setting(footer)
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
  }

  /** Folder-to-system mappings, one collapsible entry each. */
  private renderSystems(panel: HTMLElement): void {
    const containerEl = createSection(panel, "content:systems", "Systems", {
      open: true,
      note: count(this.plugin.settings.systemMappings.length, "mapping"),
      desc: "Map content folders to TypeScript system definitions. Files in these folders will use the specified system rules.",
    }).body;

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
  }

  /** Per-folder link styles, one collapsible entry each. */
  private renderFolderLinks(panel: HTMLElement): void {
    const containerEl = createSection(panel, "content:folder-links", "Folder link styles", {
      open: true,
      note: count(this.plugin.settings.folderLinkStyles.length, "style"),
      desc: "Tag internal links (wikilinks) by the folder of their resolved target. Longest matching folder prefix wins.",
    }).body;

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
  }

  /** The theme preset and its colours, laid out as a grid of pickers. */
  private renderStyles(panel: HTMLElement): void {
    const theme = createSection(panel, "appearance:theme", "Theme", {
      open: true,
      note: THEMES[this.plugin.settings.selectedTheme]?.name ?? "",
    }).body;

    new Setting(theme)
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

    new Setting(theme).setName("Reset Styles").addButton((b) => {
      b.setButtonText("Reset").onClick(async () => {
        this.plugin.settings.selectedTheme = "default";
        Object.assign(this.plugin.settings, THEMES.default.colors);
        await this.plugin.saveSettings();
        this.plugin.applyColorSettings();
        this.display();
      });
    });

    const colors = createSection(panel, "appearance:colors", "Colors", {
      desc: "Fine-tune the preset; any edit here applies at once.",
    }).body;
    for (const [group, entries] of COLOR_GROUPS) {
      colors.createEl("h4", { text: group, cls: "rpg-settings-subheading" });
      const grid = colors.createDiv({ cls: "rpg-settings-color-grid" });
      for (const [name, key] of entries) this.addColorSetting(grid, name, key);
    }
  }

  /** Where hex map texture packs live, and which one maps use by default. */
  private renderHexMaps(panel: HTMLElement): void {
    let containerEl = createSection(panel, "hexmaps:packs", "Packs", { open: true }).body;
    const packsEl = containerEl.createDiv();

    new Setting(containerEl)
      .setName("Packs folder")
      .setDesc(
        "Vault folder with one subfolder per texture pack: <pack>/terrain, <pack>/path, <pack>/stack, and a pack.yml. " +
          "A hex map names its pack with `pack:`; tiles and pack.yml edits show up without a reload."
      )
      .addText((text) =>
        text
          .setPlaceholder("z52. Hex Packs")
          .setValue(this.plugin.settings.hexPacksFolder)
          .onChange(async (value) => {
            this.plugin.settings.hexPacksFolder = value.trim();
            await this.plugin.saveSettings();
            void renderPacks();
          })
      )
      .addButton((b) =>
        b.setButtonText("Rescan").onClick(() => {
          hexPackIndex.invalidate();
          void renderPacks();
        })
      );

    let defaultPack: DropdownComponent | null = null;
    new Setting(containerEl)
      .setName("Default pack")
      .setDesc("Used when a hex map doesn't name one. `flat` draws plain colours, no images.")
      .addDropdown((dropdown) => {
        defaultPack = dropdown;
        dropdown.onChange(async (value) => {
          this.plugin.settings.hexDefaultPack = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.appendChild(packsEl);
    const renderPacks = async () => {
      const packs = await hexPackIndex.getPacks();
      packsEl.empty();
      const count = (f: TileFolder): number =>
        f.files.length + [...f.folders.values()].reduce((n, sub) => n + count(sub), 0);
      if (packs.size === 0) {
        packsEl.createEl("p", {
          cls: "setting-item-description",
          text: `No packs found in "${this.plugin.settings.hexPacksFolder}".`,
        });
      } else {
        const list = packsEl.createEl("ul", { cls: "setting-item-description" });
        for (const pack of packs.values()) {
          const layers = LAYERS.map((l) => `${count(pack.layers[l])} ${l}`).join(" · ");
          const catalog = Object.keys(pack.config.catalog).length;
          list.createEl("li", {
            text: `${pack.name} — ${pack.config.name}: ${layers}${catalog ? ` · ${catalog} catalog names` : ""}`,
          });
        }
      }
      if (defaultPack) {
        const dd: DropdownComponent = defaultPack;
        dd.selectEl.empty();
        for (const name of [...packs.keys(), FLAT_PACK]) dd.addOption(name, name);
        const current = this.plugin.settings.hexDefaultPack;
        if (!packs.has(current) && current !== FLAT_PACK) dd.addOption(current, `${current} (not found)`);
        dd.setValue(current);
      }
    };
    void renderPacks();

    containerEl = createSection(panel, "hexmaps:display", "Display", { open: true }).body;

    new Setting(containerEl)
      .setName("Grid lines")
      .setDesc("Outline every hex. Tiles with their own border (pack.yml `borderWidth`) draw it either way.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.hexGridLines).onChange(async (v) => {
          this.plugin.settings.hexGridLines = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Coordinates")
      .setDesc("Where a hex's (q, r) shows, when a map's head doesn't say (`coords:`).")
      .addDropdown((d) =>
        d
          .addOption("hover", "In the hover tooltip")
          .addOption("always", "Always, on every hex")
          .addOption("off", "Off (no tooltip)")
          .setValue(this.plugin.settings.hexCoords)
          .onChange(async (v) => {
            this.plugin.settings.hexCoords = v as "off" | "hover" | "always";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Label size")
      .setDesc("Place and region names, relative to the default.")
      .addSlider((sl) =>
        sl
          .setLimits(0.5, 2, 0.1)
          .setValue(this.plugin.settings.hexLabelScale)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.hexLabelScale = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Map height")
      .setDesc("Tallest a hex map gets in a note, as % of the window height. Zoom and pan show the rest.")
      .addSlider((sl) =>
        sl
          .setLimits(30, 100, 5)
          .setValue(this.plugin.settings.hexMapMaxHeight)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.hexMapMaxHeight = v;
            await this.plugin.saveSettings();
          })
      );

    containerEl = createSection(panel, "hexmaps:browser", "Pack browser", {
      desc:
        "Browse a pack's tiles, preview them on a hex cluster, tune where they sit and name them in the catalog. " +
        "Changes stay a draft until Save, which edits the pack's pack.yml (comments kept; a pack.yml.bak is made first).",
    }).body;
    const studio = ReactDOM.createRoot(containerEl.createDiv());
    this.previews.push(studio);
    studio.render(React.createElement(HexPackStudio, { app: this.app }));
  }

  /** The frames framed pictures are drawn in, one per kind: CSS, or one made here. */
  private renderCardFrame(panel: HTMLElement): void {
    const plugin = this.plugin;
    const frames = createSection(panel, "appearance:frames", "Card frames", {
      note: count(Object.keys(FRAME_KINDS).length, "kind"),
      desc:
        "Pictures marked framed (framed: true, or framed: item to borrow another kind's) are art only; the plugin draws the frame around them — in CSS by default. " +
        "Or have the image studio's model paint a frame for each kind here: its window is found and cleared, and the pictures show through it. " +
        "A block can hide its name with frame-name: false.",
    }).body;
    for (const info of Object.values(FRAME_KINDS)) {
      const all = (plugin.settings.cardFrames ??= {});
      const mine = (all[info.id] ??= {});
      const containerEl = createSection(frames, `appearance:frame:${info.id}`, info.label, {
        note: mine.image ? "image frame" : "CSS frame",
        desc: `Used by: ${info.blocks.join("; ")}.`,
        cls: "rpg-settings-subsection",
      }).body;
      const previewEl = containerEl.createDiv();
      const preview = ReactDOM.createRoot(previewEl);
      this.previews.push(preview);
      const draw = () =>
        preview.render(React.createElement(CardFramePreview, { kind: info.id, name: mine.name ?? info.name }));
      draw();
      new Setting(containerEl)
        .setName("Name")
        .setDesc("How the frame shows the name.")
        .addDropdown((d) =>
          d
            .addOption("band", "On the bottom band")
            .addOption("plaque", "On a plaque over the art")
            .addOption("none", "Not shown")
            .setValue(mine.name ?? info.name)
            .onChange(async (v) => {
              mine.name = v as FrameNameMode;
              draw();
              await plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Style")
        .setDesc("What the frame looks like; the window is added for you.")
        .addTextArea((t) => {
          t.inputEl.rows = 3;
          t.inputEl.style.width = "100%";
          t.setValue(mine.style ?? info.style).onChange(async (v) => {
            mine.style = v;
            await plugin.saveSettings();
          });
        });
      new Setting(containerEl)
        .setName(mine.image ? `Using ${mine.image.path}` : "Using the CSS frame")
        .addButton((b) =>
          b
            .setButtonText(mine.image ? "Regenerate" : "Generate")
            .setCta()
            .onClick(async () => {
              b.setDisabled(true);
              const notice = new Notice(`Making the ${info.label.toLowerCase()} frame…`, 0);
              try {
                const shape =
                  info.aspect === "16:9" ? "wide landscape 16:9" : info.aspect === "1:1" ? "square" : "portrait 3:4";
                const made = await generateImage(
                  plugin.settings.imageStudio,
                  `A flat front-on empty frame, ${shape}, filling the whole image: ${mine.style ?? info.style}. ` +
                    "The window for the picture is one solid flat magenta (#FF00FF) rectangle, and everything outside the frame's outer edge is the same solid flat magenta. " +
                    "No picture, no text, no characters, no perspective, no shadow outside the frame.",
                  info.aspect
                );
                const done = await finishFrame(made.data, made.mime);
                const folder = "Frames";
                if (!plugin.app.vault.getAbstractFileByPath(folder)) await plugin.app.vault.createFolder(folder);
                const path = `${folder}/${info.label} frame.webp`;
                const existing = plugin.app.vault.getAbstractFileByPath(path);
                if (existing instanceof TFile) await plugin.app.vault.modifyBinary(existing, done.data);
                else await plugin.app.vault.createBinary(path, done.data);
                mine.image = { path, window: done.window, aspect: done.aspect };
                await plugin.saveSettings();
                new Notice(`${info.label} frame saved.`);
                this.display();
              } catch (e) {
                new Notice(`Frame failed: ${(e as Error).message}`);
              } finally {
                notice.hide();
                b.setDisabled(false);
              }
            })
        )
        .addButton((b) =>
          b
            .setButtonText("Use the CSS frame")
            .setDisabled(!mine.image)
            .onClick(async () => {
              delete mine.image;
              await plugin.saveSettings();
              this.display();
            })
        );
    }
  }

  /** The image studio: the links it asks for images and prompts, and a way in. */
  private renderImageStudio(panel: HTMLElement): void {
    const s = this.plugin.settings.imageStudio;
    const save = async () => this.plugin.saveSettings();
    let containerEl = createSection(panel, "images:studio", "Studio", {
      open: true,
      desc:
        "Make images for notes, item blocks and hotbar icons from a prompt — the image there now beside the new one, " +
        "kept only when you accept it. Each link is the base URL of an endpoint (a provider's, or a local proxy's); leave one empty to turn it off.",
    }).body;

    new Setting(containerEl).setName("Open the image studio").addButton((b) =>
      b
        .setButtonText("Open")
        .setCta()
        .onClick(() => new ImageStudioModal(this.app, s, this.app.workspace.getActiveFile() ?? undefined).open())
    );

    new Setting(containerEl)
      .setName("Images made by")
      .setDesc("Which endpoint makes the images.")
      .addDropdown((d) =>
        d
          .addOption("gemini", "Gemini")
          .addOption("ollama", "Ollama")
          .setValue(s.imageProvider)
          .onChange(async (v) => {
            s.imageProvider = v as typeof s.imageProvider;
            await save();
          })
      );

    const text = (name: string, desc: string, key: keyof typeof s, placeholder = "", secret = false) =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((t) => {
          if (secret) t.inputEl.type = "password";
          t.setPlaceholder(placeholder)
            .setValue(String(s[key] ?? ""))
            .onChange(async (v) => {
              (s as unknown as Record<string, string>)[key] = v.trim();
              await save();
            });
        });

    containerEl = createSection(panel, "images:gemini", "Gemini", {
      open: s.imageProvider === "gemini",
      note: s.geminiUrl ? s.geminiImageModel || "" : "off",
    }).body;
    text(
      "Gemini link",
      "Base URL of a Gemini-compatible endpoint — it makes the images.",
      "geminiUrl",
      "https://generativelanguage.googleapis.com"
    );
    text("Gemini key", "Only if the endpoint asks for one.", "geminiKey", "", true);
    text("Gemini image model", "An image-capable model.", "geminiImageModel", "gemini-2.5-flash-image");
    containerEl = createSection(panel, "images:ollama", "Ollama", {
      open: s.imageProvider === "ollama",
      note: s.ollamaUrl ? s.ollamaImageModel || "" : "off",
    }).body;
    text(
      "Ollama link",
      "Base URL of an Ollama server — for a local image model.",
      "ollamaUrl",
      "http://localhost:11434"
    );
    text("Ollama image model", "An Ollama model that makes images.", "ollamaImageModel");
    containerEl = createSection(panel, "images:anthropic", "Anthropic", {
      note: s.anthropicUrl ? s.anthropicModel || "" : "off",
    }).body;
    text(
      "Anthropic link",
      "Base URL of an Anthropic-compatible endpoint — it drafts a prompt's subject from the note.",
      "anthropicUrl",
      "https://api.anthropic.com"
    );
    text("Anthropic key", "Only if the endpoint asks for one.", "anthropicKey", "", true);
    text("Anthropic model", "The model that drafts subjects.", "anthropicModel", "claude-sonnet-5");
    containerEl = createSection(panel, "images:hotbar", "Hotbar icons").body;
    text(
      "Hotbar icon folder",
      "Where hotbar icons are saved — the hotbar reads images from any folder named Icons.",
      "iconFolder",
      "Icons"
    );

    new Setting(containerEl)
      .setName("Hotbar icon style")
      .setDesc(
        "What a hotbar icon's prompt starts with. Every other kind (items, spells, portraits, creatures, banners, maps) has its own, filled from the note."
      )
      .addTextArea((t) => {
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
        t.setValue(s.stylePrompt).onChange(async (v) => {
          s.stylePrompt = v;
          await save();
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
