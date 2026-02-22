/**
 * System Mappings UI
 * Renders the folder-to-system mapping controls in the settings tab.
 */

import { App, Setting } from "obsidian";
import { FolderSuggest } from "lib/utils/folder-suggest";
import { DndUIToolkitSettings } from "settings";
import { SystemRegistry } from "lib/systems/registry";

export interface SystemMappingsContext {
  app: App;
  settings: DndUIToolkitSettings;
  onSave: () => Promise<void>;
  onRefresh: () => void;
}

/** Render the system mappings list into the given container element. */
export function renderSystemMappings(containerEl: HTMLElement, ctx: SystemMappingsContext): void {
  containerEl.empty();

  if (ctx.settings.systemMappings.length === 0) {
    containerEl.createEl("p", {
      text: "No system mappings configured. Using D&D 5e as default for all files.",
      cls: "setting-item-description",
    });
    return;
  }

  const folderSuggests: FolderSuggest[] = [];

  for (let i = 0; i < ctx.settings.systemMappings.length; i++) {
    const mapping = ctx.settings.systemMappings[i];

    const mappingSetting = new Setting(containerEl).setName(`Mapping ${i + 1}`);
    const folderContainer = mappingSetting.controlEl.createDiv({ cls: "rpg-folder-mapping" });
    const folderList = folderContainer.createDiv({ cls: "rpg-folder-list" });

    const renderFolderList = () => {
      folderList.empty();
      mapping.folderPaths.forEach((path) => {
        const chip = folderList.createDiv({ cls: "rpg-folder-chip" });
        const label = path === "" ? "(root)" : path;
        chip.createSpan({ text: label, cls: "rpg-folder-chip-label" });
        const removeButton = chip.createEl("button", { text: "x", cls: "rpg-folder-chip-remove" });
        removeButton.addEventListener("click", async () => {
          mapping.folderPaths = mapping.folderPaths.filter((entry) => entry !== path);
          await saveAndSync(ctx);
          renderFolderList();
        });
      });
    };

    renderFolderList();

    mappingSetting.addText((text) => {
      text.setPlaceholder("Add folders (Enter to add)").setValue("").onChange(() => {});
      text.inputEl.classList.add("rpg-folder-input");
      text.inputEl.style.width = "200px";

      const addFromInput = async () => {
        const entries = text.inputEl.value
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
          .map(normalizeFolderPath)
          .filter((e): e is string => e !== null)
          .filter((e) => !mapping.folderPaths.includes(e));

        if (entries.length === 0) { text.setValue(""); return; }
        mapping.folderPaths = [...mapping.folderPaths, ...entries];
        text.setValue("");
        await saveAndSync(ctx);
        renderFolderList();
      };

      text.inputEl.addEventListener("keydown", async (event) => {
        if (event.key === "Enter" || event.key === ",") {
          event.preventDefault();
          await addFromInput();
        }
      });

      const folderSuggest = new FolderSuggest(ctx.app, text, async (selection) => {
        const normalized = normalizeFolderPath(selection);
        if (normalized === null || mapping.folderPaths.includes(normalized)) { text.setValue(""); return; }
        mapping.folderPaths = [...mapping.folderPaths, normalized];
        text.setValue("");
        await saveAndSync(ctx);
        renderFolderList();
      });
      folderSuggests.push(folderSuggest);
      return text;
    });

    mappingSetting
      .addText((text) => {
        text
          .setPlaceholder("System folder (e.g., systems/dnd5e)")
          .setValue(mapping.systemFolderPath)
          .onChange(async (value) => {
            mapping.systemFolderPath = value;
            await saveAndSync(ctx);
          });
        text.inputEl.style.width = "250px";
        folderSuggests.push(new FolderSuggest(ctx.app, text));
        return text;
      })
      .addButton((button) =>
        button
          .setIcon("trash")
          .setTooltip("Remove mapping")
          .onClick(async () => {
            ctx.settings.systemMappings.splice(i, 1);
            await saveAndSync(ctx);
            folderSuggests.forEach((fs) => fs.destroy());
            ctx.onRefresh();
          })
      );
  }
}

async function saveAndSync(ctx: SystemMappingsContext): Promise<void> {
  await ctx.onSave();
  const registry = SystemRegistry.getInstance();
  const mappings = new Map<string, string>();
  for (const mapping of ctx.settings.systemMappings) {
    for (const folderPath of mapping.folderPaths) {
      mappings.set(folderPath, mapping.systemFolderPath);
    }
  }
  registry.setFolderMappings(mappings);
}

export function normalizeFolderPath(value: string): string | null {
  const trimmed = value.replace(/\\/g, "/").trim();
  if (trimmed.length === 0) return null;
  if (trimmed === "/" || trimmed === ".") return "";
  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized.length === 0 ? "" : normalized;
}
