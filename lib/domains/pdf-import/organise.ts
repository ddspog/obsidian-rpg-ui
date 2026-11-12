/**
 * Where an entity's note goes when the book is imported into a system's
 * folder (the folder that holds `config/`, `compendium/`, `worldbuilding/`),
 * the way that folder is already laid out by hand:
 *
 *   compendium/<book>/                the book's chapters
 *   worldbuilding/spells/<circle>/    cantrips, 1st-circle, 1st-circle-ritual…
 *   worldbuilding/bestiary/animals/           what a druid may turn into (the Animal tag, a druid's list)
 *   worldbuilding/bestiary/creatures/steeds/  what the book prices as a mount
 *   worldbuilding/bestiary/npcs/              the book's own nonplayer characters
 *   worldbuilding/bestiary/monsters/<type>/   everything else, by creature type (beast, humanoid, fiend…)
 *   worldbuilding/bestiary/vehicles/<land|water|air>/
 *   worldbuilding/enchantments/       magic items
 *   worldbuilding/items/weapons/<kind>/, items/armor/<kind>/, items/adventuring-gear/…, items/tools/
 *   worldbuilding/traits/classes|subclasses|lineages|heritages|backgrounds/
 *   worldbuilding/traits/talents/<magic|martial|technical>/
 *   worldbuilding/traits/features/    one traits note a creature type
 */

import { fileName, slug } from "./structure";

export interface PlaceInfo {
  /** A spell's circle as written in its block: `Cantrip`, `2nd-Circle`, `1st-Circle Ritual`. */
  circle?: string;
  /** An item's kind as its table names it (`Simple Melee Weapons`), a creature's type (`Beast`), a vehicle's (`Large Land Vehicle`). */
  type?: string;
  /** A creature the book prices as a mount. */
  steed?: boolean;
  /** What a creature's type line has in brackets: its tags (`Animal`, `Shapechanger`). */
  tags?: string;
  /** A creature's challenge rating, as written (`1/4`, `5`). */
  cr?: string;
  /** The creature sits where the book lists what a druid may turn into. */
  druid?: boolean;
  /** The creature sits where the book lists its nonplayer characters. */
  npc?: boolean;
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
  return `items/adventuring-gear/${slug(t.replace(/\b(adventuring|gear|items?)\b/g, "")) || "general"}`;
};

const rating = (cr: string | undefined): number => {
  const m = (cr ?? "").match(/^(\d+)(?:\/(\d+))?$/);
  return m ? Number(m[1]) / Number(m[2] ?? 1) : NaN;
};

/**
 * - steeds: what the book prices as a mount;
 * - animals: what carries the Animal tag, or sits where the book lists a druid's forms, or, in a
 *   book from outside the system (one given a name mark), a Beast below CR 6;
 * - npcs: what sits in the book's own section of nonplayer characters;
 * - monsters/<type>: everything else, a Beast or a Humanoid included.
 */
const creatureFolder = (info: PlaceInfo, outside: boolean): string => {
  const type = (info.type ?? "").toLowerCase();
  if (info.steed) return "bestiary/creatures/steeds";
  if (/\banimal\b/i.test(info.tags ?? "") || info.druid) return "bestiary/animals";
  if (outside && /\bbeast\b/.test(type) && rating(info.cr) < 6) return "bestiary/animals";
  if (info.npc) return "bestiary/npcs";
  return `bestiary/monsters/${slug(type) || "other"}`;
};

/** The note path (no `.md`), from the vault's root, for an entity of a book imported into `system`. */
export function placer(system: string, book: string, marker = ""): Placer {
  const world = `${system.replace(/\/+$/, "")}/worldbuilding`;
  const mark = marker.trim() ? ` ${marker.trim()}` : "";
  return (kind, title, info, trail) => {
    const name = `${fileName(title)}${mark}`;
    switch (kind) {
      case "spell": {
        const circle = (info.circle ?? "").toLowerCase();
        const folder = /cantrip/.test(circle) ? "cantrips" : slug(circle) || "other";
        return `${world}/spells/${folder}/${name}`;
      }
      case "creature":
        return `${world}/${creatureFolder(info, !!marker.trim())}/${name}`;
      case "vehicle": {
        const medium = (info.type ?? "").toLowerCase().match(/\b(land|water|air|space)\b/)?.[1] ?? "other";
        return `${world}/bestiary/vehicles/${medium}/${name}`;
      }
      case "creature traits":
        // One note a creature type, named for the book so it never meets one written by hand.
        return `${world}/traits/features/${fileName(`${book} ${title} Traits`)}${mark}`;
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
        return `${world}/traits/heritages/${fileName(title.replace(/\s+heritage$/i, ""))}${mark}`;
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
