/**
 * System Registry
 * Manages folder-path → RPG system mappings. Caches parsed systems.
 */

import { Vault } from "obsidian";
import { DND5E_SYSTEM } from "./dnd5e";
import { RPGSystem } from "./types";
import { loadSystemFromTypeScript } from "./ts-loader";

export class SystemRegistry {
  private static instance: SystemRegistry;
  private defaultSystem: RPGSystem = DND5E_SYSTEM;
  private folderMappings: Map<string, string> = new Map();
  private systemCache: Map<string, RPGSystem> = new Map();
  private vault: Vault | null = null;
  private isLoading: Map<string, Promise<RPGSystem | null>> = new Map();

  private constructor() {}

  public static getInstance(): SystemRegistry {
    if (!SystemRegistry.instance) {
      SystemRegistry.instance = new SystemRegistry();
    }
    return SystemRegistry.instance;
  }

  public initialize(vault: Vault): void {
    this.vault = vault;
  }

  public setFolderMappings(mappings: Map<string, string>): void {
    this.folderMappings = new Map(mappings);
    this.systemCache.clear();
    this.preloadSystems();
  }

  private preloadSystems(): void {
    if (!this.vault) return;
    const unique = new Set(this.folderMappings.values());
    for (const path of unique) this.loadSystemAsync(path);
  }

  /** Walk up the folder hierarchy to find a matching system, falling back to D&D 5e. */
  public getSystemForFile(filePath: string): RPGSystem {
    if (!this.vault) return this.defaultSystem;

    const parts = filePath.split("/");
    for (let i = parts.length - 1; i >= 0; i--) {
      const folderPath = parts.slice(0, i).join("/");
      const systemPath = this.folderMappings.get(folderPath);
      if (systemPath) {
        const cached = this.systemCache.get(systemPath);
        if (cached) return cached;
        this.loadSystemAsync(systemPath);
      }
    }

    const rootPath = this.folderMappings.get("");
    if (rootPath) {
      const cached = this.systemCache.get(rootPath);
      if (cached) return cached;
      this.loadSystemAsync(rootPath);
    }

    return this.defaultSystem;
  }

  public getDefaultSystem(): RPGSystem {
    return this.defaultSystem;
  }

  private async loadSystemAsync(systemFolderPath: string): Promise<RPGSystem | null> {
    if (!this.vault) return null;
    if (this.systemCache.has(systemFolderPath)) return this.systemCache.get(systemFolderPath)!;
    if (this.isLoading.has(systemFolderPath)) return this.isLoading.get(systemFolderPath)!;

    const loadPromise = loadSystemFromTypeScript(this.vault, systemFolderPath);
    this.isLoading.set(systemFolderPath, loadPromise);
    try {
      const system = await loadPromise;
      if (system) this.systemCache.set(systemFolderPath, system);
      return system;
    } finally {
      this.isLoading.delete(systemFolderPath);
    }
  }

  public invalidateSystem(systemFolderPath: string): void {
    this.systemCache.delete(systemFolderPath);
    if (this.folderMappings.has(systemFolderPath)) this.loadSystemAsync(systemFolderPath);
  }

  public clearCache(): void { this.systemCache.clear(); }

  public getFolderMappings(): Map<string, string> { return new Map(this.folderMappings); }

  public registerFolderMapping(folderPath: string, systemFolderPath: string): void {
    this.folderMappings.set(folderPath, systemFolderPath);
    this.systemCache.clear();
    this.loadSystemAsync(systemFolderPath);
  }

  public clearFolderMappings(): void {
    this.folderMappings.clear();
    this.systemCache.clear();
  }
}
