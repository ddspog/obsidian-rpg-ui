/**
 * Disk cache for compiled system bundles.
 *
 * Bundling user TypeScript via esbuild-wasm takes ~500ms-2s on cold
 * start. After the first bundle, the output rarely changes — the source
 * .ts files only update when the user (or a plugin update) edits them.
 *
 * This module caches the bundled JS string to disk and validates it on
 * read. Cache key:
 *   - max mtime across every `.ts` / `.tsx` file in the system folder
 *   - plugin manifest version
 *
 * On reload, a fresh cache hit lets us skip esbuild entirely and eval
 * the cached bundle directly. Source edits or plugin upgrades naturally
 * invalidate.
 *
 * Storage: `<plugin>/.system-bundle-cache/<sanitized-path>.{js,meta.json}`.
 * The `.system-bundle-cache` folder is created on first write.
 */

import type { TFile, Vault } from "obsidian";

interface CacheMeta {
  systemPath: string;
  pluginVersion: string;
  sourceMaxMtime: number;
  bundledAt: number;
}

const CACHE_DIR = ".system-bundle-cache";

function sanitizeKey(path: string): string {
  return path.replace(/[/\\:]/g, "_").replace(/[^A-Za-z0-9._-]/g, "");
}

function cachePath(pluginDir: string, systemPath: string, ext: "js" | "meta.json"): string {
  return `${pluginDir}/${CACHE_DIR}/${sanitizeKey(systemPath)}.${ext}`;
}

/** Walk the system folder, returning the max mtime among all .ts/.tsx files. */
export async function getSystemSourceMaxMtime(vault: Vault, systemPath: string): Promise<number> {
  const root = vault.getAbstractFileByPath(systemPath);
  if (!root) return 0;
  let maxMtime = 0;
  const visit = (node: unknown): void => {
    // node may be TFolder (has .children) or TFile (has .stat.mtime).
    const n = node as { children?: unknown[]; stat?: { mtime?: number }; extension?: string };
    if (Array.isArray(n.children)) {
      for (const child of n.children) visit(child);
      return;
    }
    if (n.stat?.mtime != null && (n.extension === "ts" || n.extension === "tsx")) {
      if (n.stat.mtime > maxMtime) maxMtime = n.stat.mtime;
    }
  };
  visit(root);
  return maxMtime;
}

/**
 * Read a cached bundle if its meta matches the current source-mtime +
 * plugin version. Returns null on miss/invalid/IO error.
 */
export async function readBundleCache(
  vault: Vault,
  pluginDir: string,
  systemPath: string,
  pluginVersion: string,
  currentSourceMaxMtime: number
): Promise<string | null> {
  try {
    const metaPath = cachePath(pluginDir, systemPath, "meta.json");
    const jsPath = cachePath(pluginDir, systemPath, "js");
    if (!(await vault.adapter.exists(metaPath)) || !(await vault.adapter.exists(jsPath))) {
      return null;
    }
    const metaText = await vault.adapter.read(metaPath);
    const meta = JSON.parse(metaText) as CacheMeta;
    if (meta.systemPath !== systemPath) return null;
    if (meta.pluginVersion !== pluginVersion) return null;
    if (meta.sourceMaxMtime !== currentSourceMaxMtime) return null;
    return await vault.adapter.read(jsPath);
  } catch {
    return null;
  }
}

/** Write a freshly-bundled system to the cache. Best-effort: failures are logged but don't throw. */
export async function writeBundleCache(
  vault: Vault,
  pluginDir: string,
  systemPath: string,
  pluginVersion: string,
  sourceMaxMtime: number,
  bundleText: string
): Promise<void> {
  try {
    const dir = `${pluginDir}/${CACHE_DIR}`;
    if (!(await vault.adapter.exists(dir))) {
      await vault.adapter.mkdir(dir);
    }
    const meta: CacheMeta = {
      systemPath,
      pluginVersion,
      sourceMaxMtime,
      bundledAt: Date.now(),
    };
    await vault.adapter.write(cachePath(pluginDir, systemPath, "meta.json"), JSON.stringify(meta));
    await vault.adapter.write(cachePath(pluginDir, systemPath, "js"), bundleText);
  } catch (err) {
    console.warn(`bundle-cache write failed for ${systemPath}:`, err);
  }
}

/** Type guard helper used by ts-loader.ts when walking children. */
export function isTFile(x: unknown): x is TFile {
  return !!x && typeof x === "object" && "stat" in (x as object) && "path" in (x as object);
}
