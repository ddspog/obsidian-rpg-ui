/**
 * Compilation Bases View
 *
 * A Bases view that renders each entry's full markdown content in Reading mode,
 * one after the other — compiling small notes into one big readable document.
 *
 * The user controls order & filter via native Bases syntax. The view options
 * control display of: file name (heading level), subtitle (mapped property),
 * file contents, properties, and footer (mapped property).
 *
 * Implementation follows the obsidian-feed-bases pattern: extends BasesView
 * at runtime because the class isn't in the public .d.ts yet.
 */

import { App, Component, MarkdownRenderer, TFile } from "obsidian";

// ── Types (runtime-only, not in .d.ts) ──────────────────────────────────────

/** Minimal shape of a BasesEntry at runtime */
interface BasesEntry {
  file: TFile;
  getValue(propId: string): any;
}

/** Minimal shape of data passed to onDataUpdated */
interface BasesData {
  data: BasesEntry[];
}

/** Minimal shape of the config object on the view */
interface BasesConfig {
  get(key: string): any;
  getSort(): Array<{ property: string; direction: "ASC" | "DESC" }> | null;
  /** Returns the property IDs selected in the native Bases properties selector */
  getOrder(): string[] | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const COMPILATION_VIEW_TYPE = "compilation";

const PAGE_SIZE = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  // Strip common prefixes like "Note.", "File.", etc.
  const cleaned = str.replace(/^\w+\./, "");
  return cleaned
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPropertyDisplayValue(value: any): string {
  if (value == null) return "";
  if (typeof value === "object" && typeof value.toString === "function") {
    const s = value.toString();
    if (s && s !== "[object Object]") return s;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// ── Dynamic BasesView subclass ───────────────────────────────────────────────

let _CompilationViewClass: any = null;

function getBasesViewBase(): any {
  try {
    const obsidian = require("obsidian");
    if (obsidian.BasesView) return obsidian.BasesView;
  } catch {}
  // Minimal stub so the plugin doesn't crash when Bases isn't available
  return class StubBasesView {
    app: App;
    data: BasesData | null = null;
    config: BasesConfig;
    constructor(_controller: any) {
      this.app = _controller?.app ?? (globalThis as any).app;
      this.config = _controller?.config ?? { get: () => undefined, getSort: () => null, getOrder: () => [] };
    }
    load() {}
    unload() {}
    focus() {}
    getEphemeralState() { return {}; }
    setEphemeralState(_s: any) {}
    onResize() {}
  };
}

function buildCompilationViewClass(): any {
  if (_CompilationViewClass) return _CompilationViewClass;

  const BasesViewBase = getBasesViewBase();

  _CompilationViewClass = class CompilationView extends BasesViewBase {
    readonly type = COMPILATION_VIEW_TYPE;

    private scrollEl: HTMLElement;
    private containerEl: HTMLElement;
    private entries: BasesEntry[] = [];
    private renderedCount = 0;
    private renderComponent: Component | null = null;
    private observer: IntersectionObserver | null = null;
    private sentinelEl: HTMLElement | null = null;

    constructor(controller: any, scrollEl: HTMLElement) {
      super(controller);
      this.scrollEl = scrollEl;
      this.containerEl = scrollEl.createDiv({
        cls: "rpg-compilation-container",
        attr: { tabIndex: 0 },
      });
    }

    onload(): void {
      // Lifecycle handled by onDataUpdated
    }

    onunload(): void {
      this.cleanup();
    }

    onResize(): void {
      // Content reflows naturally
    }

    focus(): void {
      this.containerEl.focus({ preventScroll: true });
    }

    onDataUpdated(): void {
      this.update();
    }

    // ── Private ────────────────────────────────────────────────────────────

    private cleanup(): void {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.renderComponent) {
        this.renderComponent.unload();
        this.renderComponent = null;
      }
      this.entries = [];
      this.renderedCount = 0;
      this.sentinelEl = null;
    }

    private update(): void {
      this.cleanup();
      this.containerEl.empty();

      const data = (this as any).data as BasesData | null;
      if (!data || !data.data || data.data.length === 0) {
        this.containerEl.createDiv("rpg-compilation-empty").textContent =
          "No entries to display";
        return;
      }

      // Filter to markdown files only
      this.entries = [...data.data].filter(
        (entry) => entry.file && entry.file.extension === "md",
      );

      if (this.entries.length === 0) {
        this.containerEl.createDiv("rpg-compilation-empty").textContent =
          "No markdown entries found";
        return;
      }

      this.renderComponent = new Component();
      this.renderComponent.load();

      // Render first page
      this.renderedCount = 0;
      this.renderNextPage();

      // Set up infinite scroll sentinel
      if (this.renderedCount < this.entries.length) {
        this.setupInfiniteScroll();
      }
    }

    private renderNextPage(): void {
      const end = Math.min(this.renderedCount + PAGE_SIZE, this.entries.length);
      const config = (this as any).config as BasesConfig | undefined;
      const app = (this as any).app as App;

      const showFileName = (config?.get("showFileName") as boolean | undefined) ?? true;
      // Bases dropdown stores the 0-based index of the selected option.
      // Options: ['h1','h2','h3','h4','h5','h6'] → index 0 = h1, index 1 = h2, …
      const HEADING_OPTIONS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const rawLevel = config?.get("headingLevel");
      const headingLevel = (() => {
        const s = String(rawLevel ?? "");
        // If it's a plain number (0-based index from the dropdown), map it
        const idx = Number(s);
        if (!Number.isNaN(idx) && idx >= 0 && idx < HEADING_OPTIONS.length) {
          return idx + 1; // 0-based index → 1-based heading level
        }
        // If it looks like "hN", extract N
        const match = s.match(/^h(\d)$/i);
        if (match) return Number(match[1]);
        return 3; // default h3
      })();
      const subtitleProp = (config?.get("subtitleProperty") as string | undefined) ?? "";
      const showContent = (config?.get("showContent") as boolean | undefined) ?? true;
      const footerProp = (config?.get("footerProperty") as string | undefined) ?? "";

      // Read properties from the native Bases properties selector
      const propertyNames: string[] = config?.getOrder?.() ?? [];

      for (let i = this.renderedCount; i < end; i++) {
        const entry = this.entries[i];
        this.renderEntry(app, entry, {
          showFileName,
          headingLevel,
          subtitleProp,
          showContent,
          propertyNames,
          footerProp,
        });
      }

      this.renderedCount = end;
    }

    private renderEntry(
      app: App,
      entry: BasesEntry,
      opts: {
        showFileName: boolean;
        headingLevel: number;
        subtitleProp: string;
        showContent: boolean;
        propertyNames: string[];
        footerProp: string;
      },
    ): void {
      const entryEl = this.containerEl.createDiv("rpg-compilation-entry");

      // ── File name (heading) ──
      if (opts.showFileName) {
        const level = Math.max(1, Math.min(6, opts.headingLevel));
        const headerEl = entryEl.createDiv("rpg-compilation-header");
        const heading = document.createElement(`h${level}`);
        heading.className = "rpg-compilation-title";

        // Make it a clickable link to the original note
        const link = document.createElement("a");
        link.className = "rpg-compilation-title-link internal-link";
        link.textContent = entry.file.basename;
        link.href = entry.file.path;
        link.addEventListener("click", (evt) => {
          evt.preventDefault();
          const isNewTab = evt.ctrlKey || evt.metaKey;
          void app.workspace.openLinkText(entry.file.path, "", isNewTab);
        });

        heading.appendChild(link);
        headerEl.appendChild(heading);
      }

      // ── Subtitle ──
      if (opts.subtitleProp) {
        const raw = this.getEntryPropertyValue(entry, opts.subtitleProp);
        if (raw) {
          const subtitleEl = entryEl.createDiv("rpg-compilation-subtitle");
          subtitleEl.createEl("em", { text: getPropertyDisplayValue(raw) });
        }
      }

      // ── File contents (Reading mode markdown) ──
      if (opts.showContent) {
        const contentEl = entryEl.createDiv("rpg-compilation-content markdown-rendered");
        this.renderFileContent(app, entry.file, contentEl);
      }

      // ── Properties ──
      if (opts.propertyNames.length > 0) {
        const propsEl = entryEl.createDiv("rpg-compilation-properties");
        for (const propName of opts.propertyNames) {
          const raw = this.getEntryPropertyValue(entry, propName);
          if (raw == null) continue;
          const value = getPropertyDisplayValue(raw);
          if (!value) continue;

          const propEl = propsEl.createDiv("rpg-compilation-property");
          const labelEl = propEl.createEl("strong");
          labelEl.textContent = `${toTitleCase(propName)}: `;
          propEl.appendText(value);
        }
      }

      // ── Footer ──
      if (opts.footerProp) {
        const raw = this.getEntryPropertyValue(entry, opts.footerProp);
        if (raw) {
          const footerEl = entryEl.createDiv("rpg-compilation-footer");
          footerEl.textContent = getPropertyDisplayValue(raw);
        }
      }
    }

    private getEntryPropertyValue(entry: BasesEntry, propId: string): any {
      try {
        const value = entry.getValue(propId);
        if (!value) return null;
        if (typeof value.isTruthy === "function" && !value.isTruthy()) return null;
        // Try valueOf for primitive extraction
        if (typeof value.valueOf === "function") {
          const v = value.valueOf();
          if (v !== value) return v;
        }
        const str = value.toString?.();
        return str && str.trim().length > 0 ? str : null;
      } catch {
        return null;
      }
    }

    private renderFileContent(app: App, file: TFile, container: HTMLElement): void {
      // Read the file and render as markdown (Reading mode)
      container.createDiv("rpg-compilation-loading").textContent = "Loading…";
      void app.vault.cachedRead(file).then(
        (content) => {
          container.empty();
          if (!content.trim()) {
            container.createDiv("rpg-compilation-empty-content").textContent = "(empty note)";
            return;
          }
          // Strip frontmatter
          const body = content.replace(/^---[\s\S]*?---\n*/, "");
          if (!body.trim()) {
            container.createDiv("rpg-compilation-empty-content").textContent = "(no content after frontmatter)";
            return;
          }
          void MarkdownRenderer.render(
            app,
            body,
            container,
            file.path,
            this.renderComponent ?? new Component(),
          );
        },
        (err) => {
          container.empty();
          container.createDiv("rpg-compilation-error").textContent =
            `Failed to load: ${err}`;
        },
      );
    }

    private setupInfiniteScroll(): void {
      this.sentinelEl = this.containerEl.createDiv("rpg-compilation-sentinel");

      this.observer = new IntersectionObserver(
        (entries) => {
          for (const ioEntry of entries) {
            if (ioEntry.isIntersecting && this.renderedCount < this.entries.length) {
              this.renderNextPage();
              // Remove sentinel & re-add at the end if more pages remain
              if (this.renderedCount >= this.entries.length) {
                this.observer?.disconnect();
                this.sentinelEl?.remove();
              }
            }
          }
        },
        { root: this.scrollEl, rootMargin: "200px" },
      );

      this.observer.observe(this.sentinelEl);
    }
  };

  return _CompilationViewClass;
}

// ── Factory & options (used by main.ts registration) ─────────────────────────

export function compilationFactory(controller: any, containerEl: HTMLElement): any {
  const Cls = buildCompilationViewClass();
  return new Cls(controller, containerEl);
}

export function compilationOptions(): any[] {
  return [
    {
      key: "showFileName",
      type: "toggle",
      displayName: "Show File name",
      default: true,
    },
    {
      key: "headingLevel",
      type: "dropdown",
      displayName: "Heading for File name",
      default: "h3",
      options: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
      ],
    },
    {
      key: "subtitleProperty",
      type: "text",
      displayName: "Subtitle Property",
      default: "",
      description: "Frontmatter property to show as subtitle (e.g. 'subtitle', 'type')",
    },
    {
      key: "showContent",
      type: "toggle",
      displayName: "Show File contents",
      default: true,
    },
    {
      key: "footerProperty",
      type: "text",
      displayName: "Footer Property",
      default: "",
      description: "Frontmatter property to show in footer (e.g. 'source', 'tags')",
    },
  ];
}
