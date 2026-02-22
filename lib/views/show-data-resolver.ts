/**
 * Show block – data resolver
 * Handles resolving data references from system registry.
 */

import { App, MarkdownPostProcessorContext } from "obsidian";
import { DataRecord } from "lib/utils/inline-rendering";
import { SystemRegistry } from "lib/systems/registry";

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
