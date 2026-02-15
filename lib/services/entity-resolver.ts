/**
 * Entity Resolver Service
 * Reads and caches entity data from vault files
 */

import { App, TFile, CachedMetadata } from "obsidian";
import type { Frontmatter } from "lib/types";
import * as Fm from "lib/domains/frontmatter";
import { extractCodeBlocks } from "lib/utils/codeblock-extractor";
import { SystemRegistry } from "lib/systems/registry";

export interface EntityReference {
  file: string; // File path or wiki-link
  type?: string; // Entity type (character, monster, etc.)
  count?: number; // Number of entities (for multiple of the same type)
}

export interface EntityData {
  name: string;
  filePath: string;
  frontmatter: Frontmatter;
  codeBlocks: Map<string, string[]>; // meta -> array of block contents
  exists: boolean;
}

/**
 * Entity Resolver
 * Resolves entity references to data from vault files
 */
export class EntityResolver {
  private cache: Map<string, EntityData> = new Map();
  private app: App;
  private systemRegistry: SystemRegistry;

  constructor(app: App) {
    this.app = app;
    this.systemRegistry = SystemRegistry.getInstance();

    // Listen for file changes to invalidate cache
    this.setupCacheInvalidation();
  }

  /**
   * Setup cache invalidation listeners
   */
  private setupCacheInvalidation(): void {
    // Invalidate cache when a file is modified
    this.app.vault.on("modify", (file) => {
      if (file instanceof TFile) {
        this.invalidateCache(file.path);
      }
    });

    // Invalidate cache when a file is renamed
    this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) {
        this.invalidateCache(oldPath);
        this.invalidateCache(file.path);
      }
    });

    // Invalidate cache when a file is deleted
    this.app.vault.on("delete", (file) => {
      if (file instanceof TFile) {
        this.invalidateCache(file.path);
      }
    });
  }

  /**
   * Invalidate cache for a specific file
   */
  private invalidateCache(filePath: string): void {
    this.cache.delete(filePath);
    console.debug(`Entity cache invalidated for: ${filePath}`);
  }

  /**
   * Invalidate all cache entries
   */
  public invalidateAllCache(): void {
    this.cache.clear();
    console.debug("All entity cache invalidated");
  }

  /**
   * Resolve an entity reference to entity data
   */
  public async resolveEntity(reference: EntityReference): Promise<EntityData> {
    const filePath = this.resolveFilePath(reference.file);

    // Check cache first
    const cached = this.cache.get(filePath);
    if (cached) {
      return cached;
    }

    // Load entity data from file
    const entityData = await this.loadEntityData(filePath);

    // Cache the result
    this.cache.set(filePath, entityData);

    return entityData;
  }

  /**
   * Resolve multiple entity references
   */
  public async resolveEntities(
    references: EntityReference[],
  ): Promise<EntityData[]> {
    const promises = references.map((ref) => this.resolveEntity(ref));
    return Promise.all(promises);
  }

  /**
   * Resolve a file path from various formats
   * Supports:
   * - Absolute paths: "Characters/Elara.md"
   * - Wiki links: "[[Elara]]"
   * - Relative paths with .md extension
   */
  private resolveFilePath(fileRef: string): string {
    // Remove wiki-link syntax if present
    let path = fileRef.replace(/^\[\[/, "").replace(/\]\]$/, "");

    // Add .md extension if not present
    if (!path.endsWith(".md")) {
      path += ".md";
    }

    return path;
  }

  /**
   * Load entity data from a vault file
   */
  private async loadEntityData(filePath: string): Promise<EntityData> {
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file || !(file instanceof TFile)) {
      // File doesn't exist
      return {
        name: this.getNameFromPath(filePath),
        filePath,
        frontmatter: { proficiency_bonus: 2 }, // Default frontmatter
        codeBlocks: new Map(),
        exists: false,
      };
    }

    // Read file content
    const content = await this.app.vault.read(file);

    // Parse frontmatter
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = this.parseFrontmatter(cache);

    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(content);

    return {
      name: file.basename,
      filePath,
      frontmatter,
      codeBlocks,
      exists: true,
    };
  }

  /**
   * Parse frontmatter from cached metadata
   */
  private parseFrontmatter(cache: CachedMetadata | null): Frontmatter {
    if (!cache?.frontmatter) {
      return { proficiency_bonus: 2 }; // Default
    }

    return Fm.anyIntoFrontMatter(cache.frontmatter);
  }

  /**
   * Extract all rpg code blocks from file content
   */
  private extractCodeBlocks(content: string): Map<string, string[]> {
    const blocks = new Map<string, string[]>();

    // List of known block types to extract
    const blockTypes = [
      "attributes",
      "skills",
      "healthpoints",
      "stats",
      "badges",
      "consumable",
      "initiative",
      "spell",
      "events",
      "inventory",
      "features",
    ];

    for (const blockType of blockTypes) {
      const extracted = extractCodeBlocks(content, blockType);
      if (extracted.length > 0) {
        blocks.set(blockType, extracted);
      }
    }

    return blocks;
  }

  /**
   * Get entity name from file path
   */
  private getNameFromPath(filePath: string): string {
    const parts = filePath.split("/");
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.md$/, "");
  }

  /**
   * Get a specific code block from entity data
   */
  public getCodeBlock(
    entityData: EntityData,
    blockType: string,
  ): string | null {
    const blocks = entityData.codeBlocks.get(blockType);
    if (!blocks || blocks.length === 0) {
      return null;
    }
    return blocks[0]; // Return first block of this type
  }

  /**
   * Get all code blocks of a specific type from entity data
   */
  public getCodeBlocks(entityData: EntityData, blockType: string): string[] {
    return entityData.codeBlocks.get(blockType) || [];
  }

  /**
   * Check if entity has a specific code block
   */
  public hasCodeBlock(entityData: EntityData, blockType: string): boolean {
    const blocks = entityData.codeBlocks.get(blockType);
    return blocks !== undefined && blocks.length > 0;
  }
}
