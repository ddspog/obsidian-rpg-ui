/**
 * Auto-render selected frontmatter fields at the end of every reading-
 * view note. Hooks workspace events + metadata-cache change events so
 * the footer stays in sync with the active file's YAML.
 *
 * Designed for citation-style lines (`source: "From _Tales of the
 * Valiant_ by **Kobold Press**"`): the author stores the attribution
 * with the note's data, the plugin drops it at the bottom of the page,
 * and CSS hides the footer whenever the note is being transcluded —
 * so `![[Foo]]` embeds pull in the content without dragging the source
 * line into the host note. Replaces the old convention of hand-
 * authoring a trailing `**Source**:` line plus a `no-source` class
 * flag on every embed.
 *
 * Implementation note: we mutate the reading-view DOM directly rather
 * than hooking `registerMarkdownPostProcessor`. Post-processors run
 * per rendered section, and "end of file" isn't a section — lazy
 * virtualization would also rip the footer back out when it scrolls
 * off-screen. A one-shot DOM injection keyed to the preview container
 * sidesteps both problems.
 */

import { App, Component, MarkdownRenderer, MarkdownView, TFile } from "obsidian";
import type { DndUIToolkitSettings } from "settings";

/** Class applied to the injected footer wrapper. The embed-hiding
 *  rule (`.markdown-embed .rpg-page-footer { display: none; }`) keys
 *  off this class. */
const FOOTER_CLASS = "rpg-page-footer";

/** Minimal plugin surface the manager needs. Kept narrow so main.ts
 *  can hand the plugin in without circular imports. */
export interface PageFooterHost {
  app: App;
  settings: DndUIToolkitSettings;
  registerEvent(ref: unknown): void;
}

export class PageFooterManager {
  private host: PageFooterHost;
  /** Components created alongside each injected footer so the
   *  MarkdownRenderer calls inside get their cleanup on removal. */
  private components = new WeakMap<HTMLElement, Component>();
  /** Debounce timer so rapid workspace events (layout-change +
   *  active-leaf-change firing in the same tick) collapse into one
   *  injection pass, preventing duplicate footers. */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: PageFooterHost) {
    this.host = host;
  }

  start(): void {
    const { app } = this.host;
    this.host.registerEvent(app.workspace.on("active-leaf-change", () => this.scheduleRefresh()));
    this.host.registerEvent(app.workspace.on("layout-change", () => this.scheduleRefresh()));
    this.host.registerEvent(app.workspace.on("file-open", () => this.scheduleRefresh()));
    this.host.registerEvent(
      app.metadataCache.on("changed", (f) => {
        if (f instanceof TFile) this.scheduleRefresh();
      })
    );
    app.workspace.onLayoutReady(() => this.scheduleRefresh());
  }

  /** Called by the settings tab after the author edits the field
   *  list. Re-injects every open reading-view so removed keys
   *  disappear immediately and new ones surface without a reload. */
  onSettingsChanged(): void {
    this.refreshAll();
  }

  dispose(): void {
    // Clean every still-open footer on plugin unload so stranded
    // Obsidian components don't keep firing lifecycle hooks.
    for (const leaf of this.host.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) this.clearFooter(view);
    }
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const missed = this.refreshAll();
      if (missed > 0) {
        setTimeout(() => this.refreshAll(), 400);
      }
    }, 80);
  }

  private refreshAll(): number {
    let missed = 0;
    for (const leaf of this.host.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        if (!this.injectForView(view)) missed++;
      }
    }
    return missed;
  }

  private injectForView(view: MarkdownView): boolean {
    const file = view.file;
    if (!file) return true;
    // Inject inside `.mod-footer.mod-ui` — Obsidian's own footer
    // container that survives reading-view scroll virtualization.
    // Appending directly to `.markdown-preview-section` gets swept
    // away when Obsidian recalculates visible sections on scroll.
    const modFooter = getModFooter(view);
    if (!modFooter) return false;

    // Clear any prior footer from the entire view (covers stale
    // footers from tab switches or replaced DOM).
    this.clearFooterIn(view.containerEl);

    const fm = this.host.app.metadataCache.getCache(file.path)?.frontmatter ?? {};
    const entries: Array<{ label: string; value: string }> = [];
    for (const field of this.host.settings.pageFooterFields ?? []) {
      const raw = fm[field.key];
      const value = normaliseFooterValue(raw);
      if (!value) continue;
      const label = field.label || capitalize(field.key);
      entries.push({ label, value });
    }
    if (entries.length === 0) return true;

    const footer = document.createElement("div");
    footer.classList.add(FOOTER_CLASS);

    const component = new Component();
    component.load();

    for (const entry of entries) {
      const p = document.createElement("p");
      p.classList.add(`${FOOTER_CLASS}__entry`);
      const strong = document.createElement("strong");
      strong.textContent = `${entry.label}: `;
      strong.classList.add(`${FOOTER_CLASS}__label`);
      p.appendChild(strong);
      const valueEl = document.createElement("span");
      valueEl.classList.add(`${FOOTER_CLASS}__value`);
      p.appendChild(valueEl);
      void renderMarkdownSafe(this.host.app, entry.value, valueEl, file.path, component);
      footer.appendChild(p);
    }

    modFooter.appendChild(footer);
    this.components.set(footer, component);
    return true;
  }

  private clearFooter(view: MarkdownView): void {
    this.clearFooterIn(view.containerEl);
  }

  private clearFooterIn(section: HTMLElement): void {
    const existing = section.querySelectorAll<HTMLElement>(`.${FOOTER_CLASS}`);
    existing.forEach((el) => {
      const comp = this.components.get(el);
      if (comp) {
        comp.unload();
        this.components.delete(el);
      }
      el.remove();
    });
  }
}

function getModFooter(view: MarkdownView): HTMLElement | null {
  const preview = (view as unknown as { previewMode?: { containerEl?: HTMLElement } }).previewMode?.containerEl;
  return preview?.querySelector<HTMLElement>(".mod-footer.mod-ui") ?? null;
}

function normaliseFooterValue(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw)) return raw.map((x) => normaliseFooterValue(x)).filter(Boolean).join(", ");
  return "";
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function renderMarkdownSafe(
  app: App,
  source: string,
  el: HTMLElement,
  sourcePath: string,
  component: Component
): Promise<void> {
  const renderer = MarkdownRenderer as unknown as {
    render?: (app: unknown, md: string, el: HTMLElement, sp: string, c: Component) => Promise<void>;
    renderMarkdown?: (md: string, el: HTMLElement, sp: string, c: Component) => Promise<void>;
  };
  const p =
    typeof renderer.render === "function"
      ? renderer.render(app, source, el, sourcePath, component)
      : renderer.renderMarkdown?.(source, el, sourcePath, component);
  return Promise.resolve(p).catch((err) => {
    console.error("rpg-ui-toolkit page-footer: render failed", err);
  });
}
