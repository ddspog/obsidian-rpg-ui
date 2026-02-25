import { App, Plugin, MarkdownPostProcessorContext, MarkdownRenderer, MarkdownRenderChild, MarkdownSectionInformation, parseYaml } from "obsidian";
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
import { EntityResolver } from "lib/services/entity-resolver";
import { settingsStore } from "lib/services/settings-store";
import { getEntityBus } from "lib/services/entity-event-bus";
import { patchYamlBlock } from "lib/utils/yaml-patcher";
import { initEsbuild } from "lib/systems/ts-loader";
import * as React from "react";
import type { ReactNode } from "react";
import * as ReactDOM from "react-dom/client";

// Expose React & ReactDOM on globalThis so evaluated system bundles can
// resolve 'react' and 'react-dom/client' via the require shim at runtime.
try {
  (globalThis as any).React = React;
  (globalThis as any).ReactDOM = ReactDOM;
} catch (e) {
  // ignore
}

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
          const entityBus = getEntityBus(ctx.sourcePath);
          const trigger = (eventName: string) => entityBus.trigger(eventName);
          const systemCtx = {
            skills: system.skills,
            attributes: system.attributes,
            conditions: system.conditions ?? [],
            traits: system.traits,
          };
          const sectionInfo = ctx.getSectionInfo(el);
          const child = new EntityBlockRenderChild(
            el,
            source,
            blockDef as unknown as (props: Record<string, unknown>) => ReactNode,
            trigger,
            ctx.sourcePath,
            this.app,
            entityType,
            blockName,
            systemCtx,
            sectionInfo,
          );
          ctx.addChild(child);
          return;
        }

        // If the system mapping exists but the system hasn't loaded yet, trigger
        // an async load and re-attempt registering the block when it completes.
        const mapped = registry.findSystemFolderForFile(ctx.sourcePath);
        if (mapped) {
          // kick off load (no await) and re-check once loaded
          void registry.loadSystemAsync(mapped).then(() => {
            try {
              const reSystem = registry.getSystemForFile(ctx.sourcePath);
              const reBlock = reSystem.entities[entityType]?.blocks?.[blockName];
              if (reBlock) {
                const entityBus = getEntityBus(ctx.sourcePath);
                const trigger = (eventName: string) => entityBus.trigger(eventName);
                const systemCtx = {
                  skills: reSystem.skills,
                  attributes: reSystem.attributes,
                  conditions: reSystem.conditions ?? [],
                  traits: reSystem.traits,
                };
                const sectionInfo = ctx.getSectionInfo(el);
                const child = new EntityBlockRenderChild(
                  el,
                  source,
                  reBlock as unknown as (props: Record<string, unknown>) => ReactNode,
                  trigger,
                  ctx.sourcePath,
                  this.app,
                  entityType,
                  blockName,
                  systemCtx,
                  sectionInfo,
                );
                ctx.addChild(child);
                return;
              }
            } catch (e) {
              // ignore - fall through to unknown notice below
            }
          });
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
  private component: (props: Record<string, unknown>) => ReactNode;
  private trigger: (eventName: string) => void;
  private sourcePath: string;
  private app: App;
  private entityResolver: EntityResolver;
  private entityType: string;
  private blockName: string;
  private systemCtx: { skills: unknown[]; attributes: unknown[]; conditions: unknown[]; traits?: unknown[] };
  private sectionInfo: MarkdownSectionInformation | null;
  private reactRoot: ReactDOM.Root | null = null;
  private appliedCssClasses: string[] = [];

    constructor(
    el: HTMLElement,
    source: string,
    component: (props: Record<string, unknown>) => ReactNode,
    trigger: (eventName: string) => void,
    sourcePath: string,
    app: App,
    entityTypeOrEmpty: string,
    blockNameOrEmpty: string,
    systemCtx: { skills: unknown[]; attributes: unknown[]; conditions: unknown[]; traits?: unknown[] },
    sectionInfo: MarkdownSectionInformation | null,
  ) {
    super(el);
    this.source = source;
    this.component = component;
    this.trigger = trigger;
    this.sourcePath = sourcePath;
    this.app = app;
    this.entityResolver = new EntityResolver(app);
    this.entityType = entityTypeOrEmpty ?? "";
    this.blockName = blockNameOrEmpty ?? "";
    this.systemCtx = systemCtx;
    this.sectionInfo = sectionInfo;
  }

  async onload() {
    try {
      const parsed = parseYaml(this.source);
      const fm = this.app.metadataCache.getCache(this.sourcePath)?.frontmatter ?? {};
      // Merge frontmatter into the block props so components can access global
      // file-level fields (e.g., xp) via `self.xp` while allowing the block
      // to override those values when supplied.
      const blockParsed: Record<string, unknown> =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      const initialSelf: Record<string, unknown> = { ...(fm as Record<string, unknown>), ...blockParsed };
      const Comp = this.component as React.FC<Record<string, unknown>>;
      const app = this.app;
      const sourcePath = this.sourcePath;
      const sectionInfo = this.sectionInfo;
      const trigger = this.trigger;
      const systemCtx = this.systemCtx;
      const registry = SystemRegistry.getInstance();
      const system = registry.getSystemForFile(sourcePath);
      // Try to determine entityType/blockName if not provided
      if (!this.entityType) {
        // Attempt to infer from available blocks by matching component identity
        for (const [etype, def] of Object.entries(system.entities)) {
          for (const bname of Object.keys(def.blocks ?? {})) {
            try {
              // Component identity comparison — cast to any to avoid narrow
              // TypeScript incompatibility between the toolkit Component<> type
              // and the runtime function signature.
              if ((def.blocks?.[bname] as any) === (this.component as any)) {
                this.entityType = etype;
                this.blockName = bname;
                break;
              }
            } catch {}
          }
          if (this.entityType) break;
        }
      }

      // Load entity file blocks via resolver so expressions can read sibling blocks
      let entityData = { codeBlocks: new Map<string, string[]>() } as any;
      try {
        entityData = await this.entityResolver.resolveEntity({ file: sourcePath });
      } catch (e) {
        // ignore - leave empty map
      }

      // Stateful wrapper — holds self in React state and exposes setFoo setters
      // that both update local state (instant re-render) and patch the vault file.
      const EntityBlockWrapper: React.FC = () => {
        const [self, setSelf] = React.useState<Record<string, unknown>>(initialSelf);

        const selfWithSetters = React.useMemo(() => {
          const setters: Record<string, unknown> = {};
          for (const key of Object.keys(self)) {
            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            setters[setterName] = (valueOrUpdater: unknown) => {
              setSelf((prev) => {
                const newValue =
                  typeof valueOrUpdater === "function"
                    ? (valueOrUpdater as (p: unknown) => unknown)(prev[key])
                    : valueOrUpdater;
                if (sectionInfo) {
                  patchYamlBlock(
                    app,
                    sourcePath,
                    sectionInfo.lineStart,
                    sectionInfo.lineEnd,
                    key,
                    newValue,
                  ).catch((err) => console.error("RPG UI: yaml patch failed:", err));
                }
                return { ...prev, [key]: newValue };
              });
            };
          }
          return { ...self, ...setters };
        }, [self]);

        // Build blocks object: parse YAML for each declared block in the entity
        const blocksObj: Record<string, unknown> = {};
        let lookupObj: Record<string, unknown> = {};
        try {
          const entityDef = (system.entities as any)?.[this.entityType];
          lookupObj = (entityDef?.lookup as Record<string, unknown>) ?? {};
          const blockNames: string[] = entityDef ? Object.keys(entityDef.blocks ?? {}) : [];
          for (const bn of blockNames) {
            const meta = `${this.entityType}.${bn}`;
            const raw = entityData.codeBlocks.get(meta)?.[0];
            if (raw) {
              try {
                const parsedBlock = parseYaml(raw);
                blocksObj[bn] = parsedBlock ?? {};
              } catch {
                blocksObj[bn] = {};
              }
            } else {
              blocksObj[bn] = {};
            }
          }
        } catch (e) {
          // leave blocksObj empty on error
        }

        // Build expressions proxy from the system-level expressions Map.
        // CreateSystem collects entity expressions into `system.expressions` (a Map)
        const expressionsProxy: Record<string, (...args: any[]) => unknown> = {};
        try {
          const exprMap: Map<string, any> = (system as any).expressions ?? new Map();
          for (const [name, exprDef] of exprMap.entries()) {
            expressionsProxy[name] = (...callArgs: any[]) => {
              try {
                const argsArr = callArgs.length === 1 && Array.isArray(callArgs[0]) ? callArgs[0] : callArgs;
                return exprDef.evaluate({
                  args: argsArr,
                  lookup: lookupObj,
                  frontmatter: fm,
                  blocks: blocksObj,
                  expressions: expressionsProxy,
                  system: systemCtx,
                });
              } catch (err) {
                console.error("RPG UI: expression evaluate failed:", err);
                return undefined;
              }
            };
          }
        } catch (e) {
          // ignore
        }

        // cssclasses are applied by Obsidian itself; do not mutate DOM here.

        const props: Record<string, unknown> = {
          self: selfWithSetters,
          lookup: lookupObj,
          frontmatter: fm,
          blocks: blocksObj,
          expressions: expressionsProxy,
          system: systemCtx,
          trigger,
        };
        return React.createElement(Comp, props);
      };

      this.reactRoot = ReactDOM.createRoot(this.containerEl);
      this.reactRoot.render(React.createElement(EntityBlockWrapper, null));
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
    // No DOM mutation to clean up for cssclasses (handled by Obsidian)
  }
}
