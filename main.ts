import { Plugin, MarkdownPostProcessorContext, MarkdownRenderer, MarkdownRenderChild, parseYaml } from "obsidian";
import { DndSettingsTab } from "lib/plugin/settings-tab";
import { createViews, createViewRegistry, LEGACY_MAPPINGS } from "lib/plugin/view-registry";
import {
  COMPILATION_VIEW_TYPE,
  compilationFactory,
  compilationOptions,
} from "lib/views/CompilationBasesView";
import { KeyValueStore } from "lib/services/kv/kv";
import { JsonDataStore } from "./lib/services/kv/local-file-store";
import { DEFAULT_SETTINGS, DndUIToolkitSettings } from "settings";
import { msgbus } from "lib/services/event-bus";
import * as Fm from "lib/domains/frontmatter";
import { extractMeta } from "lib/utils/meta-extractor";
import { SystemRegistry } from "lib/systems/registry";
import { settingsStore } from "lib/services/settings-store";
import { initEsbuild } from "lib/systems/ts-loader";
import * as React from "react";
import * as ReactDOM from "react-dom/client";

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
    apply(document.documentElement);
    this.app.workspace.iterateAllLeaves((leaf) => {
      const windowDoc = leaf.view.containerEl.ownerDocument;
      if (windowDoc) apply(windowDoc.documentElement);
    });
  }

  async onload() {
    await this.loadSettings();
    settingsStore.setSettings(this.settings);
    this.applyColorSettings();

    this.registerEvent(
      this.app.workspace.on("window-open", () => {
        setTimeout(() => this.applyColorSettings(), 100);
      })
    );

    this.initDataStore();

    // Initialize esbuild-wasm early, using the bundled WASM file if available
    const pluginDir = (this.manifest as any).dir ?? `.obsidian/plugins/${this.manifest.id}`;
    const localWasmURL = `${this.app.vault.adapter.getResourcePath?.(`${pluginDir}/esbuild.wasm`) ?? ""}`;
    initEsbuild(localWasmURL || undefined).catch((err) => {
      console.warn("RPG UI: Failed to initialize esbuild-wasm (TypeScript systems disabled):", err);
    });

    const registry = SystemRegistry.getInstance();
    registry.initialize(this.app.vault);
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFolderPath);
      }
    }
    registry.setFolderMappings(mappings);

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const filefm = this.app.metadataCache.getCache(file.path)?.frontmatter;
        msgbus.publish(file.path, "fm:changed", Fm.anyIntoFrontMatter(filefm || {}));
      })
    );

    const kv = new KeyValueStore(this.dataStore);
    const views = createViews(this.app, kv);
    const viewRegistry = createViewRegistry(views);

    // ── Bases: Compilation view ──────────────────────────────────────────
    // Register the Compilation BasesView so it appears in the Bases Layout
    // dropdown. `registerBasesView` is a runtime-only API (not in .d.ts).
    if (typeof (this as any).registerBasesView === "function") {
      (this as any).registerBasesView(COMPILATION_VIEW_TYPE, {
        name: "Compilation",
        icon: "book-open",
        factory: compilationFactory,
        options: compilationOptions,
      });
    }

    this.registerMarkdownCodeBlockProcessor("rpg", (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const meta = extractMeta(ctx, el, source);
      if (!meta) {
        console.error("DnD UI Toolkit: Failed to extract meta from rpg block");
        el.innerHTML = '<div class="notice">Error: rpg block missing meta type (e.g., rpg attributes)</div>';
        return;
      }
      const view = viewRegistry.get(meta);
      if (view) {
        view.register(source, el, ctx);
        return;
      }

      // Handle entity blocks: meta of the form "entityType.blockName"
      const dotIndex = meta.indexOf(".");
      if (dotIndex > 0) {
        const entityType = meta.slice(0, dotIndex);
        const blockName = meta.slice(dotIndex + 1);
        const system = registry.getSystemForFile(ctx.sourcePath);
        const blockDef = system.entities[entityType]?.blocks?.[blockName];
        if (blockDef) {
          const child = new EntityBlockRenderChild(el, source, blockDef.component);
          ctx.addChild(child);
          return;
        }
      }

      console.error(`DnD UI Toolkit: Unknown rpg block type: ${meta}`);
      el.innerHTML = `<div class="notice">Unknown rpg block type: ${meta}</div>`;
    });

    for (const [oldType, meta] of Object.entries(LEGACY_MAPPINGS)) {
      this.registerMarkdownCodeBlockProcessor(oldType, (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const view = viewRegistry.get(meta);
        if (view) view.register(source, el, ctx);
      });
    }

    this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const cache = this.app.metadataCache.getCache(ctx.sourcePath);
      const fm = cache?.frontmatter;
      if (!Array.isArray(fm?.cssclasses) || !fm.cssclasses.includes("rpg-ui")) return;

      const subtitle = fm.subtitle as string | undefined;
      const source = fm.source as string | undefined;
      if (!subtitle && !source) return;

      setTimeout(() => {
        const previewView = el.closest(".markdown-preview-view");
        if (!previewView) return;

        // Navigate up to the reading view container so we can find sibling
        // elements like .mod-footer.mod-ui which sit outside .markdown-preview-view
        const readingView = previewView.closest(".markdown-reading-view") ?? previewView.parentElement;

        // ── Subtitle: always re-create so it reflects the current file ──
        if (subtitle) {
          const inlineTitle = previewView.querySelector(".inline-title");
          if (inlineTitle) {
            // Remove any stale subtitle from a previously viewed file
            const existing = previewView.querySelector(".rpg-ui-subtitle");
            if (existing) {
              if (existing.textContent === subtitle) return; // already correct
              existing.remove();
            }
            const subtitleEl = document.createElement("div");
            subtitleEl.className = "rpg-ui-subtitle";
            subtitleEl.textContent = subtitle;
            inlineTitle.after(subtitleEl);
          }
        }

        // ── Source / footer: search from the reading-view root ──
        if (source && readingView) {
          const footer = readingView.querySelector(".mod-footer.mod-ui");
          if (footer) {
            // Remove stale source element from a previous file
            const existing = footer.querySelector(".rpg-ui-source");
            if (existing) existing.remove();

            const sourceEl = document.createElement("div");
            sourceEl.className = "rpg-ui-source";
            void MarkdownRenderer.render(
              this.app,
              source.replace(/^"+|"+$/g, ""),
              sourceEl,
              ctx.sourcePath,
              this,
            );
            footer.appendChild(sourceEl);
          }
        }
      }, 0);
    });

    this.addSettingTab(new DndSettingsTab(this.app, this));
  }

  initDataStore() {
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
    this.initDataStore();
    const sysRegistry = SystemRegistry.getInstance();
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFolderPath);
      }
    }
    sysRegistry.setFolderMappings(mappings);
  }

  private normalizeSystemMappings(rawMappings: unknown): DndUIToolkitSettings["systemMappings"] {
    if (!Array.isArray(rawMappings)) return [];
    return rawMappings.map((mapping) => {
      const typed = mapping as { folderPath?: string; folderPaths?: string[]; systemFolderPath?: string; systemFilePath?: string };
      const folderPaths = Array.isArray(typed.folderPaths)
        ? typed.folderPaths
        : typed.folderPath !== undefined
          ? [typed.folderPath]
          : [];
      // Migrate: if only the old systemFilePath key exists, use it as systemFolderPath
      const systemFolderPath = typed.systemFolderPath ?? typed.systemFilePath ?? "";
      return {
        folderPaths: folderPaths.filter((p) => p !== undefined) as string[],
        systemFolderPath,
      };
    });
  }
}

/**
 * MarkdownRenderChild that renders an entity block component via React.
 * Parses the YAML source, calls the block's component function, and mounts
 * the result into the container element. Cleans up the React root on unload.
 */
class EntityBlockRenderChild extends MarkdownRenderChild {
  private source: string;
  private component: (props: Record<string, unknown>) => unknown;
  private reactRoot: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    source: string,
    component: (props: Record<string, unknown>) => unknown,
  ) {
    super(el);
    this.source = source;
    this.component = component;
  }

  onload() {
    try {
      const parsed = parseYaml(this.source);
      const props: Record<string, unknown> =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      this.reactRoot = ReactDOM.createRoot(this.containerEl);
      // component signature matches React.FC – cast needed because BlockDefinition uses `unknown` return
      const Comp = this.component as React.FC<Record<string, unknown>>;
      this.reactRoot.render(React.createElement(Comp, props));
    } catch (err) {
      console.error("DnD UI Toolkit: Error rendering entity block:", err);
      this.containerEl.innerHTML = `<div class="notice">Error rendering block: ${err}</div>`;
    }
  }

  onunload() {
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch (e) {
        console.error("DnD UI Toolkit: Error unmounting entity block:", e);
      }
      this.reactRoot = null;
    }
  }
}
