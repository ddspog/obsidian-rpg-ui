/**
 * Where an entity's note goes when the book is imported into a system's
 * folder (the folder that holds `config/`, `compendium/`, `worldbuilding/`),
 * the way that folder is already laid out by hand:
 *
 *   compendium/<book>/                the book's chapters
 *   worldbuilding/spells/<circle>/    cantrips, 1st-circle, 1st-circle-ritual…
 *   worldbuilding/bestiary/creatures/<forms>/  companions: Beasts and Animal-tagged creatures by who can
 *                                              turn into them (beast-forms, shifter-forms, spell-forms)
 *   worldbuilding/bestiary/creatures/steeds/   what the book prices as a mount
 *   worldbuilding/bestiary/families/<types>/   monsters and NPCs, by creature type (humanoids, fiends…)
 *   worldbuilding/bestiary/<monsters|npcs>/categories/  an entry's lore, which its stat blocks name as `category`
 *   worldbuilding/bestiary/vehicles/<land|water|air>/
 *   worldbuilding/enchantments/<type>/  magic items, by item type (armor, weapon, wondrous, potion…)
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
  /** The creature has legendary or lair actions, which no druid's form may have. */
  legendary?: boolean;
  /** A subclass's class. */
  parent?: string;
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

/** `humanoid` → `humanoids`, `monstrosity` → `monstrosities`; `fey` and `undead` stay. */
export function typePlural(type: string): string {
  const t = slug(type.replace(/\(.*\)/g, "").replace(/^swarm of \w+ /i, "swarm "));
  if (!t) return "other";
  if (/^(fey|undead)$/.test(t)) return t;
  if (/^swarm/.test(t)) return "swarms";
  if (/y$/.test(t)) return t.replace(/y$/, "ies");
  return `${t}s`;
}

/**
 * - creatures/steeds: what the book prices as a mount;
 * - creatures/beast-forms: a Beast of CR 2 or lower without legendary or lair actions, which any
 *   druid may take the form of;
 * - creatures/shifter-forms: a Beast or Animal-tagged creature of CR 6 or lower, which only a Shifter
 *   druid may take (Potent Forms);
 * - creatures/spell-forms: a Beast or Animal-tagged creature beyond that, reached only by spells;
 * - families/<types>: every other creature, the book's NPCs included, by its type.
 */
const creatureFolder = (info: PlaceInfo): string => {
  const type = (info.type ?? "").toLowerCase();
  if (info.steed) return "bestiary/creatures/steeds";
  const beast = /\bbeasts?\b/.test(type);
  const animal = beast || /\banimal\b/i.test(info.tags ?? "");
  if (animal) {
    const cr = rating(info.cr);
    if (beast && !info.legendary && !(cr > 2)) return "bestiary/creatures/beast-forms";
    if (!info.legendary && !(cr > 6)) return "bestiary/creatures/shifter-forms";
    return "bestiary/creatures/spell-forms";
  }
  return `bestiary/families/${typePlural(type)}`;
};

/** A magic item's folder, by the kind its line names (`Wondrous Item`, `Armor (Plate)`, `Ring`). */
const magicFolder = (type: string): string => {
  const t = type.toLowerCase();
  if (/armor|shield/.test(t)) return "armor";
  if (/weapon|ammunition/.test(t)) return "weapon";
  if (/potion|oil|philter|elixir/.test(t)) return "potion";
  if (/\bring\b/.test(t)) return "ring";
  if (/\b(rod|staff|wand)\b/.test(t)) return "rod-staff-wand";
  if (/scroll/.test(t)) return "scroll";
  return "wondrous";
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
        return `${world}/${creatureFolder(info)}/${name}`;
      case "creature category":
        // An entry's lore, named as the book names the entry, with no mark: its stat blocks link to it.
        return `${world}/bestiary/${info.npc ? "npcs" : "monsters"}/categories/${fileName(title)}`;
      case "vehicle": {
        const medium = (info.type ?? "").toLowerCase().match(/\b(land|water|air|space)\b/)?.[1] ?? "other";
        return `${world}/bestiary/vehicles/${medium}/${name}`;
      }
      case "creature traits":
        // One note a creature type, named for the book so it never meets one written by hand.
        return `${world}/traits/features/${fileName(`${book} ${title} Traits`)}${mark}`;
      case "magic item":
        return `${world}/enchantments/${magicFolder(info.type ?? "")}/${name}`;
      case "item":
        return `${world}/${itemFolder(info.type ?? "")}/${name}`;
      case "class":
        return `${world}/traits/classes/${name}`;
      case "subclass": {
        // Named with its class (`Draconic (Sorcerer)`), so it never meets a language or spell of its name.
        const parent = (info.parent ?? "").replace(/^\d+\.\s*/, "").trim();
        const full = parent && !title.toLowerCase().includes(parent.toLowerCase()) ? `${title} (${parent})` : title;
        return `${world}/traits/subclasses/${fileName(full)}${mark}`;
      }
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
