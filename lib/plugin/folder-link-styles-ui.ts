/**
 * Folder Link Styles UI
 *
 * Renders the per-folder link-styling controls in the settings tab.
 * Modeled on `system-mappings-ui.ts` — each entry is a row of controls
 * plus a live preview swatch so the user can dial in color/pill/border/
 * icon combinations without leaving settings.
 *
 * Each entry can target multiple folder paths so a single visual style
 * (color, pill, icon, border, bold/italic) applies across folders
 * without duplicating the styling dials for every folder. The entry's
 * `id` is assigned once at creation and stays stable regardless of
 * which paths get added or removed, so the generated CSS class name
 * doesn't flip under the user as they tweak the list.
 */

import { App, Setting } from "obsidian";
import { FolderSuggest } from "lib/utils/folder-suggest";
import {
  generateFolderLinkCss,
  OBSIDIAN_COLOR_PRESETS,
  findPresetForValue,
} from "lib/domains/folder-link-styles";
import type { FolderLinkStyle, DndUIToolkitSettings } from "settings";

export interface FolderLinkStylesContext {
  app: App;
  settings: DndUIToolkitSettings;
  onSave: () => Promise<void>;
  onRefresh: () => void;
}

function normalize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function applySwatch(swatchLink: HTMLAnchorElement, style: FolderLinkStyle): void {
  // Render the generated CSS against a scoped selector so the preview
  // doesn't fight with the live document-wide stylesheet — we set the
  // swatch's id on the fly and rewrite its inline <style>.
  const id = style.id || "preview";
  swatchLink.className = `internal-link rpg-folder-link rpg-folder-link--${id}`;
  const fallbackLabel = style.folderPaths.find((p) => p) ?? "Sample link";
  swatchLink.textContent = style.label?.trim() || fallbackLabel;
  const css = generateFolderLinkCss([{ ...style, id }]);
  const styleEl = swatchLink.parentElement?.querySelector<HTMLStyleElement>("style.rpg-folder-link-swatch-style");
  if (styleEl) styleEl.textContent = css;
}

export function renderFolderLinkStyles(containerEl: HTMLElement, ctx: FolderLinkStylesContext): void {
  containerEl.empty();

  if (ctx.settings.folderLinkStyles.length === 0) {
    containerEl.createEl("p", {
      text: "No folder link styles configured. Links to files in any folder will use the default theme styling.",
      cls: "setting-item-description",
    });
    return;
  }

  const folderSuggests: FolderSuggest[] = [];

  for (let i = 0; i < ctx.settings.folderLinkStyles.length; i++) {
    const entry = ctx.settings.folderLinkStyles[i];
    const block = containerEl.createDiv({ cls: "rpg-folder-link-block" });

    // 1) Header row: label + delete
    const headerSetting = new Setting(block).setName(`Folder style ${i + 1}`);

    headerSetting.addText((text) => {
      text
        .setPlaceholder("Label (optional)")
        .setValue(entry.label ?? "")
        .onChange(async (value) => {
          entry.label = value || undefined;
          await ctx.onSave();
          refreshSwatch();
        });
      return text;
    });

    headerSetting.addButton((btn) => {
      btn
        .setIcon("trash")
        .setTooltip("Remove folder style")
        .onClick(async () => {
          ctx.settings.folderLinkStyles.splice(i, 1);
          await ctx.onSave();
          folderSuggests.forEach((fs) => fs.destroy());
          ctx.onRefresh();
        });
      return btn;
    });

    // 2) Folders row: add-folder input + chips. Mirrors the system-
    // mappings UI so the two folder-pickers feel like the same widget.
    const foldersSetting = new Setting(block).setDesc("Folders");
    foldersSetting.addText((text) => {
      text.setPlaceholder("Add folder (Enter to add)").setValue("");
      text.inputEl.classList.add("rpg-folder-input");
      text.inputEl.style.width = "240px";

      const addFolders = async (valueSource: string): Promise<void> => {
        const entries = valueSource
          .split(/[,;\n]+/)
          .map((e) => normalize(e))
          .filter((e) => e.length > 0)
          .filter((e) => !entry.folderPaths.includes(e));
        if (entries.length === 0) {
          text.setValue("");
          return;
        }
        entry.folderPaths = [...entry.folderPaths, ...entries];
        text.setValue("");
        await ctx.onSave();
        renderFolderList();
        refreshSwatch();
      };

      text.inputEl.addEventListener("keydown", async (event) => {
        if (event.key === "Enter" || event.key === ",") {
          event.preventDefault();
          await addFolders(text.inputEl.value);
        }
      });

      folderSuggests.push(
        new FolderSuggest(ctx.app, text, async (selection) => {
          const picked = normalize(selection);
          if (!picked || entry.folderPaths.includes(picked)) {
            text.setValue("");
            return;
          }
          entry.folderPaths = [...entry.folderPaths, picked];
          text.setValue("");
          await ctx.onSave();
          renderFolderList();
          refreshSwatch();
        })
      );

      return text;
    });

    const chipsContainer = foldersSetting.controlEl.createDiv({ cls: "rpg-folder-list" });

    const renderFolderList = (): void => {
      chipsContainer.empty();
      entry.folderPaths.forEach((path) => {
        const chip = chipsContainer.createDiv({ cls: "rpg-folder-chip" });
        chip.createSpan({ text: path, cls: "rpg-folder-chip-label" });
        const removeButton = chip.createEl("button", { text: "x", cls: "rpg-folder-chip-remove" });
        removeButton.addEventListener("click", async () => {
          entry.folderPaths = entry.folderPaths.filter((p) => p !== path);
          await ctx.onSave();
          renderFolderList();
          refreshSwatch();
        });
      });
    };
    renderFolderList();

    // 3) Colors row: text + background + icon.
    // Each color picker is paired with an "enabled" toggle — Obsidian's
    // color picker widget always produces a value, so the toggle is the
    // only way to mark a field as "unset" (undefined). When a toggle is
    // off the stored value is undefined, so the generated stylesheet
    // omits the declaration and the theme default applies.
    const colorsSetting = new Setting(block).setDesc("Colors");

    const addColorPair = (
      label: string,
      get: () => string | undefined,
      set: (value: string | undefined) => void,
      fallback: string
    ): void => {
      colorsSetting.controlEl.createSpan({ text: label, cls: "rpg-folder-link-field-label" });
      const pickerRef: { el: HTMLInputElement | null } = { el: null };
      const dropdownRef: { el: HTMLSelectElement | null } = { el: null };

      colorsSetting.addToggle((toggle) => {
        toggle.setValue(get() !== undefined).onChange(async (enabled) => {
          if (enabled) {
            set(get() ?? fallback);
            if (pickerRef.el) pickerRef.el.disabled = false;
            if (dropdownRef.el) dropdownRef.el.disabled = false;
          } else {
            set(undefined);
            if (pickerRef.el) pickerRef.el.disabled = true;
            if (dropdownRef.el) dropdownRef.el.disabled = true;
          }
          await ctx.onSave();
          refreshSwatch();
        });
        return toggle;
      });
      colorsSetting.addColorPicker((picker) => {
        // Live picker falls back to the preset's hex when the stored
        // value is a `var(...)` reference, so dragging the swatch to a
        // new color flips the entry back to a literal hex — mirroring
        // user intent (direct edit = custom). The dropdown watches
        // `onChange` and resets itself to "Custom" on any picker edit.
        const currentValue = get();
        const preset = findPresetForValue(currentValue);
        picker.setValue(preset ? preset.fallback : currentValue ?? fallback).onChange(async (value) => {
          set(value);
          if (dropdownRef.el) dropdownRef.el.value = "";
          await ctx.onSave();
          refreshSwatch();
        });
        return picker;
      });
      const inputs = colorsSetting.controlEl.querySelectorAll<HTMLInputElement>('input[type="color"]');
      const last = inputs[inputs.length - 1];
      if (last) {
        pickerRef.el = last;
        last.disabled = get() === undefined;
      }

      // Preset dropdown: "Custom" (empty) + Obsidian's --color-* palette.
      // Picking a preset stores the CSS `var(--color-NAME)` reference so
      // the link inherits whatever the active theme defines for that
      // token; picking "Custom" just re-emits whatever the color picker
      // holds, letting the user switch back to a hex without clearing.
      colorsSetting.addDropdown((drop) => {
        drop.addOption("", "Custom");
        for (const preset of OBSIDIAN_COLOR_PRESETS) {
          drop.addOption(preset.id, preset.label);
        }
        drop.setValue(findPresetForValue(get())?.id ?? "");
        drop.onChange(async (value) => {
          const preset = OBSIDIAN_COLOR_PRESETS.find((p) => p.id === value);
          if (preset) {
            set(preset.cssVar);
            // Update the picker swatch to the preset's fallback hex so
            // the UI reads as "this preset is active" visually.
            if (pickerRef.el) pickerRef.el.value = preset.fallback;
          }
          // "Custom" (empty) doesn't mutate storage — the picker's
          // current value stays in place.
          await ctx.onSave();
          refreshSwatch();
        });
        return drop;
      });
      const selects = colorsSetting.controlEl.querySelectorAll<HTMLSelectElement>("select");
      const lastSelect = selects[selects.length - 1];
      if (lastSelect) {
        dropdownRef.el = lastSelect;
        lastSelect.disabled = get() === undefined;
      }
    };

    addColorPair(
      "Text",
      () => entry.color,
      (v) => {
        entry.color = v;
      },
      "#000000"
    );
    addColorPair(
      "Background",
      () => entry.background,
      (v) => {
        entry.background = v;
      },
      "#ffffff"
    );

    colorsSetting.controlEl.createSpan({ text: "Icon", cls: "rpg-folder-link-field-label" });
    colorsSetting.addText((text) => {
      text
        .setPlaceholder("emoji")
        .setValue(entry.iconPrefix ?? "")
        .onChange(async (value) => {
          entry.iconPrefix = value || undefined;
          await ctx.onSave();
          refreshSwatch();
        });
      text.inputEl.style.width = "60px";
      return text;
    });

    // 4) Border & text row: border style + border color pair + bold / italic.
    const borderSetting = new Setting(block).setDesc("Border & text");
    borderSetting.addDropdown((drop) => {
      drop.addOption("none", "No border");
      drop.addOption("solid", "Solid");
      drop.addOption("dashed", "Dashed");
      drop.addOption("dotted", "Dotted");
      drop.addOption("underline", "Underline");
      drop.setValue(entry.borderStyle ?? "none");
      drop.onChange(async (value) => {
        entry.borderStyle =
          value === "none" || value === "solid" || value === "dashed" || value === "dotted" || value === "underline"
            ? (value as FolderLinkStyle["borderStyle"])
            : "none";
        await ctx.onSave();
        refreshSwatch();
      });
      return drop;
    });

    borderSetting.controlEl.createSpan({ text: "Color", cls: "rpg-folder-link-field-label" });
    const borderPickerRef: { el: HTMLInputElement | null } = { el: null };
    const borderDropdownRef: { el: HTMLSelectElement | null } = { el: null };
    borderSetting.addToggle((toggle) => {
      toggle.setValue(entry.borderColor !== undefined).onChange(async (enabled) => {
        if (enabled) {
          entry.borderColor = entry.borderColor ?? "#888888";
          if (borderPickerRef.el) borderPickerRef.el.disabled = false;
          if (borderDropdownRef.el) borderDropdownRef.el.disabled = false;
        } else {
          entry.borderColor = undefined;
          if (borderPickerRef.el) borderPickerRef.el.disabled = true;
          if (borderDropdownRef.el) borderDropdownRef.el.disabled = true;
        }
        await ctx.onSave();
        refreshSwatch();
      });
      return toggle;
    });
    borderSetting.addColorPicker((picker) => {
      const borderPreset = findPresetForValue(entry.borderColor);
      picker.setValue(borderPreset ? borderPreset.fallback : entry.borderColor || "#888888").onChange(async (value) => {
        entry.borderColor = value;
        if (borderDropdownRef.el) borderDropdownRef.el.value = "";
        await ctx.onSave();
        refreshSwatch();
      });
      return picker;
    });
    const borderInputs = borderSetting.controlEl.querySelectorAll<HTMLInputElement>('input[type="color"]');
    const lastBorderInput = borderInputs[borderInputs.length - 1];
    if (lastBorderInput) {
      borderPickerRef.el = lastBorderInput;
      lastBorderInput.disabled = entry.borderColor === undefined;
    }

    borderSetting.addDropdown((drop) => {
      drop.addOption("", "Custom");
      for (const preset of OBSIDIAN_COLOR_PRESETS) {
        drop.addOption(preset.id, preset.label);
      }
      drop.setValue(findPresetForValue(entry.borderColor)?.id ?? "");
      drop.onChange(async (value) => {
        const preset = OBSIDIAN_COLOR_PRESETS.find((p) => p.id === value);
        if (preset) {
          entry.borderColor = preset.cssVar;
          if (borderPickerRef.el) borderPickerRef.el.value = preset.fallback;
        }
        await ctx.onSave();
        refreshSwatch();
      });
      return drop;
    });
    const borderSelects = borderSetting.controlEl.querySelectorAll<HTMLSelectElement>("select");
    const lastBorderSelect = borderSelects[borderSelects.length - 1];
    if (lastBorderSelect) {
      borderDropdownRef.el = lastBorderSelect;
      lastBorderSelect.disabled = entry.borderColor === undefined;
    }

    borderSetting.controlEl.createSpan({ text: "Bold", cls: "rpg-folder-link-field-label" });
    borderSetting.addToggle((toggle) => {
      toggle.setValue(entry.bold === true).onChange(async (enabled) => {
        entry.bold = enabled || undefined;
        await ctx.onSave();
        refreshSwatch();
      });
      return toggle;
    });

    borderSetting.controlEl.createSpan({ text: "Italic", cls: "rpg-folder-link-field-label" });
    borderSetting.addToggle((toggle) => {
      toggle.setValue(entry.italic === true).onChange(async (enabled) => {
        entry.italic = enabled || undefined;
        await ctx.onSave();
        refreshSwatch();
      });
      return toggle;
    });

    // 5) Preview row: live swatch
    const previewSetting = new Setting(block).setDesc("Preview");
    const swatchContainer = previewSetting.controlEl.createDiv({
      cls: "rpg-folder-link-swatch",
    });
    const swatchStyle = swatchContainer.createEl("style", {
      cls: "rpg-folder-link-swatch-style",
    });
    swatchStyle.textContent = "";
    const swatchLink = swatchContainer.createEl("a", {
      href: "#",
      cls: "internal-link",
    });
    swatchLink.addEventListener("click", (e) => e.preventDefault());

    const refreshSwatch = (): void => applySwatch(swatchLink, entry);
    refreshSwatch();
  }
}
