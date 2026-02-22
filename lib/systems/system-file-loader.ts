/**
 * System file loader
 * Loads and parses RPG system definitions from vault markdown files.
 */

import { Vault, TFile, TFolder } from "obsidian";
import { RPGSystem } from "./types";
import { parseSystemFromMarkdown } from "./parser/index";

/**
 * Load and parse a system from a vault file.
 *
 * @param vault - Obsidian vault instance
 * @param systemFilePath - Path to the system markdown file
 * @returns Parsed RPGSystem or null if loading/parsing fails
 */
export async function loadSystemFromVault(
  vault: Vault,
  systemFilePath: string
): Promise<RPGSystem | null> {
  try {
    const file = vault.getAbstractFileByPath(systemFilePath);
    if (!file || !(file instanceof TFile)) {
      console.error(`System file not found: ${systemFilePath}`);
      return null;
    }

    const fileLoader = async (refPath: string): Promise<string | null> => {
      try {
        const refFile = vault.getAbstractFileByPath(refPath);
        if (!refFile || !(refFile instanceof TFile)) {
          console.error(`Referenced file not found: ${refPath}`);
          return null;
        }
        return await vault.cachedRead(refFile as TFile);
      } catch (error) {
        console.error(`Failed to load referenced file ${refPath}:`, error);
        return null;
      }
    };

    const folderLister = async (folderPath: string): Promise<string[]> => {
      try {
        const folder = vault.getAbstractFileByPath(folderPath);
        if (!folder || !(folder instanceof TFolder)) return [];
        return folder.children
          .filter((child): child is TFile => child instanceof TFile && child.extension === "md")
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((f) => f.path);
      } catch {
        return [];
      }
    };

    const content = await vault.cachedRead(file as TFile);
    const system = await parseSystemFromMarkdown(content, fileLoader, folderLister);

    if (!system) {
      console.error(`Failed to parse system from ${systemFilePath}`);
      return null;
    }

    return system;
  } catch (error) {
    console.error(`Failed to load system from ${systemFilePath}:`, error);
    return null;
  }
}
