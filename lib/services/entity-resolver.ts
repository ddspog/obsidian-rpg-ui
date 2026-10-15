/** Entity Resolver Service — reads and caches entity data from vault files */

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

export class EntityResolver {
  /** Parsed entities, with the system their fences were read under. */
  private cache: Map<string, { data: EntityData; system: unknown }> = new Map();
  private app: App;
  private systemRegistry: SystemRegistry;

  constructor(app: App) {
    this.app = app;
    this.systemRegistry = SystemRegistry.getInstance();
    this.setupCacheInvalidation();
  }

  private setupCacheInvalidation(): void {
    this.app.vault.on("modify", (file) => {
      if (file instanceof TFile) this.invalidateCache(file.path);
    });
    this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) {
        this.invalidateCache(oldPath);
        this.invalidateCache(file.path);
      }
    });
    this.app.vault.on("delete", (file) => {
      if (file instanceof TFile) this.invalidateCache(file.path);
    });
  }

  private invalidateCache(filePath: string): void {
    this.cache.delete(filePath);
  }

  public invalidateAllCache(): void {
    this.cache.clear();
  }

  public async resolveEntity(reference: EntityReference): Promise<EntityData> {
    const filePath = this.resolveFilePath(reference.file);
    // Which fences count as entity blocks depends on the file's system. A file
    // read while its system was still loading was parsed under the default
    // one — wrong block names, no entity type — so re-read it once the real
    // system is in place, rather than serving that copy until the file changes.
    const system = this.systemRegistry.getSystemForFile(filePath);
    const cached = this.cache.get(filePath);
    if (cached && cached.system === system) return cached.data;
    const entityData = await this.loadEntityData(filePath);
    this.cache.set(filePath, { data: entityData, system });
    return entityData;
  }

  public async resolveEntities(references: EntityReference[]): Promise<EntityData[]> {
    return Promise.all(references.map((ref) => this.resolveEntity(ref)));
  }

  private resolveFilePath(fileRef: string): string {
    let path = fileRef.replace(/^\[\[/, "").replace(/\]\]$/, "");
    // A wikilink (`[[Talon Pallton]]`) names a note, not a vault-root path, so
    // resolve it the way Obsidian does before falling back to the literal path.
    const linktext = path.split("|")[0].split("#")[0].trim();
    const linked = this.app.metadataCache?.getFirstLinkpathDest?.(linktext, "");
    if (linked instanceof TFile) return linked.path;
    path = linktext;
    if (!path.endsWith(".md")) path += ".md";
    return path;
  }

  private async loadEntityData(filePath: string): Promise<EntityData> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      return {
        name: this.getNameFromPath(filePath),
        filePath,
        frontmatter: { proficiency_bonus: 2 },
        codeBlocks: new Map(),
        exists: false,
      };
    }
    const content = await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    return {
      name: file.basename,
      filePath,
      frontmatter: this.parseFrontmatter(cache),
      codeBlocks: this.extractCodeBlocks(content, filePath),
      exists: true,
    };
  }

  private parseFrontmatter(cache: CachedMetadata | null): Frontmatter {
    if (!cache?.frontmatter) return { proficiency_bonus: 2 };
    return Fm.anyIntoFrontMatter(cache.frontmatter);
  }

  private extractCodeBlocks(content: string, filePath: string): Map<string, string[]> {
    const blocks = new Map<string, string[]>();
    const legacyBlockTypes = [
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
    for (const blockType of legacyBlockTypes) {
      const extracted = extractCodeBlocks(content, blockType);
      if (extracted.length > 0) blocks.set(blockType, extracted);
    }

    // Dynamic entity block types from the system definition
    const system = this.systemRegistry.getSystemForFile(filePath);
    for (const [entityType, entityDef] of Object.entries(system.entities)) {
      for (const blockName of Object.keys(entityDef.blocks ?? {})) {
        const meta = `${entityType}.${blockName}`;
        const extracted = extractCodeBlocks(content, `rpg ${meta}`);
        if (extracted.length > 0) blocks.set(meta, extracted);
      }
    }

    return blocks;
  }

  private getNameFromPath(filePath: string): string {
    return filePath.split("/").pop()!.replace(/\.md$/, "");
  }

  public getCodeBlock(entityData: EntityData, blockType: string): string | null {
    return entityData.codeBlocks.get(blockType)?.[0] ?? null;
  }

  public getCodeBlocks(entityData: EntityData, blockType: string): string[] {
    return entityData.codeBlocks.get(blockType) || [];
  }

  public hasCodeBlock(entityData: EntityData, blockType: string): boolean {
    const blocks = entityData.codeBlocks.get(blockType);
    return blocks !== undefined && blocks.length > 0;
  }
}
