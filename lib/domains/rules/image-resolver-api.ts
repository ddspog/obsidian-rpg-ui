/**
 * Public API for resolving vault image paths to browser-usable URLs.
 * System config code imports from `"rpg-ui-toolkit"`:
 *
 *   import { resolveVaultImage } from "rpg-ui-toolkit";
 *
 *   banner: {
 *     render: (ctx) => {
 *       const src = resolveVaultImage(ctx.frontmatter.image, ctx.file);
 *       return <img src={src} />;
 *     }
 *   }
 *
 * Internally delegates to a module-level app reference set by the plugin.
 */

import type { App, TFile } from "obsidian";

let app: App | null = null;

export function setImageResolverApp(instance: App | null): void {
  app = instance;
}

/**
 * Resolve a vault image path (wikilink, relative, or absolute URL) to a
 * browser-usable resource URL. Returns `null` if unresolvable.
 */
export function resolveVaultImage(raw: unknown, sourcePath: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const trimmed = raw.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (!app) return null;

  const wikiMatch = trimmed.match(/^!?\[\[([^\]|]+)/);
  const path = wikiMatch ? wikiMatch[1].trim() : trimmed;

  const resolved = app.metadataCache.getFirstLinkpathDest(path, sourcePath);
  if (resolved) {
    return app.vault.getResourcePath(resolved as TFile);
  }

  const direct = app.vault.getAbstractFileByPath(path);
  if (direct) {
    return app.vault.getResourcePath(direct as TFile);
  }

  return null;
}
