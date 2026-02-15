/**
 * System registry
 * 
 * Manages the mapping of file paths to RPG systems.
 * Supports folder-based system assignment from settings.
 * Caches parsed systems and invalidates on file changes.
 */

import { Vault, TFile } from "obsidian";
import { DND5E_SYSTEM } from "./dnd5e";
import { RPGSystem } from "./types";
import { parseSystemFromMarkdown } from "./parser";

/**
 * System registry singleton
 */
export class SystemRegistry {
  private static instance: SystemRegistry;
  private defaultSystem: RPGSystem;
  private folderMappings: Map<string, string>; // folder path → system file path
  private systemCache: Map<string, RPGSystem>; // system file path → parsed system
  private vault: Vault | null;
  private isLoading: Map<string, Promise<RPGSystem | null>>; // Track in-progress loads

  private constructor() {
    this.defaultSystem = DND5E_SYSTEM;
    this.folderMappings = new Map();
    this.systemCache = new Map();
    this.vault = null;
    this.isLoading = new Map();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SystemRegistry {
    if (!SystemRegistry.instance) {
      SystemRegistry.instance = new SystemRegistry();
    }
    return SystemRegistry.instance;
  }

  /**
   * Initialize the registry with vault access
   * 
   * @param vault - Obsidian vault for reading system files
   */
  public initialize(vault: Vault): void {
    this.vault = vault;
  }

  /**
   * Set folder-to-system mappings from settings
   * Triggers preloading of all system files
   * 
   * @param mappings - Map of folder paths to system file paths
   */
  public setFolderMappings(mappings: Map<string, string>): void {
    this.folderMappings = new Map(mappings);
    // Clear cache when mappings change
    this.systemCache.clear();
    // Preload all system files in the background
    this.preloadSystems();
  }

  /**
   * Preload all configured system files
   */
  private preloadSystems(): void {
    if (!this.vault) return;

    // Preload each unique system file
    const uniqueSystemFiles = new Set(this.folderMappings.values());
    for (const systemFilePath of uniqueSystemFiles) {
      // Fire and forget - loadSystemAsync will cache the result
      this.loadSystemAsync(systemFilePath);
    }
  }

  /**
   * Get the system for a given file path
   * 
   * Walks up the folder hierarchy to find a matching folder mapping.
   * Returns the mapped system or D&D 5e default.
   * 
   * Note: Systems are preloaded when mappings are set. If a system hasn't
   * finished loading yet, returns D&D 5e default.
   * 
   * @param filePath - The file path to resolve system for
   * @returns The RPG system for this file
   */
  public getSystemForFile(filePath: string): RPGSystem {
    if (!this.vault) {
      return this.defaultSystem;
    }

    // Walk up the folder hierarchy to find a match
    const parts = filePath.split("/");
    
    // Try each folder level from most specific to least specific
    for (let i = parts.length - 1; i >= 0; i--) {
      const folderPath = parts.slice(0, i).join("/");
      const systemFilePath = this.folderMappings.get(folderPath);
      
      if (systemFilePath) {
        const system = this.systemCache.get(systemFilePath);
        if (system) {
          return system;
        }
        // System not loaded yet, trigger async load
        this.loadSystemAsync(systemFilePath);
      }
    }

    // Check root folder mapping ("")
    const rootSystemPath = this.folderMappings.get("");
    if (rootSystemPath) {
      const system = this.systemCache.get(rootSystemPath);
      if (system) {
        return system;
      }
      // System not loaded yet, trigger async load
      this.loadSystemAsync(rootSystemPath);
    }

    return this.defaultSystem;
  }

  /**
   * Get the default system (D&D 5e)
   */
  public getDefaultSystem(): RPGSystem {
    return this.defaultSystem;
  }

  /**
   * Load a system from a file path asynchronously
   * 
   * @param systemFilePath - Path to the system markdown file
   * @returns Promise that resolves to parsed system or null if loading fails
   */
  private async loadSystemAsync(systemFilePath: string): Promise<RPGSystem | null> {
    if (!this.vault) {
      return null;
    }

    // Check cache first
    if (this.systemCache.has(systemFilePath)) {
      return this.systemCache.get(systemFilePath)!;
    }

    // Check if already loading
    if (this.isLoading.has(systemFilePath)) {
      return this.isLoading.get(systemFilePath)!;
    }

    // Start loading
    const loadPromise = this.doLoadSystem(systemFilePath);
    this.isLoading.set(systemFilePath, loadPromise);

    try {
      const system = await loadPromise;
      if (system) {
        this.systemCache.set(systemFilePath, system);
      }
      return system;
    } finally {
      this.isLoading.delete(systemFilePath);
    }
  }

  /**
   * Actually load the system file
   */
  private async doLoadSystem(systemFilePath: string): Promise<RPGSystem | null> {
    if (!this.vault) {
      return null;
    }

    try {
      const file = this.vault.getAbstractFileByPath(systemFilePath);
      if (!file || !(file instanceof TFile)) {
        console.error(`System file not found: ${systemFilePath}`);
        return null;
      }

      // Read file content
      const content = await this.vault.cachedRead(file as TFile);
      const system = parseSystemFromMarkdown(content);
      
      if (!system) {
        console.error(`Failed to parse system from ${systemFilePath}`);
        return null;
      }

      console.log(`Loaded RPG system: ${system.name} from ${systemFilePath}`);
      return system;
    } catch (error) {
      console.error(`Failed to load system from ${systemFilePath}:`, error);
      return null;
    }
  }

  /**
   * Invalidate cache for a specific system file
   * 
   * @param systemFilePath - Path to the system file that changed
   */
  public invalidateSystem(systemFilePath: string): void {
    this.systemCache.delete(systemFilePath);
    // Reload in background
    if (this.folderMappings.has(systemFilePath)) {
      this.loadSystemAsync(systemFilePath);
    }
  }

  /**
   * Clear all cached systems
   */
  public clearCache(): void {
    this.systemCache.clear();
  }

  /**
   * Get all registered folder mappings
   */
  public getFolderMappings(): Map<string, string> {
    return new Map(this.folderMappings);
  }

  /**
   * Register a folder-to-system mapping
   * 
   * @param folderPath - The folder path prefix
   * @param systemFilePath - Path to the system markdown file
   */
  public registerFolderMapping(folderPath: string, systemFilePath: string): void {
    this.folderMappings.set(folderPath, systemFilePath);
    // Clear cache when mappings change
    this.systemCache.clear();
    // Preload the new system
    this.loadSystemAsync(systemFilePath);
  }

  /**
   * Clear all folder mappings
   */
  public clearFolderMappings(): void {
    this.folderMappings.clear();
    this.systemCache.clear();
  }
}
