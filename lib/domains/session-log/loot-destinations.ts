/**
 * Where loot can go: a party member, or a container one of them carries —
 * at any depth — each with the address an `[Inv:]` tag writes it by:
 *
 *   Talon                      → [Inv:Talon/[[Arrows]]+1]
 *   Talon's Pouch              → [Inv:Talon/Pouch/[[Sling bullets]]+5]
 *   Kowyn's Bag                → [Inv:Kowyn's Bag/[[Pouch]]+1]
 *   Kowyn's Bag › Quiver       → [Inv:Kowyn's Bag/Quiver/[[Arrows]]+3]
 *
 * A container is what can hold things: an entry flagged `container:` or
 * holding `contents:` on the sheet, or an item whose note is a container — an
 * element with `container:` (a Pouch, a Quiver) or an `rpg item.container`
 * note of its own (Kowyn's Bag). That last one is NAMED: it's addressed by its
 * name alone, wherever it's carried. A sheet's `label:` names any other.
 */

export interface LootDestination {
  /** The tag's address, joined (`Talon/Pouch`). */
  key: string;
  /** How the form shows it (`Talon's Pouch`, `Kowyn's Bag › Quiver`). */
  label: string;
  /** The tag's address segments, before the item. */
  path: string[];
  /** The party member carrying it. */
  carrier: string;
}

/** An inventory entry, as a sheet or a container note writes it. */
export interface CarriedEntry {
  name: string;
  label?: string;
  /** What the sheet says of it (`Jacqui's Quick Access`) — to tell two apart. */
  notes?: string;
  container?: string;
  /** How many (`qty: 19` arrows). */
  qty?: number;
  contents?: CarriedEntry[];
}

/** What an item's note says about holding things. */
export interface ContainerNote {
  /** An `rpg item.container` note of its own — addressed by `name`. */
  named?: { name: string; items: CarriedEntry[] };
  /** An element that holds things (`container:`). */
  holds?: boolean;
  /** The ammunition it's made for, and how many it holds (a Quiver's 20 arrows). */
  forAmmo?: string[];
  ammoCap?: number | Record<string, number>;
}

/** `[[Pouch|a pouch]]` → `Pouch`. */
export const itemStem = (name: string) =>
  name
    .trim()
    .replace(/^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/, "$1")
    .split("/")
    .pop()!
    .trim();

/** Every destination the party's sheets offer, members first, each followed by what they carry. */
export function lootDestinations(
  members: Array<{ name: string; items: CarriedEntry[] }>,
  noteOf: (stem: string) => ContainerNote | undefined
): LootDestination[] {
  const out: LootDestination[] = [];
  const labels = new Map<string, number>();
  const named = new Set<string>();
  const add = (d: Omit<LootDestination, "key">) => {
    // The same name twice (two Backpacks): told apart by a count — a `label:` names them better.
    const n = (labels.get(d.label) ?? 0) + 1;
    labels.set(d.label, n);
    out.push({ ...d, key: d.path.join("/"), label: n > 1 ? `${d.label} #${n}` : d.label });
  };
  const walk = (entries: CarriedEntry[], path: string[], carrier: string, shown: string | undefined) => {
    for (const entry of entries) {
      const stem = itemStem(entry.name);
      const note = noteOf(stem);
      const own = entry.label?.trim();
      if (note?.named) {
        if (named.has(note.named.name)) continue;
        named.add(note.named.name);
        const at = [note.named.name];
        add({ label: own ?? note.named.name, path: at, carrier });
        walk(note.named.items, at, carrier, own ?? note.named.name);
        continue;
      }
      const holds =
        entry.container === "main" || entry.container === "other" || (entry.contents?.length ?? 0) > 0 || !!note?.holds;
      if (!holds) continue;
      const at = [...path, own ?? stem];
      // Unlabelled, its notes tell it from its twin: `Backpack (Jacqui's Quick Access)`.
      const told = entry.notes?.trim() ? `${stem} (${entry.notes.trim()})` : stem;
      const label = own ?? (shown ? `${shown} › ${told}` : `${carrier}'s ${told}`);
      add({ label, path: at, carrier });
      walk(entry.contents ?? [], at, carrier, label);
    }
  };
  for (const m of members) {
    add({ label: m.name, path: [m.name], carrier: m.name });
    walk(m.items, [m.name], m.name, undefined);
  }
  return out;
}

/** A sheet's or container note's items, as written — bare strings or entries. */
export function carriedEntries(raw: unknown): CarriedEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): CarriedEntry[] => {
    if (typeof r === "string") return [{ name: r }];
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    if (typeof o.name !== "string") return [];
    return [
      {
        name: o.name,
        ...(typeof o.label === "string" ? { label: o.label } : {}),
        ...(typeof o.notes === "string" ? { notes: o.notes } : {}),
        ...(typeof o.container === "string" ? { container: o.container } : {}),
        ...(typeof o.qty === "number" ? { qty: o.qty } : typeof o.quantity === "number" ? { qty: o.quantity } : {}),
        ...(Array.isArray(o.contents) ? { contents: carriedEntries(o.contents) } : {}),
      },
    ];
  });
}
