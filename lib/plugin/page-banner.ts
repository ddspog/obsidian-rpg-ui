/**
 * Page banner — renders a behind-title image from a frontmatter field.
 *
 * Works on ANY note with the configured property (no cssclass gate).
 * The image sits behind the page title area with a dark gradient scrim
 * for text readability. Height is fixed (configurable in settings).
 *
 * Supports:
 *   - Vault image paths (e.g. `assets/banner.png`)
 *   - Obsidian resource links (e.g. `![[banner.png]]` stripped to path)
 *   - External URLs (https://...)
 */

import { App, EventRef, MarkdownView, TFile } from "obsidian";
import type { DndUIToolkitSettings } from "../../settings";

export interface BannerManagerHost {
  app: App;
  settings: DndUIToolkitSettings;
  registerEvent: (ref: EventRef) => void;
}

const BANNER_CLASS = "rpg-page-banner";
const BANNER_ATTR = "data-rpg-banner";

export class PageBannerManager {
  private host: BannerManagerHost;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: BannerManagerHost) {
    this.host = host;
  }

  start(): void {
    const { app } = this.host;
    this.host.registerEvent(app.workspace.on("active-leaf-change", () => this.scheduleRefresh()));
    this.host.registerEvent(app.workspace.on("layout-change", () => this.scheduleRefresh()));
    this.host.registerEvent(app.workspace.on("file-open", () => this.scheduleRefresh()));
    this.host.registerEvent(
      app.metadataCache.on("changed", () => this.scheduleRefresh())
    );
    app.workspace.onLayoutReady(() => this.scheduleRefresh());
  }

  onSettingsChanged(): void {
    this.refreshAll();
  }

  dispose(): void {
    for (const leaf of this.host.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) this.clearBanner(view);
    }
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.refreshAll();
    }, 100);
  }

  private refreshAll(): void {
    for (const leaf of this.host.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) this.injectForView(view);
    }
  }

  private injectForView(view: MarkdownView): void {
    const file = view.file;
    if (!file) {
      this.clearBanner(view);
      return;
    }

    const { settings, app } = this.host;
    const fieldName = settings.bannerField;
    if (!fieldName) {
      this.clearBanner(view);
      return;
    }

    const cache = app.metadataCache.getCache(file.path);
    const fm = cache?.frontmatter as Record<string, unknown> | undefined;
    const rawValue = fm?.[fieldName];
    if (!rawValue || typeof rawValue !== "string") {
      this.clearBanner(view);
      return;
    }

    const imageUrl = this.resolveImageUrl(rawValue, file);
    if (!imageUrl) {
      this.clearBanner(view);
      return;
    }

    // Per-note height override from frontmatter (falls back to settings)
    const fmHeight = fm?.["bannerHeight"] ?? fm?.["banner-height"];
    const height = typeof fmHeight === "number" && fmHeight > 0
      ? fmHeight
      : settings.bannerHeight;

    // Y-position (vertical crop): number = percentage (0-100), or string for px/em/etc.
    const rawY = fm?.["banner-y"] ?? fm?.["bannerY"];
    let yPos: string;
    if (typeof rawY === "number") {
      yPos = `${Math.max(0, Math.min(100, rawY))}%`;
    } else if (typeof rawY === "string") {
      yPos = rawY;
    } else {
      yPos = "50%";
    }

    // Fade intensity: controls gradient strength (-100 to 100, default 0)
    const rawFade = fm?.["banner-fade"] ?? fm?.["bannerFade"];
    const fade = typeof rawFade === "number" ? rawFade : 0;

    // Border radius
    const rawRadius = fm?.["banner-radius"] ?? fm?.["bannerRadius"];
    const radius = typeof rawRadius === "number" && rawRadius >= 0 ? rawRadius : 0;

    // Content start position (overrides auto-calculation)
    const rawContentStart = fm?.["content-start"] ?? fm?.["contentStart"];
    const contentStart = typeof rawContentStart === "number" && rawContentStart > 0
      ? rawContentStart : undefined;

    // Icon/emoji overlay
    const rawIcon = fm?.["banner-icon"] ?? fm?.["bannerIcon"];
    const icon = typeof rawIcon === "string" && rawIcon.trim() ? rawIcon.trim() : undefined;

    const container = (view as any).containerEl as HTMLElement | undefined;
    if (!container) return;

    const previewView = container.querySelector(".markdown-preview-view") as HTMLElement | null;
    if (!previewView) return;

    let banner = previewView.querySelector(`.${BANNER_CLASS}`) as HTMLElement | null;
    if (banner) {
      if (banner.getAttribute(BANNER_ATTR) === imageUrl) {
        // Update properties in case they changed
        banner.style.setProperty("--rpg-banner-height", `${height}px`);
        banner.style.setProperty("--rpg-banner-y", yPos);
        banner.style.setProperty("--rpg-banner-fade", String(fade));
        if (radius > 0) banner.style.setProperty("--rpg-banner-radius", `${radius}px`);
        else banner.style.removeProperty("--rpg-banner-radius");
        previewView.style.setProperty("--rpg-banner-height", `${height}px`);
        if (contentStart) previewView.style.setProperty("--rpg-banner-content-start", `${contentStart}px`);
        else previewView.style.removeProperty("--rpg-banner-content-start");
        return;
      }
      banner.remove();
    }

    banner = document.createElement("div");
    banner.classList.add(BANNER_CLASS);
    banner.setAttribute(BANNER_ATTR, imageUrl);
    banner.style.setProperty("--rpg-banner-image", `url("${imageUrl}")`);
    banner.style.setProperty("--rpg-banner-height", `${height}px`);
    banner.style.setProperty("--rpg-banner-y", yPos);
    banner.style.setProperty("--rpg-banner-fade", String(fade));
    if (radius > 0) banner.style.setProperty("--rpg-banner-radius", `${radius}px`);

    if (icon) {
      const iconEl = document.createElement("span");
      iconEl.classList.add("rpg-page-banner__icon");
      iconEl.textContent = icon;
      banner.appendChild(iconEl);
    }

    previewView.prepend(banner);
    previewView.classList.add("has-rpg-banner");

    // Set layout vars on the parent (previewView) so children can inherit
    previewView.style.setProperty("--rpg-banner-height", `${height}px`);
    if (contentStart) {
      previewView.style.setProperty("--rpg-banner-content-start", `${contentStart}px`);
    } else {
      previewView.style.removeProperty("--rpg-banner-content-start");
    }
  }

  private clearBanner(view: MarkdownView): void {
    const container = (view as any).containerEl as HTMLElement | undefined;
    if (!container) return;
    const previewView = container.querySelector(".markdown-preview-view") as HTMLElement | null;
    if (!previewView) return;
    const banner = previewView.querySelector(`.${BANNER_CLASS}`);
    if (banner) banner.remove();
    previewView.classList.remove("has-rpg-banner");
  }

  private resolveImageUrl(raw: string, file: TFile): string | null {
    const trimmed = raw.trim();

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }

    // Strip ![[...]] or [[...]] wikilink syntax
    const wikiMatch = trimmed.match(/^!?\[\[([^\]|]+)/);
    const path = wikiMatch ? wikiMatch[1].trim() : trimmed;

    // Resolve via Obsidian's link resolution
    const resolved = this.host.app.metadataCache.getFirstLinkpathDest(path, file.path);
    if (resolved instanceof TFile) {
      return this.host.app.vault.getResourcePath(resolved);
    }

    // Try as a direct vault path
    const direct = this.host.app.vault.getAbstractFileByPath(path);
    if (direct instanceof TFile) {
      return this.host.app.vault.getResourcePath(direct);
    }

    return null;
  }
}
