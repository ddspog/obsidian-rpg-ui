/**
 * Show block – data resolver
 * Handles resolving data references from system registry and file codeblocks.
 */

import { App, MarkdownPostProcessorContext, TFile, parseYaml } from "obsidian";
import { DataRecord } from "lib/utils/inline-rendering";
import { SystemRegistry } from "lib/systems/registry";
import { parseSkills } from "lib/systems/parser/skills";
import { extractCodeBlocks } from "lib/utils/codeblock-extractor";

/**
 * Resolve a named data reference to a record array.
 * Used by cards and table renderers (attributes only for now).
 */
export async function resolveData(
  app: App,
  dataName: string,
  ctx: MarkdownPostProcessorContext
): Promise<DataRecord[] | null> {
  const system = SystemRegistry.getInstance().getSystemForFile(ctx.sourcePath);
  if (system && dataName === "attributes" && system.attributeDefinitions) {
    return system.attributeDefinitions as DataRecord[];
  }

  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
  if (file instanceof TFile) {
    const content = await app.vault.cachedRead(file);
    const blockPattern = new RegExp(`\`\`\`rpg system\\.${dataName}\\b[\\s\\S]*?\`\`\``, "g");
    const matches = content.match(blockPattern);
    if (matches) {
      for (const match of matches) {
        const blockContent = match.replace(/```rpg system\.\w+\n?/, "").replace(/```$/, "");
        try {
          const parsed = parseYaml(blockContent);
          if (Array.isArray(parsed)) return parsed as DataRecord[];
        } catch {
          // try next match
        }
      }
    }
  }
  return null;
}

/**
 * Resolve a system or inline data source to an entry array.
 * Supports "skills" and "attributes" root keys with optional sub-keys.
 */
export async function resolveSystemData(
  app: App,
  dataPath: string,
  ctx: MarkdownPostProcessorContext
): Promise<any[] | null> {
  const parts = dataPath.split(".");
  const rootKey = parts[0];

  // Check current file first for inline system definitions
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
  if (file instanceof TFile) {
    const content = await app.vault.cachedRead(file);

    if (rootKey === "skills") {
      const inlineSkills = parseSkills(content);
      if (inlineSkills.length > 0) {
        if (parts.length === 1) return inlineSkills;
        if (parts.length === 2) {
          const skillName = parts[1].toLowerCase();
          const skill = inlineSkills.find((s) => s.name.toLowerCase() === skillName);
          return skill ? [skill] : null;
        }
      }
    }
  }

  const system = SystemRegistry.getInstance().getSystemForFile(ctx.sourcePath);

  if (rootKey === "skills") {
    if (parts.length === 1) return system.skills;
    if (parts.length === 2) {
      const skillName = parts[1].toLowerCase();
      const skill = system.skills.find((s) => s.name.toLowerCase() === skillName);
      return skill ? [skill] : null;
    }
  }

  if (rootKey === "attributes") {
    if (parts.length === 1) return system.attributeDefinitions || [];
    if (parts.length === 2) {
      const attrName = parts[1].toLowerCase();
      const attr = system.attributeDefinitions?.find((a) => a.name.toLowerCase() === attrName);
      return attr ? [attr] : null;
    }
  }

  return null;
}
