/**
 * Where an entity's note goes when the book is imported into a system's
 * folder (the folder that holds `config/`, `compendium/`, `worldbuilding/`),
 * the way that folder is already laid out by hand:
 *
 *   compendium/<book>/              the book's chapters
 *   worldbuilding/spells/<circle>/  cantrips, 1st-circle, 1st-circle-ritual…
 *   worldbuilding/bestiary/creatures/<book>/
 *   worldbuilding/enchantments/     magic items
 *   worldbuilding/items/weapons/<kind>/, items/armor/<kind>/, items/adventuring-gear/…, items/tools/
 *   worldbuilding/traits/classes|subclasses|lineages|heritages|backgrounds/
 *   worldbuilding/traits/talents/<magic|martial|technical>/
 *   worldbuilding/traits/features/<book>/   creatures' traits and actions
 */

import { fileName, slug } from "./structure";

export interface PlaceInfo {
  /** A spell's circle as written in its block: `Cantrip`, `2nd-Circle`, `1st-Circle Ritual`. */
  circle?: string;
  /** An item's kind as its table names it: `Simple Melee Weapons`, `Light Armor`, `Gear`. */
  type?: string;
}

export type Placer = (kind: string, title: string, info: PlaceInfo, trail: string[]) => string;

const itemFolder = (type: string): string => {
  const t = type.toLowerCase();
  if (/shield/.test(t)) return "items/armor/shields";
  const armor = t.match(/\b(light|medium|heavy)\b.*armor/);
  if (armor) return `items/armor/${armor[1]}`;
  if (/armor/.test(t)) return "items/armor";
  if (/weapon/.test(t)) return `items/weapons/${slug(t.replace(/\bweapons?\b/g, "")) || "other"}`;
  if (/tool/.test(t)) return "items/tools";
  if (/mount|tack|harness|vehicle/.test(t)) return "items/mount-gear";
  return `items/adventuring-gear/${slug(t.replace(/\b(adventuring|gear|items?)\b/g, "")) || "general"}`;
};

/** The note path (no `.md`), from the vault's root, for an entity of a book imported into `system`. */
export function placer(system: string, book: string): Placer {
  const world = `${system.replace(/\/+$/, "")}/worldbuilding`;
  const bookSlug = slug(book);
  return (kind, title, info, trail) => {
    const name = fileName(title);
    switch (kind) {
      case "spell": {
        const circle = (info.circle ?? "").toLowerCase();
        const folder = /cantrip/.test(circle) ? "cantrips" : slug(circle) || "other";
        return `${world}/spells/${folder}/${name}`;
      }
      case "creature":
        return `${world}/bestiary/creatures/${bookSlug}/${name}`;
      case "creature traits":
        return `${world}/traits/features/${bookSlug}/${name}`;
      case "magic item":
        return `${world}/enchantments/${name}`;
      case "item":
        return `${world}/${itemFolder(info.type ?? "")}/${name}`;
      case "class":
        return `${world}/traits/classes/${name}`;
      case "subclass":
        return `${world}/traits/subclasses/${name}`;
      case "lineage":
        return `${world}/traits/lineages/${name}`;
      case "heritage":
        return `${world}/traits/heritages/${name.replace(/\s+heritage$/i, "")}`;
      case "background":
        return `${world}/traits/backgrounds/${name}`;
      case "talent": {
        const group = [...trail].reverse().find((t) => /talents$/i.test(t)) ?? "";
        const folder = slug(group.replace(/\s*talents$/i, ""));
        return `${world}/traits/talents/${folder ? `${folder}/` : ""}${name}`;
      }
      default:
        return `${world}/${slug(kind)}/${name}`;
    }
  };
}
