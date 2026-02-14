/**
 * System registry
 * 
 * Manages the mapping of file paths to RPG systems.
 * In Phase 2, defaults to D&D 5e for all files.
 * Phase 3 will add folder-based system assignment from settings.
 */

import { DND5E_SYSTEM } from "./dnd5e";
import { RPGSystem } from "./types";

/**
 * System registry singleton
 */
export class SystemRegistry {
  private static instance: SystemRegistry;
  private defaultSystem: RPGSystem;
  private folderMappings: Map<string, RPGSystem>;

  private constructor() {
    this.defaultSystem = DND5E_SYSTEM;
    this.folderMappings = new Map();
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
   * Get the system for a given file path
   * 
   * Phase 2: Always returns D&D 5e
   * Phase 3: Will check folder mappings from settings
   * 
   * @param filePath - The file path to resolve system for
   * @returns The RPG system for this file
   */
  public getSystemForFile(filePath: string): RPGSystem {
    // Phase 2: Always return D&D 5e
    // Phase 3 will implement folder-based lookup
    return this.defaultSystem;
  }

  /**
   * Get the default system (D&D 5e)
   */
  public getDefaultSystem(): RPGSystem {
    return this.defaultSystem;
  }

  /**
   * Register a folder-to-system mapping
   * (Will be used in Phase 3)
   * 
   * @param folderPath - The folder path prefix
   * @param system - The system to use for files in this folder
   */
  public registerFolderMapping(folderPath: string, system: RPGSystem): void {
    this.folderMappings.set(folderPath, system);
  }

  /**
   * Clear all folder mappings
   */
  public clearFolderMappings(): void {
    this.folderMappings.clear();
  }

  /**
   * Get all registered folder mappings
   */
  public getFolderMappings(): Map<string, RPGSystem> {
    return new Map(this.folderMappings);
  }
}
