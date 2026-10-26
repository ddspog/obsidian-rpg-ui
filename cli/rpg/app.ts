/**
 * Bootstraps the plugin's code against a vault on disk: an `app` (vault,
 * metadata cache, a workspace with no open file), the plugin's settings read
 * from its `data.json`, and the TTRPG system loaded as the plugin loads it
 * (bundled from the vault's TypeScript with esbuild). Nothing is written.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SystemRegistry } from "lib/systems/registry";
import type { RPGSystem } from "lib/systems/types";
import type { TFile } from "./obsidian-node";
import { FsMetadataCache, FsVault } from "./vault";

export interface Ctx {
  root: string;
  vault: FsVault;
  metadataCache: FsMetadataCache;
  app: {
    vault: FsVault;
    metadataCache: FsMetadataCache;
    workspace: Record<string, unknown>;
  };
  settings: Record<string, unknown>;
  registry: SystemRegistry;
  /** A note by path or link text, or an error naming it. */
  note(ref: string): TFile;
  /** The system the note is under (loaded), or null. */
  systemFor(path: string): Promise<RPGSystem | null>;
}

/** The vault the CLI reads: `--vault`, else `$RPG_VAULT`, else the vault this plugin sits in. */
export function findVault(flag?: string): string {
  const pick = flag ?? process.env.RPG_VAULT;
  if (pick) return resolve(pick);
  // cli/dist/rpg.cjs (or cli/rpg/*.ts) → the plugin folder → .obsidian/plugins → the vault.
  return resolve(__dirname, "..", "..", "..", "..", "..");
}

export function boot(root: string): Ctx {
  if (!existsSync(root)) throw new Error(`No vault at ${root}`);
  const vault = new FsVault(root);
  const metadataCache = new FsMetadataCache(vault);
  const app = {
    vault,
    metadataCache,
    workspace: { getActiveFile: () => null, on: () => ({}), offref: () => {} },
  };
  (globalThis as Record<string, unknown>).app = app;
  const dataPath = join(root, ".obsidian", "plugins", "obsidian-rpg-ui", "data.json");
  const settings = existsSync(dataPath) ? (JSON.parse(readFileSync(dataPath, "utf8")) as Record<string, unknown>) : {};

  const registry = SystemRegistry.getInstance();
  registry.initialize(vault as never);
  const mappings = new Map<string, string>();
  for (const m of (settings.systemMappings as Array<{ folderPaths?: string[]; systemFolderPath?: string }>) ?? []) {
    for (const folder of m.folderPaths ?? []) if (m.systemFolderPath) mappings.set(folder, m.systemFolderPath);
  }
  // Mappings are set without preloading: a command loads only the system it needs.
  (registry as unknown as { folderMappings: Map<string, string> }).folderMappings = mappings;

  return {
    root,
    vault,
    metadataCache,
    app,
    settings,
    registry,
    note(ref: string): TFile {
      const clean = ref.replace(/^\.\//, "");
      const f = vault.getFileByPath(clean) ?? vault.getFileByPath(`${clean}.md`) ?? vault.resolveLink(clean);
      if (!f) throw new Error(`No note "${ref}" in ${root}`);
      return f;
    },
    async systemFor(path: string) {
      const folder = registry.findSystemFolderForFile(path);
      if (!folder) return null;
      return registry.loadSystemAsync(folder);
    },
  };
}
