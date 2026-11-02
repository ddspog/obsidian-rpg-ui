/**
 * Creativity prompts down the margin of a reading-view note, as a book of tables prints a strip of words
 * along its page edge to spark ideas. Notes in a folder of `settings.marginPrompts` show prompts from that
 * set's note (one a line), picked by the note's path so a page shows the same ones each time.
 *
 * Like the page footer, the strip is put straight into the reading view (not by a post-processor: it
 * belongs to the page, not to a section, and virtualised sections come and go). It sits in the margin
 * beside the text column, so a pane with no margin to spare (a phone, a narrow split) shows none.
 */
import { App, MarkdownView, TFile } from "obsidian";
import type { DndUIToolkitSettings } from "settings";
import { parsePrompts, pickPrompts, promptSourceFor } from "lib/domains/margin-prompts/prompts";

const STRIP_CLASS = "rpg-margin-prompts";
/** Vertical space a prompt takes, in px: about one every three paragraphs. */
const SPACING = 26;
/** Margin width under which no strip is drawn. */
const MIN_ROOM = 130;
/** Space kept between the strip and the pane's right border. */
const EDGE = 16;

export interface MarginPromptsHost {
  app: App;
  settings: DndUIToolkitSettings;
  registerEvent(ref: unknown): void;
}

export class MarginPromptsManager {
  private host: MarginPromptsHost;
  private words = new Map<string, string[]>();
  private observers = new Map<HTMLElement, ResizeObserver>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: MarginPromptsHost) {
    this.host = host;
  }

  start(): void {
    const { app } = this.host;
    const again = () => this.schedule();
    this.host.registerEvent(app.workspace.on("active-leaf-change", again));
    this.host.registerEvent(app.workspace.on("layout-change", again));
    this.host.registerEvent(app.workspace.on("file-open", again));
    this.host.registerEvent(app.workspace.on("resize", again));
    this.host.registerEvent(
      app.vault.on("modify", (f) => {
        if (f instanceof TFile && this.words.has(f.path)) {
          this.words.delete(f.path);
          this.schedule();
        }
      })
    );
    // a note's `margin-prompts` property changed: draw again
    this.host.registerEvent(app.metadataCache.on("changed", again));
    app.workspace.onLayoutReady(again);
  }

  /** The settings tab changed the sets: draw every open note again. */
  onSettingsChanged(): void {
    this.words.clear();
    this.schedule();
  }

  dispose(): void {
    for (const leaf of this.host.app.workspace.getLeavesOfType("markdown"))
      if (leaf.view instanceof MarkdownView) this.clear(leaf.view.containerEl);
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      for (const leaf of this.host.app.workspace.getLeavesOfType("markdown"))
        if (leaf.view instanceof MarkdownView) void this.draw(leaf.view);
    }, 120);
  }

  private async prompts(path: string): Promise<string[]> {
    const cached = this.words.get(path);
    if (cached) return cached;
    const file = this.host.app.vault.getAbstractFileByPath(path);
    const list = file instanceof TFile ? parsePrompts(await this.host.app.vault.cachedRead(file)) : [];
    this.words.set(path, list);
    return list;
  }

  private async draw(view: MarkdownView): Promise<void> {
    const file = view.file;
    const preview = (view as unknown as { previewMode?: { containerEl?: HTMLElement } }).previewMode?.containerEl;
    const scroller = preview?.querySelector<HTMLElement>(".markdown-preview-view") ?? null;
    // A note can turn its prompts on or off, or name its own prompts note (`margin-prompts:`).
    const property = file ? this.host.app.metadataCache.getFileCache(file)?.frontmatter?.["margin-prompts"] : undefined;
    const source = file ? promptSourceFor(file.path, this.host.settings.marginPrompts ?? [], property) : undefined;
    const wordsPath =
      source && "link" in source
        ? (this.host.app.metadataCache.getFirstLinkpathDest(source.link, file?.path ?? "")?.path ?? source.link)
        : source?.path;
    if (!file || !scroller || !wordsPath || document.body.classList.contains("is-mobile")) {
      this.clear(view.containerEl);
      return;
    }
    const words = await this.prompts(wordsPath);
    if (words.length === 0) {
      this.clear(view.containerEl);
      return;
    }
    let strip = scroller.querySelector<HTMLElement>(`:scope > .${STRIP_CLASS}`);
    if (!strip) {
      this.clear(view.containerEl);
      strip = scroller.createDiv({ cls: STRIP_CLASS, attr: { "aria-hidden": "true" } });
      const sizer = scroller.querySelector<HTMLElement>(".markdown-preview-sizer");
      const observer = new ResizeObserver(() => this.layout(scroller, strip!, words, file.path));
      observer.observe(scroller);
      if (sizer) observer.observe(sizer);
      this.observers.set(strip, observer);
      // Reading view draws a long note's sections as they scroll in: an aside in the margin may
      // appear later, so the prompts beside it are checked again.
      let queued = false;
      scroller.addEventListener(
        "scroll",
        () => {
          if (queued) return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            if (strip?.isConnected) this.avoidHanging(scroller, strip);
          });
        },
        { passive: true }
      );
    }
    this.layout(scroller, strip, words, file.path);
  }

  /** Place the strip in the margin right of the text column, against the pane's border, prompts one under another down the page, as close as the book prints them. */
  private layout(scroller: HTMLElement, strip: HTMLElement, words: string[], seed: string): void {
    const sizer = scroller.querySelector<HTMLElement>(".markdown-preview-sizer");
    if (!sizer) return;
    const textRight = sizer.offsetLeft + sizer.offsetWidth;
    const room = scroller.clientWidth - textRight - EDGE;
    if (room < MIN_ROOM) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    const gap = Math.min(40, Math.round(room * 0.15));
    const width = Math.min(200, room - gap);
    // against the pane's right border, as a book prints its strip along the page's edge
    strip.style.left = `${scroller.clientWidth - EDGE - width}px`;
    strip.style.width = `${width}px`;
    // as tall as the note's text, not the window: a short note gets a short strip
    const height = sizer.offsetHeight;
    strip.style.height = `${height}px`;
    // about a line of prompt each SPACING px; the strip clips what is past the note's end
    const count = Math.max(1, Math.ceil(height / SPACING));
    const key = `${seed}|${count}|${words.length}`;
    if (strip.dataset.key !== key) {
      strip.dataset.key = key;
      strip.empty();
      for (const text of pickPrompts(words, seed, count)) strip.createSpan({ cls: `${STRIP_CLASS}__item`, text });
    }
    this.avoidHanging(scroller, strip);
  }

  /**
   * Hide the prompts that something of the note's own covers: a box that hangs past the text
   * column into the margin (a book's aside set beside the text, a wide figure).
   */
  private avoidHanging(scroller: HTMLElement, strip: HTMLElement): void {
    const sizer = scroller.querySelector<HTMLElement>(".markdown-preview-sizer");
    if (!sizer || strip.hidden) return;
    const base = strip.getBoundingClientRect();
    const textRight = sizer.getBoundingClientRect().right;
    const hanging: Array<{ top: number; bottom: number }> = [];
    // the note's blocks, and what is drawn beside the column (a page banner across the pane)
    const boxes = [
      ...Array.from(sizer.querySelectorAll<HTMLElement>(":scope > div > *")),
      ...Array.from(
        scroller.querySelectorAll<HTMLElement>(`:scope > :not(.${STRIP_CLASS}):not(.markdown-preview-sizer)`)
      ),
    ];
    boxes.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.right > textRight + 4) hanging.push({ top: r.top - base.top, bottom: r.bottom - base.top });
    });
    strip.querySelectorAll<HTMLElement>(`.${STRIP_CLASS}__item`).forEach((item) => {
      const top = item.offsetTop;
      const bottom = top + item.offsetHeight;
      // hidden but keeping its place, so the prompts after it stay where they are
      item.style.visibility = hanging.some((h) => top < h.bottom + 8 && bottom > h.top - 8) ? "hidden" : "";
    });
  }

  private clear(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>(`.${STRIP_CLASS}`).forEach((el) => {
      this.observers.get(el)?.disconnect();
      this.observers.delete(el);
      el.remove();
    });
  }
}
