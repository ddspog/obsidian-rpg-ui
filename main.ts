import {
  App,
  Plugin,
  MarkdownPostProcessorContext,
  MarkdownRenderer,
  MarkdownRenderChild,
  MarkdownSectionInformation,
  Notice,
  parseYaml,
  TFile,
} from "obsidian";
import { DndSettingsTab } from "lib/plugin/settings-tab";
import { createViews, createViewRegistry, LEGACY_MAPPINGS } from "lib/plugin/view-registry";
import { COMPILATION_VIEW_TYPE, compilationFactory, compilationOptions } from "lib/views/CompilationBasesView";
import { KeyValueStore } from "lib/services/kv/kv";
import { JsonDataStore } from "./lib/services/kv/local-file-store";
import { DEFAULT_SETTINGS, DndUIToolkitSettings } from "settings";
import { msgbus } from "lib/services/event-bus";
import * as Fm from "lib/domains/frontmatter";
import { extractMeta, detectMetaFromSource } from "lib/utils/meta-extractor";
import { SystemRegistry } from "lib/systems/registry";
import { EntityResolver } from "lib/services/entity-resolver";
import { settingsStore } from "lib/services/settings-store";
import { getEntityBus } from "lib/services/entity-event-bus";
import { patchYamlBlock } from "lib/utils/yaml-patcher";
import { initEsbuild, setBundleCacheContext } from "lib/systems/ts-loader";
import { parseTableBlock } from "lib/domains/tables/parse-table-block";
import { renderTableBlock } from "lib/domains/tables/render-table-block";
import { parseListBlock } from "lib/domains/lists/parse-list-block";
import { ListRenderChild, installListUnfoldObserver } from "lib/domains/lists/render-list-group";
import { setOfficialSourcesResolver, homebrewBySetting } from "lib/domains/lists/official-sources";
import {
  parseRuleContent,
  parseRuleNotes,
  parseRuleRelated,
  parseRuleSide,
  parseRuleTab,
  RuleContentRenderChild,
  RuleNotesRenderChild,
  RuleRelatedRenderChild,
  RuleTabRenderChild,
  subtypeFromMeta,
} from "lib/domains/rules";
import { installUnfoldObserver } from "lib/domains/rules/render-tab-group";
import { renderSpellBlock } from "lib/blocks/spell-card";
import { FileRefCache } from "lib/domains/references";
import { ReferenceRegistry } from "lib/plugin/reference-registry";
import { buildReferenceProcessor } from "lib/plugin/reference-processor";
import { buildRuleCallProcessor, setupGlobalTableMerger } from "lib/plugin/rule-call-processor";
import { setProcessFencesRegistry } from "lib/plugin/process-rpg-fences";
import { ValueResolver, setActiveValueResolver } from "lib/domains/rules/value-resolver-api";
import { setImageResolverApp } from "lib/domains/rules/image-resolver-api";
import { buildFolderLinkProcessor } from "lib/plugin/folder-link-processor";
import { buildFolderLinkEditorExtension } from "lib/plugin/folder-link-editor-extension";
import { FolderLinkStyleManager } from "lib/plugin/folder-link-style-manager";
import { PageFooterManager } from "lib/plugin/page-footer";
import { PageBannerManager } from "lib/plugin/page-banner";
import { splitFenceBody } from "lib/utils/fence-split";
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
  /** Shared KV store instance. Held on the plugin so `saveSettings` can
   *  hot-swap its underlying data store when the user edits the
   *  state-file path, keeping existing view references valid. */
  private kv: KeyValueStore | null = null;
  /** `@[[File]].path` inline reference system — cache + DOM registry.
   *  Instantiated on load so Obsidian event wiring can reach them. */
  private refCache: FileRefCache | null = null;
  private refRegistry: ReferenceRegistry | null = null;
  private valueResolver: ValueResolver | null = null;
  private folderLinkStyleManager: FolderLinkStyleManager | null = null;
  private pageFooterManager: PageFooterManager | null = null;
  private pageBannerManager: PageBannerManager | null = null;
  /** Bumped on every `saveSettings` so the CM6 extension knows when to
   *  re-tag visible editor anchors without waiting for a docChanged. */
  private folderLinkStylesVersion = 0;

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

    // Bundle cache context — keyed by plugin version so an upgrade
    // invalidates all cached bundles (no stale runtime API mismatches).
    setBundleCacheContext({ pluginDir, pluginVersion: this.manifest.version });

    const registry = SystemRegistry.getInstance();
    registry.initialize(this.app.vault);
    setProcessFencesRegistry(registry);
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFolderPath);
      }
    }
    registry.setFolderMappings(mappings);

    // Per-system official sources → homebrew classification for list blocks.
    // Reads this.settings live, so settings-tab edits take effect without
    // re-registering. Longest matching folder prefix wins.
    setOfficialSourcesResolver((notePath: string) => {
      let best: { len: number; sources: string[] } | null = null;
      for (const mapping of this.settings.systemMappings) {
        const sources = mapping.officialSources;
        if (!sources || sources.length === 0) continue;
        for (const fp of mapping.folderPaths) {
          const matches = fp === "" || notePath === fp || notePath.startsWith(fp.replace(/\/+$/, "") + "/");
          if (matches && (!best || fp.length > best.len)) best = { len: fp.length, sources };
        }
      }
      return best?.sources ?? [];
    });

    // After layout is ready (all views mounted), wait for system bundles
    // to finish loading then auto-refresh so views render with the loaded
    // system's ruleViews on first open — no manual "Reload systems" needed.
    this.app.workspace.onLayoutReady(() => {
      installUnfoldObserver();
      installListUnfoldObserver();
      const systemPaths = new Set(registry.getFolderMappings().values());
      Promise.all([
        // Load system bundles
        ...([...systemPaths].map((sys) => registry.loadSystemAsync(sys))),
        // Warm up the value resolver (vault is now fully indexed)
        this.valueResolver?.warmup().catch((err) =>
          console.error("rpg-ui value-resolver warmup failed", err)
        ),
      ])
        .then(() => {
          console.debug(
            `[rpg-ui] Systems loaded (${this.valueResolver?.list().size ?? 0} rules indexed).`
          );
          // Refresh the currently active page (if any) now that systems are ready.
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile) {
            refreshFilePreview(this.app, activeFile.path);
          }
          // Refresh pages on first focus after system load — handles
          // cached views that rendered before the system was ready.
          const refreshed = new Set<string>(activeFile ? [activeFile.path] : []);
          this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
              if (!leaf) return;
              const view = leaf.view as any;
              if (view?.getViewType?.() !== "markdown") return;
              const path = view.file?.path;
              if (!path || refreshed.has(path)) return;
              refreshed.add(path);
              refreshFilePreview(this.app, path);
            })
          );
          // Register cache invalidation ONLY after warmup completes.
          // vault:modify = actual file edits; metadataCache:changed =
          // Obsidian re-indexing (fires during auto-refresh too, but
          // refCache needs it for frontmatter-only edits that don't
          // trigger vault:modify). valueResolver only listens to
          // vault:modify to avoid the startup invalidation storm.
          this.registerEvent(
            this.app.vault.on("modify", (f) => {
              if (f instanceof TFile) {
                this.refCache?.invalidate(f.path);
                this.valueResolver?.invalidate(f.path);
              }
            })
          );
          this.registerEvent(
            this.app.metadataCache.on("changed", (f) => {
              this.refCache?.invalidate(f.path);
            })
          );
        })
        .catch((err) => console.warn("rpg-ui auto-refresh after layout ready failed", err));
    });

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
    // `folderMappings`'s key paths, not its values); they get a separate
    // fence-body live-refresh pass below.
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith(".md")) return;
        const reg = SystemRegistry.getInstance();
        let handledBySystem = false;
        for (const systemPath of reg.getFolderMappings().values()) {
          if (file.path === systemPath || file.path.startsWith(systemPath + "/")) {
            reg.invalidateSystem(systemPath);
            // Re-render any open character notes whose folder maps to this
            // system. The system bundle reload is async; once it lands,
            // these forced re-renders re-run the markdown post-processors
            // which then pick up the freshly-resolved compendium.
            void this.refreshSystemConsumers(systemPath);
            handledBySystem = true;
            break;
          }
        }
        if (handledBySystem) return;
        // Character / player-side note edit. Obsidian's `metadataCache.on
        // ("changed")` only covers frontmatter, so a manual YAML edit
        // inside a `rpg <entity>.<block>` fence otherwise wouldn't re-
        // render the sheet. Force a full preview re-render here — idempotent
        // with the UI-initiated refresh in `makeSetter` — so typing into
        // a stats / inventory / features fence propagates immediately.
        refreshFilePreview(this.app, file.path);
      })
    );

    const kv = new KeyValueStore(this.dataStore);
    this.kv = kv;
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

    // Per-session memo of block types we've already complained about so
    // a missing handler logs ONE warning instead of one-per-fence-render
    // (every character sheet has 8-12 fences and re-renders fire the
    // post-processor afresh on every preview rebuild).
    const warnedUnknownMeta = new Set<string>();
    const warnUnknown = (meta: string, el: HTMLElement): void => {
      if (!warnedUnknownMeta.has(meta)) {
        warnedUnknownMeta.add(meta);
        console.error(`DnD UI Toolkit: Unknown rpg block type: ${meta}`);
      }
      el.innerHTML = `<div class="notice">Unknown rpg block type: ${meta}</div>`;
    };

    this.registerMarkdownCodeBlockProcessor(
      "rpg",
      (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
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

        // `rpg list.<name>` — a newspaper-flow reference list. The body is
        // pure YAML (a heading `name` + reference-call `entries`). Like
        // `table.*`, the reading-view path may collapse the fence info to a
        // bare `"list"` meta — recover the name from the raw section text.
        if (meta === "list" || meta.startsWith("list.")) {
          let listName = meta.startsWith("list.") ? meta.slice("list.".length) : "";
          if (!listName) {
            const sectionText = ctx.getSectionInfo(el)?.text ?? "";
            for (const line of sectionText.split("\n")) {
              const fenceMatch = line.match(/^```rpg\s+list\.([A-Za-z0-9_-]+)/);
              if (fenceMatch) {
                listName = fenceMatch[1];
                break;
              }
            }
          }
          try {
            const block = parseListBlock(listName, source);
            const child = new ListRenderChild(el, this.app, block, ctx.sourcePath);
            ctx.addChild(child);
          } catch (err) {
            console.error("rpg list.* render failed", err);
            el.innerHTML = '<div class="notice">Error rendering rpg list</div>';
          }
          return;
        }

        // `rpg rule.*` — source-of-truth rule blocks. Phase 1 handles
        // `content` and `side`; `related` and `compendium` land in later
        // phases. Content bodies carry optional YAML frontmatter + markdown;
        // side bodies are pure YAML (callout-style with title/icon/color).
        // Both bypass the entity-block YAML pipeline and mount React
        // directly (like `table.*` and `spell`).
        const ruleSubtype = subtypeFromMeta(meta);
        if (ruleSubtype) {
          if (ruleSubtype === "content" || ruleSubtype === "side") {
            try {
              const block =
                ruleSubtype === "content" ? parseRuleContent(source) : parseRuleSide(source);
              const child = new RuleContentRenderChild(el, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              console.error(`rpg rule.${ruleSubtype} render failed`, err);
              el.innerHTML = `<div class="notice">Error rendering rpg rule.${ruleSubtype}</div>`;
            }
            return;
          }
          if (ruleSubtype === "related") {
            try {
              const block = parseRuleRelated(source);
              const child = new RuleRelatedRenderChild(el, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              console.error("rpg rule.related render failed", err);
              el.innerHTML = '<div class="notice">Error rendering rpg rule.related</div>';
            }
            return;
          }
          if (ruleSubtype === "notes") {
            try {
              const block = parseRuleNotes(source);
              const child = new RuleNotesRenderChild(el, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              console.error("rpg rule.notes render failed", err);
              el.innerHTML = '<div class="notice">Error rendering rpg rule.notes</div>';
            }
            return;
          }
          if (ruleSubtype === "tab") {
            try {
              const block = parseRuleTab(source);
              const child = new RuleTabRenderChild(el, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              console.error("rpg rule.tab render failed", err);
              el.innerHTML = '<div class="notice">Error rendering rpg rule.tab</div>';
            }
            return;
          }
          el.innerHTML = `<div class="notice">rpg rule.${ruleSubtype} not yet implemented</div>`;
          return;
        }

        // `rpg spell` — standalone compendium card reading the host note's
        // frontmatter. The fence body (YAML) is optional; when present it
        // overrides matching fields for display-only tweaks.
        if (meta === "spell") {
          try {
            const child = renderSpellBlock(this.app, el, source, ctx);
            ctx.addChild(child);
          } catch (err) {
            console.error("rpg spell render failed", err);
            el.innerHTML = '<div class="notice">Error rendering rpg spell</div>';
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
              sectionInfo
            );
            ctx.addChild(child);
            return;
          }

          // If the system mapping exists but the system hasn't loaded yet, trigger
          // an async load and re-attempt registering the block when it completes.
          const mapped = registry.findSystemFolderForFile(ctx.sourcePath);
          if (mapped) {
            // Show a placeholder while the bundle loads — flushing the
            // "Unknown block" notice synchronously would race the async
            // load and spam the console with false positives every time
            // a character sheet opens before its system finishes loading.
            el.innerHTML = '<div class="notice">Loading…</div>';
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
                  el.innerHTML = "";
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
                    sectionInfo
                  );
                  ctx.addChild(child);
                  return;
                }
                // Bundle loaded but the block really isn't there — surface
                // the unknown-block notice now (and only now) so the
                // console message reflects a genuine missing handler.
                warnUnknown(meta, el);
              } catch (e) {
                console.error(`DnD UI Toolkit: failed to render ${meta}:`, e);
                el.innerHTML = `<div class="notice">Unknown rpg block type: ${meta}</div>`;
              }
            });
            return;
          }
        }

        warnUnknown(meta, el);
      }
    );

    for (const [oldType, meta] of Object.entries(LEGACY_MAPPINGS)) {
      this.registerMarkdownCodeBlockProcessor(
        oldType,
        (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
          const view = viewRegistry.get(meta);
          if (view) view.register(source, el, ctx);
        }
      );
    }

    // ── Multi-backtick fence support (4+) ─────────────────────────────────
    // Obsidian's registerMarkdownCodeBlockProcessor only routes 3-backtick
    // fences. 4+ backtick fences render as <pre><code class="language-rpg ...">
    // in the DOM. This post-processor catches those and processes them
    // identically to the code block processor above.
    this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const codeBlocks = el.querySelectorAll("pre > code[class*='language-rpg']");
      for (const code of Array.from(codeBlocks)) {
        const pre = code.parentElement;
        if (!pre) continue;
        // Already processed (our code block processor replaces content)
        if (pre.querySelector("[data-rpg-rule], .rpg-table-wrapper, .notice")) continue;

        // Extract meta from the class: "language-rpg rule.tab" → "rule.tab"
        // Obsidian may add internal classes like "is-loaded" after the
        // language class — skip those by validating the captured word looks
        // like a rpg meta identifier (contains a dot or is a known keyword).
        const classMatch = code.className.match(/language-rpg\s+(\S+)/);
        let meta: string | null = null;
        if (classMatch && /^[a-z][\w]*\.[a-z][\w-]*$/i.test(classMatch[1])) {
          meta = classMatch[1];
        }
        if (!meta) {
          const source = code.textContent ?? "";
          meta = detectMetaFromSource(source);
        }
        if (!meta) continue;

        const source = code.textContent ?? "";
        const wrapper = pre.ownerDocument.createElement("div");
        wrapper.classList.add("el-pre");
        const container = pre.ownerDocument.createElement("div");
        container.classList.add("block-language-rpg");
        wrapper.appendChild(container);
        pre.replaceWith(wrapper);

        // Dispatch using the same logic as the code block processor.
        const ruleSubtype = subtypeFromMeta(meta);
        if (ruleSubtype) {
          if (ruleSubtype === "content" || ruleSubtype === "side") {
            try {
              const block = ruleSubtype === "content" ? parseRuleContent(source) : parseRuleSide(source);
              const child = new RuleContentRenderChild(container, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              container.innerHTML = `<div class="notice">Error rendering rpg rule.${ruleSubtype}</div>`;
            }
          } else if (ruleSubtype === "related") {
            try {
              const block = parseRuleRelated(source);
              const child = new RuleRelatedRenderChild(container, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              container.innerHTML = '<div class="notice">Error rendering rpg rule.related</div>';
            }
          } else if (ruleSubtype === "notes") {
            try {
              const block = parseRuleNotes(source);
              const child = new RuleNotesRenderChild(container, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              container.innerHTML = '<div class="notice">Error rendering rpg rule.notes</div>';
            }
          } else if (ruleSubtype === "tab") {
            try {
              const block = parseRuleTab(source);
              const child = new RuleTabRenderChild(container, this.app, block, ctx.sourcePath);
              ctx.addChild(child);
            } catch (err) {
              container.innerHTML = '<div class="notice">Error rendering rpg rule.tab</div>';
            }
          }
        }
      }
    });

    // ── `@[[File]].path` inline references ────────────────────────────────
    // Backs a dataview-ish inline reference system; the cache reads
    // source files lazily through Obsidian's vault adapter while the
    // registry re-renders on vault-modify / metadataCache-changed
    // events so referenced values stay live.
    this.refCache = new FileRefCache({
      readFile: async (path: string) => {
        const f = this.app.vault.getAbstractFileByPath(path);
        return f instanceof TFile ? this.app.vault.cachedRead(f) : null;
      },
      getFrontmatter: (path: string) => {
        const meta = this.app.metadataCache.getCache(path);
        return (meta?.frontmatter as Record<string, unknown> | undefined) ?? null;
      },
    });
    this.refRegistry = new ReferenceRegistry(this.refCache);
    // Call processor (Phase 3) MUST register BEFORE the reference processor
    // so it claims `@[[file]].fn(args)` tokens before the path-form processor
    // sees them. The reference processor's matcher also skips call-form
    // tokens, but registration order is the primary defense.
    this.registerMarkdownPostProcessor(
      buildRuleCallProcessor({
        app: this.app,
        cache: this.refCache,
        registry: SystemRegistry.getInstance(),
      })
    );
    this.registerMarkdownPostProcessor(
      buildReferenceProcessor({
        app: this.app,
        cache: this.refCache,
        registry: this.refRegistry,
      })
    );
    // NOTE: vault:modify and metadataCache:changed handlers for refCache +
    // valueResolver are deferred to onLayoutReady (below) so the initial
    // vault indexing storm doesn't invalidate caches during first render.

    // ── Rule-value resolver (Phase 3) ──────────────────────────────────
    // Walks every markdown file in the vault, indexes `rule.content`
    // blocks by `id`, exposes `getRuleValue(id, path, opts)` to system
    // configs. Warmup runs in the background so plugin onload stays
    // fast; sync `getRuleValue()` returns `opts.fallback` until it lands.
    this.valueResolver = new ValueResolver({
      listMarkdownFiles: () => this.app.vault.getMarkdownFiles().map((f) => f.path),
      read: async (path: string) => {
        const f = this.app.vault.getAbstractFileByPath(path);
        return f instanceof TFile ? this.app.vault.cachedRead(f) : null;
      },
    });
    setActiveValueResolver(this.valueResolver);
    setImageResolverApp(this.app);
    // Warmup is deferred to onLayoutReady (above) — vault may not be
    // fully indexed during onload, so getMarkdownFiles() could miss files.

    // ── Global table-row merger ─────────────────────────────────────────
    // Watches all preview sizers for `.rpg-view--table` elements. When one
    // appears (React committed after an @[[file]].row() call), merges its
    // rows into the preceding markdown table. Must be global because
    // per-section post-processors can't reach sibling sections.
    setupGlobalTableMerger();

    // ── Folder link styling ─────────────────────────────────────────────
    // Stylesheet + reading-mode tagger + Live Preview tagger. The
    // stylesheet lives on document.head (and on every popout window's
    // head, mirroring applyColorSettings); the reading-mode processor
    // runs on every rendered markdown fragment; the CM6 extension does
    // the same for Live Preview. All three share the same class-naming
    // contract (`rpg-folder-link--<id>`) so any one of them can be
    // disabled in isolation without breaking the others.
    this.folderLinkStyleManager = new FolderLinkStyleManager(this.app);
    this.folderLinkStyleManager.apply(this.settings.folderLinkStyles);
    this.registerEvent(
      this.app.workspace.on("window-open", () => {
        setTimeout(() => this.folderLinkStyleManager?.apply(this.settings.folderLinkStyles), 100);
      })
    );

    // ── Page footer (frontmatter fields auto-rendered at note end) ───────
    this.pageFooterManager = new PageFooterManager({
      app: this.app,
      settings: this.settings,
      registerEvent: (ref) => this.registerEvent(ref as Parameters<typeof this.registerEvent>[0]),
    });
    this.pageFooterManager.start();

    // ── Page banner (behind-title image from frontmatter) ────────────────
    this.pageBannerManager = new PageBannerManager({
      app: this.app,
      settings: this.settings,
      registerEvent: (ref) => this.registerEvent(ref as Parameters<typeof this.registerEvent>[0]),
    });
    this.pageBannerManager.start();
    this.registerMarkdownPostProcessor(
      buildFolderLinkProcessor({
        app: this.app,
        getStyles: () => this.settings.folderLinkStyles,
      })
    );
    this.registerEditorExtension(
      buildFolderLinkEditorExtension({
        app: this.app,
        getStyles: () => this.settings.folderLinkStyles,
        getStylesVersion: () => this.folderLinkStylesVersion,
      })
    );

    this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const cache = this.app.metadataCache.getCache(ctx.sourcePath);
      const fm = cache?.frontmatter;
      if (!Array.isArray(fm?.cssclasses) || !fm.cssclasses.includes("rpg-ui")) return;

      const subtitle = fm.subtitle as string | undefined;
      if (!subtitle) return;

      setTimeout(() => {
        const previewView = el.closest(".markdown-preview-view");
        if (!previewView) return;

        // ── Subtitle: always re-create so it reflects the current file ──
        const inlineTitle = previewView.querySelector(".inline-title");
        if (inlineTitle) {
          const existing = previewView.querySelector(".rpg-ui-subtitle");
          if (existing) {
            if (existing.textContent === subtitle) return;
            existing.remove();
          }
          const subtitleEl = document.createElement("div");
          subtitleEl.className = "rpg-ui-subtitle";
          subtitleEl.textContent = subtitle;
          inlineTitle.after(subtitleEl);
        }
      }, 0);
    });

    this.addSettingTab(new DndSettingsTab(this.app, this));

    // Dev-loop helper: force a reload of every mapped system's compendium
    // bundle and re-render open markdown views. Useful when editing class
    // / subclass / lineage / talent docs and the in-memory system cache
    // hasn't picked the change up yet. Bound to the Command Palette as
    // "RPG UI: Reload systems & re-render" so it can be triggered without
    // restarting Obsidian.
    this.addCommand({
      id: "rpg-ui-reload",
      name: "Reload systems & re-render active views",
      callback: async () => {
        const reg = SystemRegistry.getInstance();
        const systemPaths = new Set<string>();
        for (const sys of reg.getFolderMappings().values()) systemPaths.add(sys);
        for (const sys of systemPaths) reg.invalidateSystem(sys);
        await Promise.all([...systemPaths].map((sys) => this.refreshSystemConsumers(sys)));
      },
    });

    // Diagnostic: dump computed layout info for every `.rpg-rule-side` in
    // the active view. Used to debug glue-to-edge math: prints the
    // resolved values of `--rpg-pane-width`, `--file-line-width`,
    // `--file-margins`, plus computed `width` and `margin-inline-end`
    // for each aside. Output goes to the console so it can be copied
    // verbatim. A short Notice confirms the dump landed.
    this.addCommand({
      id: "rpg-ui-debug-rule-side",
      name: "Debug: dump rule.side layout info",
      callback: () => {
        const asides = Array.from(document.querySelectorAll(".rpg-rule-side")) as HTMLElement[];
        if (asides.length === 0) {
          new Notice("No .rpg-rule-side found in DOM.");
          console.log("[rpg-ui debug] no .rpg-rule-side elements found");
          return;
        }
        const rows = asides.map((aside, i) => {
          const cs = getComputedStyle(aside);
          const pane = aside.closest(
            ".markdown-preview-view, .markdown-reading-view, .markdown-source-view, .cm-editor, .workspace-leaf-content"
          ) as HTMLElement | null;
          const rect = aside.getBoundingClientRect();
          const paneRect = pane?.getBoundingClientRect();
          const variant = aside.classList.contains("rpg-rule-side--commentary")
            ? "commentary"
            : aside.classList.contains("rpg-rule-side--callout")
              ? "callout"
              : "?";
          return {
            i,
            file: this.app.workspace.getActiveFile()?.path ?? "?",
            variant,
            direction: aside.classList.contains("rpg-rule-side--dir-right")
              ? "right"
              : aside.classList.contains("rpg-rule-side--dir-left")
                ? "left"
                : "none",
            paneClass: pane?.className.split(" ").slice(0, 3).join(" ") ?? "(no pane found)",
            paneWidth: paneRect ? Math.round(paneRect.width * 100) / 100 : null,
            paneX: paneRect ? Math.round(paneRect.x * 100) / 100 : null,
            asideRpgPaneWidthInline: aside.style.getPropertyValue("--rpg-pane-width"),
            asideRpgPaneWidthComputed: cs.getPropertyValue("--rpg-pane-width").trim(),
            rpgSideEscape: cs.getPropertyValue("--rpg-side-escape").trim(),
            rpgSidePaddingInline: cs.getPropertyValue("--rpg-side-padding-inline").trim(),
            fileLineWidth: cs.getPropertyValue("--file-line-width").trim(),
            fileMargins: cs.getPropertyValue("--file-margins").trim(),
            computedWidth: cs.width,
            computedMarginInlineEnd: cs.marginInlineEnd,
            computedMarginInlineStart: cs.marginInlineStart,
            computedPaddingInlineStart: cs.paddingInlineStart,
            computedPaddingInlineEnd: cs.paddingInlineEnd,
            asideX: Math.round(rect.x * 100) / 100,
            asideRight: Math.round(rect.right * 100) / 100,
            asideWidth: Math.round(rect.width * 100) / 100,
          };
        });
        console.log("[rpg-ui debug] rule.side layout dump:");
        console.table(rows);
        for (const r of rows) console.log(JSON.stringify(r, null, 2));
        new Notice(`Logged ${rows.length} rule.side block(s) to console.`);
      },
    });
  }

  initDataStore() {
    this.dataStore = new JsonDataStore(this.app.vault, this.settings.statePath);
  }

  onunload() {
    this.refRegistry?.dispose();
    this.refRegistry = null;
    this.refCache?.clear();
    this.refCache = null;
    this.folderLinkStyleManager?.dispose();
    this.folderLinkStyleManager = null;
    this.pageFooterManager?.dispose();
    this.pageFooterManager = null;
    this.pageBannerManager?.dispose();
    this.pageBannerManager = null;
  }

  /** Settings tab hook — re-render every open reading-view footer
   *  after the author edits the field list so changes surface live. */
  refreshPageFooter(): void {
    this.pageFooterManager?.onSettingsChanged();
  }

  /**
   * Re-render every open markdown view whose file lives in a folder mapped
   * to the given system path. Called after a compendium file changes so
   * the freshly-resolved system bundle gets surfaced without requiring a
   * manual reload. Awaits the in-flight system load so the re-render hits
   * the new bundle, not the still-loading one.
   */
  async refreshSystemConsumers(systemFolderPath: string): Promise<void> {
    return refreshSystemConsumers(this.app, systemFolderPath);
  }

  /**
   * Force a full re-render of the markdown preview for a specific file.
   * Called after `patchYamlBlock` writes so sibling entity blocks inside
   * the same note pick up the new YAML — without this, only the block
   * that owns the edit re-renders (via its local `setSelf`), while
   * consumers like `rpg character.features` keep reading the stale
   * `blocks.inventory` snapshot captured at their own mount time.
   *
   * The re-render is fire-and-forget; Obsidian resolves the work on its
   * own tick. Silently skips views that don't expose `previewMode` (the
   * markdown source-mode editor takes a different invalidation path).
   */
  refreshFilePreview(sourcePath: string): void {
    refreshFilePreview(this.app, sourcePath);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.systemMappings = this.normalizeSystemMappings(this.settings.systemMappings);
    this.settings.folderLinkStyles = this.normalizeFolderLinkStyles(this.settings.folderLinkStyles);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    settingsStore.setSettings(this.settings);
    // State-file path change: rebuild the data store and swap it into
    // the long-lived KV instance. Views that captured the KV at plugin
    // load stay valid — `setStore` clears the in-memory cache so the
    // next read comes from the new backing file.
    this.initDataStore();
    if (this.kv) this.kv.setStore(this.dataStore);

    // System mappings change: invalidate every cached system bundle so
    // the entity factory rebuilds from disk on next render. New folder
    // targets get picked up; removed ones stop surfacing. Then force a
    // re-render of every open markdown preview so the settings take
    // effect without a plugin reload.
    const sysRegistry = SystemRegistry.getInstance();
    const mappings = new Map<string, string>();
    for (const mapping of this.settings.systemMappings) {
      for (const folderPath of mapping.folderPaths) {
        mappings.set(folderPath, mapping.systemFolderPath);
      }
    }
    for (const systemPath of new Set(sysRegistry.getFolderMappings().values())) {
      sysRegistry.invalidateSystem(systemPath);
    }
    sysRegistry.setFolderMappings(mappings);
    for (const systemPath of new Set(mappings.values())) {
      sysRegistry.invalidateSystem(systemPath);
    }

    // Folder link styles: regenerate the document-level stylesheet and
    // bump the version so open Live Preview editors re-tag visible
    // anchors on their next update cycle. Reading-mode previews pick
    // the change up via the broad `refreshAllMarkdownPreviews` call
    // below.
    this.folderLinkStylesVersion += 1;
    this.folderLinkStyleManager?.apply(this.settings.folderLinkStyles);

    // Rerender every open markdown preview so each entity block re-
    // mounts and re-reads the fresh settings (state file, system
    // mappings, colour scheme, …). Iterates broadly since mapping
    // changes can make formerly-unmapped notes start (or stop)
    // resolving to a system.
    refreshAllMarkdownPreviews(this.app);
  }

  private normalizeSystemMappings(rawMappings: unknown): DndUIToolkitSettings["systemMappings"] {
    if (!Array.isArray(rawMappings)) return [];
    return rawMappings.map((mapping) => {
      if (!mapping || typeof mapping !== "object") {
        return { folderPaths: [], systemFolderPath: "" };
      }
      const typed = mapping as Record<string, unknown> & {
        folderPath?: string;
        folderPaths?: string[];
        systemFolderPath?: string;
        systemFilePath?: string;
      };
      const folderPaths = Array.isArray(typed.folderPaths)
        ? typed.folderPaths
        : typed.folderPath !== undefined
          ? [typed.folderPath]
          : [];
      // Migrate: if only the old systemFilePath key exists, use it as systemFolderPath
      const systemFolderPath = typed.systemFolderPath ?? typed.systemFilePath ?? "";
      // Preserve any other persisted fields (e.g. `officialSources`) across
      // normalization — stripping the legacy single-path keys so we don't
      // round-trip both shapes. (Previously this rebuilt a bare object and
      // silently dropped `officialSources`, disabling homebrew highlighting.)
      const { folderPath: _legacyFolder, systemFilePath: _legacySys, ...rest } = typed;
      void _legacyFolder;
      void _legacySys;
      return {
        ...rest,
        folderPaths: folderPaths.filter((p) => p !== undefined) as string[],
        systemFolderPath,
      } as DndUIToolkitSettings["systemMappings"][number];
    });
  }

  /**
   * Coerces persisted folder link styles back into the current shape.
   * Handles the legacy `folderPath: string` form (single-path entries)
   * by lifting it into `folderPaths: [folderPath]`, and fills in an
   * `id` when one is missing so older vaults stay functional after the
   * schema change. Entries that end up with no usable paths are kept
   * (the user can edit them) — we only drop structurally broken
   * items.
   */
  private normalizeFolderLinkStyles(raw: unknown): DndUIToolkitSettings["folderLinkStyles"] {
    if (!Array.isArray(raw)) return [];
    const out: DndUIToolkitSettings["folderLinkStyles"] = [];
    for (let i = 0; i < raw.length; i++) {
      const entry = raw[i];
      if (!entry || typeof entry !== "object") continue;
      const typed = entry as {
        id?: string;
        folderPath?: string;
        folderPaths?: string[];
        [k: string]: unknown;
      };
      const folderPaths: string[] = Array.isArray(typed.folderPaths)
        ? typed.folderPaths.filter((p): p is string => typeof p === "string")
        : typeof typed.folderPath === "string"
          ? [typed.folderPath]
          : [];
      const id = typeof typed.id === "string" && typed.id.length > 0 ? typed.id : `style-${i + 1}`;
      // Strip the legacy `folderPath` key so we don't persist both shapes.
      const { folderPath: _legacy, ...rest } = typed;
      void _legacy;
      out.push({ ...rest, id, folderPaths } as DndUIToolkitSettings["folderLinkStyles"][number]);
    }
    return out;
  }
}

/**
 * Force a full re-render of the markdown preview for a specific file.
 * Called after `patchYamlBlock` writes so sibling entity blocks inside
 * the same note pick up the new YAML — without this, only the block
 * that owns the edit re-renders (via its local `setSelf`), while
 * consumers like `rpg character.features` keep reading the stale
 * `blocks.inventory` snapshot captured at their own mount time.
 */
/**
 * Invalidate a system bundle and rerender every open markdown preview
 * for files that map to that system. Mirrors the plugin-method form so
 * helpers running outside the plugin instance (`patchForeignBlock` from
 * an entity-block wrapper) can drive the same refresh path.
 */
async function refreshSystemConsumers(app: App, systemFolderPath: string): Promise<void> {
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
  app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view as unknown as {
      getViewType?: () => string;
      file?: { path?: string };
      previewMode?: {
        rerender?: (full?: boolean) => void;
        containerEl?: HTMLElement;
      };
      containerEl?: HTMLElement;
    };
    if (typeof view.getViewType !== "function") return;
    if (view.getViewType() !== "markdown") return;
    const path = view.file?.path;
    if (!path || !inMappedFolder(path)) return;
    rerenderWithScrollRestore(view);
  });
}

/**
 * Per-preview snapshots used to coalesce back-to-back `rerender(true)`
 * calls. A single user gesture can fire two refreshes (the local
 * `refreshFilePreview` followed by the cross-system
 * `refreshSystemConsumers`); without this map the second call would
 * re-snapshot a partially-restored scrollTop and lock the page near
 * the top of the sheet. Entries expire when the window elapses so a
 * future, unrelated gesture starts from a fresh capture.
 */
const scrollRestoreSnapshots: WeakMap<HTMLElement, { savedScrollTop: number; expiresAt: number }> = new WeakMap();

/**
 * Wrap a `previewMode.rerender(true)` call so the user's scroll
 * position survives the destructive rerender. Snapshots `scrollTop`
 * before tearing the DOM down (or reuses the snapshot from a
 * recent sibling refresh — see `scrollRestoreSnapshots`), then
 * re-applies it on every animation frame inside the configured
 * window. `block-language-rpg` post-processors mount React
 * asynchronously, growing `scrollHeight` after the initial paint,
 * so a single one-shot restore lands too early and the browser
 * caps `scrollTop` short. The polling loop keeps re-asserting the
 * saved value until the configured window expires.
 *
 * Window length is read live from `settingsStore` so a settings save
 * takes effect on the next refresh without needing this helper to be
 * re-wired.
 */
function rerenderWithScrollRestore(view: {
  previewMode?: { rerender?: (full?: boolean) => void; containerEl?: HTMLElement };
  containerEl?: HTMLElement;
}): void {
  const previewEl =
    view.previewMode?.containerEl?.querySelector?.(".markdown-preview-view") ??
    view.containerEl?.querySelector?.(".markdown-preview-view");
  const settings = settingsStore.getSettings();
  const windowMs =
    typeof settings?.scrollRestoreDelayMs === "number" && settings.scrollRestoreDelayMs >= 0
      ? settings.scrollRestoreDelayMs
      : 600;
  const now = performance.now();
  let savedScrollTop = 0;
  if (previewEl instanceof HTMLElement) {
    const existing = scrollRestoreSnapshots.get(previewEl);
    if (existing && existing.expiresAt > now) {
      // Back-to-back refresh — the first call's polling loop is still
      // restoring scrollTop, so a fresh snapshot here would capture an
      // intermediate value (often 0, if the previous rerender just
      // fired and the next polling tick hasn't run yet). Reuse the
      // original target instead.
      savedScrollTop = existing.savedScrollTop;
    } else {
      savedScrollTop = previewEl.scrollTop;
      scrollRestoreSnapshots.set(previewEl, {
        savedScrollTop,
        expiresAt: now + windowMs,
      });
    }
  }
  try {
    view.previewMode?.rerender?.(true);
  } catch {
    return;
  }
  if (!(previewEl instanceof HTMLElement) || savedScrollTop <= 0) return;
  const startedAt = performance.now();
  const tick = (): void => {
    if (previewEl.scrollTop !== savedScrollTop) {
      previewEl.scrollTop = savedScrollTop;
    }
    if (performance.now() - startedAt < windowMs) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

function refreshFilePreview(app: App, sourcePath: string): void {
  app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view as unknown as {
      getViewType?: () => string;
      file?: { path?: string };
      previewMode?: { rerender?: (full?: boolean) => void; containerEl?: HTMLElement };
      containerEl?: HTMLElement;
    };
    if (typeof view.getViewType !== "function") return;
    if (view.getViewType() !== "markdown") return;
    if (view.file?.path !== sourcePath) return;
    rerenderWithScrollRestore(view);
  });
}

/**
 * Rerender every open markdown preview. Called after a plugin-settings
 * save so system-mapping and state-file-path changes land without a
 * manual reload — the previous mappings may have decided which notes
 * even resolved to a system, so we can't scope the refresh to one
 * folder the way `refreshSystemConsumers` does.
 */
function refreshAllMarkdownPreviews(app: App): void {
  app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view as unknown as {
      getViewType?: () => string;
      previewMode?: { rerender?: (full?: boolean) => void };
    };
    if (typeof view.getViewType !== "function") return;
    if (view.getViewType() !== "markdown") return;
    try {
      view.previewMode?.rerender?.(true);
    } catch {
      // No previewMode on this view — skip it.
    }
  });
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
    sectionInfo: MarkdownSectionInformation | null
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
      const { yaml, text } = splitFenceBody(this.source);
      const parsed = parseYaml(yaml);
      const fm = this.app.metadataCache.getCache(this.sourcePath)?.frontmatter ?? {};
      // Merge frontmatter into the block props so components can access global
      // file-level fields (e.g., xp) via `self.xp` while allowing the block
      // to override those values when supplied.
      const blockParsed: Record<string, unknown> =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      const initialSelf: Record<string, unknown> = { ...(fm as Record<string, unknown>), ...blockParsed };
      if (text !== undefined && !("text" in blockParsed)) {
        initialSelf.text = text;
      }
      // Mark blocks whose own `source` differs from the file's — signals
      // homebrew content from a different book/system. The merge above
      // lets blockParsed.source override fm.source, but the component
      // can't distinguish "inherited from file" vs "block-specific" without
      // this flag.
      // Homebrew flag. When the file's system declares official sources, that
      // setting decides (a note whose `source:` matches none of the official
      // patterns is homebrew) — the same global signal list blocks use.
      // Otherwise fall back to the block-vs-file source diff. The `rpg-homebrew`
      // class drives the diagonal hatch so feature/entity blocks (e.g. talents)
      // flag homebrew consistently with rule blocks.
      const effectiveSource = "source" in blockParsed ? blockParsed.source : fm.source;
      const hbBySetting = homebrewBySetting(effectiveSource, this.sourcePath);
      const isHomebrewBlock =
        hbBySetting !== null
          ? hbBySetting
          : "source" in blockParsed && blockParsed.source !== fm.source;
      if (isHomebrewBlock) {
        initialSelf.$homebrew = true;
        this.containerEl.classList.add("rpg-homebrew");
      }
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
              patchYamlBlock(app, sourcePath, entityType, blockName, key, newValue, sectionInfo ?? undefined)
                .then(async () => {
                  // Kick a full preview re-render so sibling blocks in
                  // this note re-read the patched YAML. Without this only
                  // the calling block updates (via its own setSelf); e.g.
                  // the features/traits view keeps rendering a stale
                  // `blocks.inventory` snapshot until plugin reload.
                  refreshFilePreview(app, sourcePath);
                  // If the patched file belongs to a system bundle (it
                  // sits under a folder mapping — e.g. an `rpg item.container`
                  // file that other character sheets reference via
                  // `lookup.$containers`), also invalidate that system and
                  // refresh its consumers. Without this a toggle on
                  // Kowyn's Bag's own page would update the bag preview
                  // but leave every open carrier sheet showing the stale
                  // `for_sale` state until plugin reload. Mirrors
                  // `patchForeignBlock` so local + foreign UI patches share
                  // the same propagation contract.
                  const reg = SystemRegistry.getInstance();
                  const affectedSystem = reg.findSystemFolderForFile(sourcePath);
                  if (affectedSystem) {
                    reg.invalidateSystem(affectedSystem);
                    await refreshSystemConsumers(app, affectedSystem);
                  }
                })
                .catch((err) => console.error("RPG UI: yaml patch failed:", err));
              return { ...prev, [key]: newValue };
            });
          };

          const setters: Record<string, unknown> = {};
          for (const key of Object.keys(self)) {
            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            setters[setterName] = makeSetter(key);
          }

          // Cross-file fence write. Lets a block reach a fence in
          // another vault file (e.g. a `rpg item.container` referenced
          // from a character's inventory) without taking a hard
          // dependency on Obsidian. Refreshes the foreign file's
          // own preview AND invalidates the system bundle that owns
          // the foreign file so consumer character sheets re-read the
          // freshly-patched lookup data on their next render — without
          // this the carrier's inventory would keep showing the stale
          // `for_sale` state until the plugin reloaded.
          const patchForeignBlock = async (
            path: string,
            entity: string,
            block: string,
            key: string,
            value: unknown
          ): Promise<void> => {
            try {
              await patchYamlBlock(app, path, entity, block, key, value);
              refreshFilePreview(app, path);
              const reg = SystemRegistry.getInstance();
              const foreignSystem = reg.findSystemFolderForFile(path);
              if (foreignSystem) {
                reg.invalidateSystem(foreignSystem);
                await refreshSystemConsumers(app, foreignSystem);
              }
            } catch (err) {
              console.error("RPG UI: foreign yaml patch failed:", err);
            }
          };
          setters.patchForeignBlock = patchForeignBlock;

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
          // Track which blocks were authored as their own fence vs. left
          // empty so the post-pass below can alias missing sub-blocks
          // back to the merged `character.sheet` body when appropriate.
          const authored = new Set<string>();
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
              authored.add(bn);
            } else {
              blocksObj[bn] = {};
            }
          }
          // Composite-sheet aliasing: when an author bundles header /
          // health / stats / senses / skills / rolls / proficiencies
          // into a single `rpg character.sheet` fence, the sub-block
          // entries above land as empty placeholders. Cross-block reads
          // (`blocks.header.classes`, `blocks.stats.STR`, expressions like
          // `CharacterLevel`) then look at the empty placeholder instead
          // of the merged body and silently report 0 / no-class. Alias
          // every absent sub-block to the sheet body so the placeholder
          // path resolves to the real data.
          if (blockNames.includes("sheet") && authored.has("sheet")) {
            const sheetBody = blocksObj["sheet"];
            for (const bn of ["header", "health", "stats", "senses", "skills", "rolls", "proficiencies"]) {
              if (blockNames.includes(bn) && !authored.has(bn)) {
                blocksObj[bn] = sheetBody;
              }
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
