/**
 * System Registry
 * Manages folder-path → RPG system mappings. Caches parsed systems.
 */

import { Vault, TFile } from "obsidian";
import { DND5E_SYSTEM } from "./dnd5e";
import { RPGSystem } from "./types";
import { loadSystemFromTypeScript } from "./ts-loader";
import { loadMarkdownSystem } from "./parser";

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

  public async loadSystemAsync(systemFolderPath: string): Promise<RPGSystem | null> {
    if (!this.vault) return null;
    if (this.systemCache.has(systemFolderPath)) return this.systemCache.get(systemFolderPath)!;
    if (this.isLoading.has(systemFolderPath)) return this.isLoading.get(systemFolderPath)!;

    const loadPromise = systemFolderPath.endsWith(".md")
      ? this.loadMarkdownSystemFromVault(systemFolderPath)
      : loadSystemFromTypeScript(this.vault, systemFolderPath);
    this.isLoading.set(systemFolderPath, loadPromise);
    try {
      const system = await loadPromise;
      if (system) this.systemCache.set(systemFolderPath, system);
      return system;
    } finally {
      this.isLoading.delete(systemFolderPath);
    }
  }

  /**
   * Return the configured system folder path for the given file path, or null
   * if none is configured. This does not attempt to load the system.
   */
  public findSystemFolderForFile(filePath: string): string | null {
    if (!this.vault) return null;
    const parts = filePath.split("/");
    for (let i = parts.length - 1; i >= 0; i--) {
      const folderPath = parts.slice(0, i).join("/");
      const systemPath = this.folderMappings.get(folderPath);
      if (systemPath) return systemPath;
    }
    const rootPath = this.folderMappings.get("");
    return rootPath ?? null;
  }

  /** Read a vault file by path and return its text content, or null if not found. */
  private async readVaultFile(path: string): Promise<string | null> {
    if (!this.vault) return null;
    const file = this.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) return null;
    try {
      return await this.vault.cachedRead(file);
    } catch {
      return null;
    }
  }

  /** Load a markdown system file from the vault. */
  private async loadMarkdownSystemFromVault(filePath: string): Promise<RPGSystem | null> {
    const content = await this.readVaultFile(filePath);
    if (!content) return null;
    return loadMarkdownSystem(content, (path) => this.readVaultFile(path));
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
