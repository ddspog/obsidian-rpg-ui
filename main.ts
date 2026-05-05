import { App, Plugin, MarkdownPostProcessorContext, MarkdownRenderer, MarkdownRenderChild, MarkdownSectionInformation, parseYaml, TFile } from "obsidian";
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
import { parseTableBlock } from "lib/domains/tables/parse-table-block";
import { renderTableBlock } from "lib/domains/tables/render-table-block";
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

    // Compendium-edit hot reload: when any file under a registered system
    // folder changes, invalidate that system's cached bundle. Without this
    // the entity factory's `compendium` (loaded via `wiki.folder`) stays
    // frozen at first load, so edits to class / subclass / lineage docs
    // don't surface in the character sheet until the plugin restarts.
    // Character notes themselves live OUTSIDE the system folders (under
    // `folderMappings`'s key paths, not its values), so they never trigger
    // this invalidation.
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith(".md")) return;
        const reg = SystemRegistry.getInstance();
        for (const systemPath of reg.getFolderMappings().values()) {
          if (file.path === systemPath || file.path.startsWith(systemPath + "/")) {
            reg.invalidateSystem(systemPath);
            // Re-render any open character notes whose folder maps to this
            // system. The system bundle reload is async; once it lands,
            // these forced re-renders re-run the markdown post-processors
            // which then pick up the freshly-resolved compendium.
            void this.refreshSystemConsumers(systemPath);
            break;
          }
        }
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
      // `rpg table.<name>` is a standalone table block. The body is a
      // markdown table (not YAML), so it's dispatched to a plain-DOM
      // renderer rather than the entity-block YAML pipeline. The reading-view
      // path may collapse the fence info to a bare `"table"` meta — recover
      // the name from the file's raw text via `getSectionInfo` then.
      if (meta === "table" || meta.startsWith("table.")) {
        let blockName = meta.startsWith("table.") ? meta.slice("table.".length) : "";
        if (!blockName) {
          const sectionText = ctx.getSectionInfo(el)?.text ?? "";
          for (const line of sectionText.split("\n")) {
            const fenceMatch = line.match(/^```rpg\s+table\.([A-Za-z0-9_-]+)/);
            if (fenceMatch) {
              blockName = fenceMatch[1];
              break;
            }
          }
        }
        if (!blockName) blockName = "unnamed";
        try {
          const def = parseTableBlock(blockName, source);
          const disposers = renderTableBlock(el, def, { filePath: ctx.sourcePath });
          if (disposers.length > 0) {
            const child = new (class extends MarkdownRenderChild {
              onunload(): void {
                for (const d of disposers) d();
              }
            })(el);
            ctx.addChild(child);
          }
        } catch (err) {
          console.error("rpg table.* render failed", err);
          el.innerHTML = '<div class="notice">Error rendering rpg table</div>';
        }
        return;
      }

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

  /**
   * Re-render every open markdown view whose file lives in a folder mapped
   * to the given system path. Called after a compendium file changes so
   * the freshly-resolved system bundle gets surfaced without requiring a
   * manual reload. Awaits the in-flight system load so the re-render hits
   * the new bundle, not the still-loading one.
   */
  async refreshSystemConsumers(systemFolderPath: string): Promise<void> {
    const reg = SystemRegistry.getInstance();
    // Wait for the (re)load to finish so callers see the new system on
    // re-render. invalidateSystem already kicked off the load.
    await reg.loadSystemAsync(systemFolderPath);
    const mappings = reg.getFolderMappings();
    const consumerFolders: string[] = [];
    for (const [folder, sys] of mappings) {
      if (sys === systemFolderPath) consumerFolders.push(folder);
    }
    if (consumerFolders.length === 0) return;
    const inMappedFolder = (path: string): boolean =>
      consumerFolders.some((f) => f === "" || path === f || path.startsWith(f + "/"));
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as unknown as {
        getViewType?: () => string;
        file?: { path?: string };
        previewMode?: { rerender?: (full?: boolean) => void };
      };
      if (typeof view.getViewType !== "function") return;
      if (view.getViewType() !== "markdown") return;
      const path = view.file?.path;
      if (!path || !inMappedFolder(path)) return;
      try {
        view.previewMode?.rerender?.(true);
      } catch {
        // Some views don't expose previewMode (source-mode editors, …);
        // they'll pick up the change on next render naturally.
      }
    });
  }

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
      // Snapshot resolved entity/block names for the wrapper closure so YAML
      // patches stay scoped to this view's fence even when `this` rebinds.
      const entityType = this.entityType;
      const blockName = this.blockName;

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
          // Setter factory shared by both the explicit pre-seeding (for keys
          // already present in self) and the lazy Proxy fallback (so blocks
          // can call `self.setChoices(...)` even when the YAML didn't
          // declare `choices:` yet — patchYamlBlock will append the new
          // top-level key on first write).
          const makeSetter = (key: string) => (valueOrUpdater: unknown) => {
            setSelf((prev) => {
              const newValue =
                typeof valueOrUpdater === "function"
                  ? (valueOrUpdater as (p: unknown) => unknown)(prev[key])
                  : valueOrUpdater;
              patchYamlBlock(
                app,
                sourcePath,
                entityType,
                blockName,
                key,
                newValue,
                sectionInfo ?? undefined,
              ).catch((err) => console.error("RPG UI: yaml patch failed:", err));
              return { ...prev, [key]: newValue };
            });
          };

          const setters: Record<string, unknown> = {};
          for (const key of Object.keys(self)) {
            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            setters[setterName] = makeSetter(key);
          }

          // Wrap in a Proxy so any `set<Cap>` access lazily mints a setter
          // for the corresponding key — supports blocks that initialise
          // optional state (like the features block writing `choices:` on
          // first pick) without requiring the YAML to pre-declare it.
          const merged = { ...self, ...setters };
          return new Proxy(merged, {
            get(target, prop, receiver) {
              if (typeof prop === "string" && prop.startsWith("set") && prop.length > 3) {
                const c = prop.charCodeAt(3);
                if (c >= 0x41 && c <= 0x5a /* 'A'-'Z' */) {
                  if (prop in target) return Reflect.get(target, prop, receiver);
                  const key = prop.charAt(3).toLowerCase() + prop.slice(4);
                  return makeSetter(key);
                }
              }
              return Reflect.get(target, prop, receiver);
            },
          });
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

        // File-local tables: scan the current file's raw text (available via
        // sectionInfo) for `rpg table.<name>` fences, parse each, and expose
        // them on `lookup.$tables` so block renderers can run
        // `substituteExpressions` against them. Tables declared in the same
        // compendium doc are reachable by bare `<name>`; cross-source reads
        // against a character's full compendium remain a sheet-side concern.
        let fileTables: Record<string, unknown> = {};
        try {
          const fileText = sectionInfo?.text;
          if (fileText) {
            const re = /```rpg table\.([A-Za-z0-9_-]+)\s*\n([\s\S]*?)```/g;
            for (const m of fileText.matchAll(re)) {
              const def = parseTableBlock(m[1], m[2]);
              fileTables[def.name] = def;
            }
          }
        } catch {
          // leave fileTables empty on error
        }
        lookupObj = { ...lookupObj, $tables: fileTables };

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
