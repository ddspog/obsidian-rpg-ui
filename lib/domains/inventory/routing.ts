/**
 * Route inventory items into fixed sections.
 *
 * Priority (first match wins):
 *   1. `container: other` → Other Containers
 *   2. `container: main` or `contents` → Main Containers
 *   3. Explicit `section:` override
 *   4. Resolved item type token (Weapons / Armor / Shield)
 *   5. Fallback → Visible
 */

import type { SectionId, YamlItemEntry } from "./schema";
import type { ItemMetadata } from "./item-frontmatter";
import { itemTypeBucket } from "./item-frontmatter";

export const SECTION_ORDER: SectionId[] = [
  "weapons",
  "armor",
  "tools",
  "visible",
  "main_containers",
  "other_containers",
];

export const SECTION_LABELS: Record<SectionId, string> = {
  weapons: "Weapons",
  armor: "Armor",
  tools: "Tools",
  visible: "Visible",
  main_containers: "Main Containers",
  other_containers: "Other Containers",
};

export function classifyItem(
  entry: YamlItemEntry,
  meta: ItemMetadata,
): SectionId {
  if (entry.container === "other") return "other_containers";
  if (entry.container === "main") return "main_containers";
  if (entry.contents && entry.contents.length > 0) return "main_containers";
  if (entry.section) return entry.section;
  const bucket = itemTypeBucket(meta.type);
  if (bucket === "weapon") return "weapons";
  if (bucket === "armor") return "armor";
  if (bucket === "tool") return "tools";
  return "visible";
}

export function isContainerEntry(entry: YamlItemEntry): boolean {
  return (
    entry.container === "main" ||
    entry.container === "other" ||
    (Array.isArray(entry.contents) && entry.contents.length > 0)
  );
}
