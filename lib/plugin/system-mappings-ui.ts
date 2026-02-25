/**
 * System Mappings UI
 * Renders the folder-to-system mapping controls in the settings tab.
 */

import { App, Setting, Notice, Modal } from "obsidian";
import { FolderSuggest } from "lib/utils/folder-suggest";
import { DndUIToolkitSettings } from "settings";
import { SystemRegistry } from "lib/systems/registry";
import { loadSystemFromTypeScript } from "lib/systems/ts-loader";

export interface SystemMappingsContext {
  app: App;
  settings: DndUIToolkitSettings;
  onSave: () => Promise<void>;
  onRefresh: () => void;
}

// Normalize folder input into a consistent relative path or empty string for root
function normalizeFolderPath(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
  return v;
}

async function saveAndSync(ctx: SystemMappingsContext): Promise<void> {
  if (ctx && ctx.onSave) {
    await ctx.onSave();
  }
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

  // Hold details DOM nodes and cached JSON per mapping index
  const detailsNodes: Record<number, { container: HTMLDivElement; json: string } | null> = {};

  for (let i = 0; i < ctx.settings.systemMappings.length; i++) {
    const mapping = ctx.settings.systemMappings[i];
    // mapping container groups the three setting rows visually
    const mappingContainer = containerEl.createDiv({ cls: 'rpg-mapping-block' });

    // 1) Header row: Mapping name + System folder + Delete + Process
    const headerSetting = new Setting(mappingContainer).setName(`Mapping ${i + 1}`);
    headerSetting.addText((text) => {
      text
        .setPlaceholder("System folder (start typing to search)")
        .setValue(mapping.systemFolderPath)
        .onChange(async (value) => {
          mapping.systemFolderPath = value;
          await saveAndSync(ctx);
        });

      // Enable folder suggestions (combobox-like)
      const folderSuggest = new FolderSuggest(ctx.app, text, async (selection) => {
        mapping.systemFolderPath = selection;
        text.setValue(selection);
        await saveAndSync(ctx);
      });
      folderSuggests.push(folderSuggest);

      return text;
    });

    headerSetting.addButton((btn) => {
      btn.setIcon("trash").setTooltip("Remove mapping").onClick(async () => {
        ctx.settings.systemMappings.splice(i, 1);
        await saveAndSync(ctx);
        folderSuggests.forEach((fs) => fs.destroy());
        ctx.onRefresh();
      });
      return btn;
    });

    headerSetting.addButton((btn) => {
      btn.setButtonText("Process").onClick(async () => {
        // process mapping on click: load the RPG system definition for the mapped system folder
        const rawFolder = mapping.systemFolderPath;
        if (!rawFolder) {
          new Notice('No system folder set for this mapping');
          return;
        }

        // Try a set of candidate folder paths to be forgiving when users point
        // to the system root rather than the config subfolder.
        const candidates = [rawFolder, `${rawFolder}/config`].map(normalizeFolderPath).filter((c): c is string => !!c);
        let system = null as any;
        let lastErr: any = null;
        for (const cand of candidates) {
          try {
            system = await loadSystemFromTypeScript(ctx.app.vault, cand);
            if (system) { mapping.systemFolderPath = cand; break; }
          } catch (e) {
            lastErr = e;
          }
        }
        if (!system) {
          console.error('Failed to load system for mapping', rawFolder, lastErr);
          new Notice(`Failed to load system from ${rawFolder} (tried candidates: ${candidates.join(', ')})`);
          return;
        }

        // Build a concise summary of the RPGSystem (user-visible)
        const summary: Record<string, unknown> = {
          name: system.name,
          attributes: system.attributes.map((a: any) => ({ name: a.$name, alias: a.alias, subtitle: a.subtitle })),
          entities: Object.keys(system.entities || {}).map((k) => k),
          skills: (system.skills || []).map((s: any) => ({ name: s.$name, attribute: s.attribute })),
          featureCategories: (system.features?.categories || []).map((c: any) => ({ id: c.id, label: c.label })),
          conditions: (system.conditions || []).map((c: any) => ({ name: c.$name, icon: c.icon })),
          expressions: Array.from(system.expressions?.keys() || []),
        };

        const entry = detailsNodes[i];
        if (entry) {
          entry.json = JSON.stringify(summary, null, 2);
          const summaryEl = entry.container.querySelector('.rpg-processed-summary');
          if (summaryEl) (summaryEl as HTMLElement).textContent = `Loaded system: ${system.name}`;
        }
      });
      return btn;
    });

    // 2) Folder row: add-folders input + chips
    const folderSetting = new Setting(mappingContainer).setDesc("");
    const addInput = folderSetting.addText((text) => {
      text.setPlaceholder("Add folders (Enter to add)").setValue("");
      text.inputEl.classList.add("rpg-folder-input");
      text.inputEl.style.width = "200px";

      text.inputEl.addEventListener("keydown", async (event) => {
        if (event.key === "Enter" || event.key === ",") {
          event.preventDefault();
          const entries = text.inputEl.value
            .split(/[,;\n]+/)
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
        }
      });

      new FolderSuggest(ctx.app, text, async (selection) => {
        const normalized = normalizeFolderPath(selection);
        if (normalized === null || mapping.folderPaths.includes(normalized)) { text.setValue(""); return; }
        mapping.folderPaths = [...mapping.folderPaths, normalized];
        text.setValue("");
        await saveAndSync(ctx);
        renderFolderList();
      });

      return text;
    });

    const chipsContainer = folderSetting.controlEl.createDiv({ cls: 'rpg-folder-list' });

    const renderFolderList = () => {
      chipsContainer.empty();
      mapping.folderPaths.forEach((path) => {
        const chip = chipsContainer.createDiv({ cls: 'rpg-folder-chip' });
        const label = path === '' ? '(root)' : path;
        chip.createSpan({ text: label, cls: 'rpg-folder-chip-label' });
        const removeButton = chip.createEl('button', { text: 'x', cls: 'rpg-folder-chip-remove' });
        removeButton.addEventListener('click', async () => {
          mapping.folderPaths = mapping.folderPaths.filter((entry) => entry !== path);
          await saveAndSync(ctx);
          renderFolderList();
        });
      });
    };

    renderFolderList();

    // 3) Output row: processed JSON + Inspect + Copy
    const systemName = mapping.systemFolderPath ? mapping.systemFolderPath.split('/').pop() || mapping.systemFolderPath : 'System';
    const outputSetting = new Setting(mappingContainer).setName(systemName).setDesc('Processed JSON');
    const detailsDiv = outputSetting.controlEl.createDiv({ cls: 'rpg-mapping-details' });
    const controls = detailsDiv.createDiv({ cls: 'rpg-mapping-details-controls' });
    const inspectBtn = controls.createEl('button', { text: 'Inspect' });
    inspectBtn.addEventListener('click', () => {
      const entry = detailsNodes[i];
      const json = entry?.json || '';
      if (!json) { new Notice('No processed JSON for this mapping yet'); return; }
      new JSONInspectModal(ctx.app, systemName, json).open();
    });

    const copyBtn = controls.createEl('button', { text: 'Copy' });
    copyBtn.addEventListener('click', async () => {
      const entry = detailsNodes[i];
      const json = entry?.json || '';
      if (!json) { new Notice('No processed JSON for this mapping yet'); return; }
      try {
        if (navigator && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
          await (navigator as any).clipboard.writeText(json);
        } else {
          const ta = document.createElement('textarea');
          ta.value = json;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        new Notice('Processed JSON copied to clipboard');
      } catch (err) {
        console.error('Failed to copy JSON', err);
        new Notice('Failed to copy JSON to clipboard');
      }
    });

    // small summary element (shows processed file count)
    const summaryEl = detailsDiv.createEl('div', { cls: 'rpg-processed-summary' });
    summaryEl.textContent = '';

    detailsNodes[i] = { container: detailsDiv, json: '' };
  }

}

class JSONInspectModal extends Modal {
  private titleText: string;
  private jsonText: string;
  constructor(app: App, titleText: string, jsonText: string) {
    super(app);
    this.titleText = titleText;
    this.jsonText = jsonText;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.titleText });
    const wrapper = contentEl.createDiv({ cls: 'rpg-json-modal' });
    const pre = wrapper.createEl('pre');
    pre.textContent = this.jsonText;
    pre.style.whiteSpace = 'pre';
    pre.style.overflow = 'auto';
    pre.style.maxHeight = '70vh';
    pre.style.fontFamily = 'monospace';
    pre.style.padding = '8px';
  }
  onClose() {
    this.contentEl.empty();
  }
}
