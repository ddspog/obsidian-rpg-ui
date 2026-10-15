/**
 * Ammunition, counted in pieces: an arrow is an item of its own (its note
 * weighs one, `storage:` says how many come in a bundle), carried in a
 * container that holds so many (a Quiver's `ammo_cap: 20`). The log spends
 * and recovers pieces — `[Inv:Talon/Quiver/[[Arrows]]-1]` — and the Log reads
 * each against its cap: `18/20 Arrows`.
 */

import type { BookkeepingRow } from "./bookkeeping";
import type { InventoryChange } from "./inventory-changes";
import { itemStem, type CarriedEntry, type ContainerNote } from "./loot-destinations";
import type { SidebarItem } from "./prose-model";
import type { ProseSegment } from "./prose-grouper";
import type { InventoryTag, PersistentTag } from "lib/domains/lonelog/types";

/** One stack of ammunition a member carries: how many, the most its container holds. */
export interface AmmoStack {
  qty: number;
  cap?: number;
  /** Where it sits in the sheet's `items:` — each index down through `contents:`. */
  at: number[];
}

/** `talon/quiver/arrows` — owner, containers, item, as an `[Inv:]` tag addresses it. */
export const ammoKey = (owner: string, path: string[] | undefined, item: string) =>
  [owner, ...(path ?? []), item].map((s) => itemStem(s).toLowerCase()).join("/");

/** The cap a container's `ammo_cap` gives this ammunition — one number, or one per kind. */
function capFor(note: ContainerNote | undefined, ammo: string): number | undefined {
  const cap = note?.ammoCap;
  if (typeof cap === "number") return cap;
  if (cap && typeof cap === "object") {
    const hit = Object.entries(cap).find(([k]) => k.toLowerCase() === ammo.toLowerCase());
    return hit ? hit[1] : undefined;
  }
  return undefined;
}

/** Every stack of ammunition a member carries — inside a container that takes it. */
export function carriedAmmo(
  owner: string,
  items: CarriedEntry[],
  noteOf: (stem: string) => ContainerNote | undefined,
  isAmmo: (stem: string) => boolean
): Record<string, AmmoStack> {
  const out: Record<string, AmmoStack> = {};
  const walk = (entries: CarriedEntry[], path: string[], at: number[], holder?: ContainerNote) => {
    entries.forEach((entry, i) => {
      const stem = itemStem(entry.name);
      const takes = holder?.forAmmo?.some((a) => itemStem(a).toLowerCase() === stem.toLowerCase());
      if (path.length > 0 && (takes || isAmmo(stem))) {
        const cap = capFor(holder, stem);
        out[ammoKey(owner, path, stem)] = { qty: entry.qty ?? 1, ...(cap != null ? { cap } : {}), at: [...at, i] };
        return;
      }
      if (entry.contents?.length)
        walk(entry.contents, [...path, entry.label?.trim() || stem], [...at, i], noteOf(stem));
    });
  };
  walk(items, [], []);
  return out;
}

/** The party's ammunition as bookkeeping rows: what the sheet held, what the log leaves. */
export function ammoRows(
  party: Array<{ name: string; page: string; baseline: Record<string, AmmoStack>; sheet: Record<string, AmmoStack> }>,
  changes: InventoryChange[]
): BookkeepingRow[] {
  const rows: BookkeepingRow[] = [];
  for (const c of changes) {
    if (!c.owner || c.delta == null) continue;
    const pc = party.find((p) => p.name.toLowerCase() === c.owner!.toLowerCase());
    if (!pc) continue;
    const key = ammoKey(pc.name, c.path, c.name);
    const was = pc.baseline[key] ?? pc.sheet[key];
    if (!was) continue;
    const sheet = pc.sheet[key]?.qty ?? 0;
    const target = Math.max(0, was.qty + c.delta);
    rows.push({
      who: pc.name,
      page: pc.page,
      kind: "ammo",
      label: c.path?.length ? `${c.name} (${c.path.join(" › ")})` : c.name,
      key,
      from: was.qty,
      sheet,
      target,
      ...(was.cap != null ? { max: was.cap } : {}),
      ok: sheet === target,
    });
  }
  return rows;
}

/** Whether an inventory change is ammunition the bookkeeping counts as a row. */
export const isAmmoChange = (c: InventoryChange, rows: BookkeepingRow[]) =>
  rows.some((r) => r.kind === "ammo" && !!c.owner && r.key === ammoKey(c.owner, c.path, c.name));

/**
 * Each stowed line of ammunition, with what it leaves carried: the sheet's
 * count as the log began, moved by every tag up to it — `−1 Arrows · 18/20`.
 */
export function withAmmoCounts(
  items: SidebarItem[],
  segments: ProseSegment[],
  start: (key: string) => AmmoStack | undefined
): SidebarItem[] {
  const running = new Map<string, number>();
  const after = new Map<number, Map<string, { n: number; cap?: number }>>();
  const tagsOf = (seg: ProseSegment): PersistentTag[] =>
    seg.type === "action-group" || seg.type === "oracle"
      ? seg.consequences.flatMap((c) => c.tags)
      : seg.type === "standalone-consequence"
        ? seg.entry.tags
        : [];
  for (const seg of segments) {
    for (const t of tagsOf(seg)) {
      if (t.kind !== "inventory" || !t.owner || t.delta == null) continue;
      const tag = t as InventoryTag;
      const key = ammoKey(tag.owner!, tag.path, tag.name);
      const base = start(key);
      if (!base) continue;
      const n = Math.max(0, (running.get(key) ?? base.qty) + tag.delta!);
      running.set(key, n);
      if (!after.has(seg.sourceIndex)) after.set(seg.sourceIndex, new Map());
      after.get(seg.sourceIndex)!.set(key, { n, ...(base.cap != null ? { cap: base.cap } : {}) });
    }
  }
  if (after.size === 0) return items;
  return items.map((item) => {
    const counts = after.get(item.id);
    if (!counts) return item;
    return {
      ...item,
      rows: item.rows.map((row) => {
        if (!row.detail || !row.icon || !("lucide" in row.icon) || row.icon.lucide !== "Package" || !row.label)
          return row;
        // The row's place, as its label writes it (`Talon › Quiver`).
        const place = row.label.split(" › ").map((s) => s.toLowerCase());
        const shown = row.content
          .split(" · ")
          .map((part) => {
            const name = part
              .replace(/^[−+-]?\d+\s+|^used up\s+/, "")
              .replace(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/, "$1");
            const hit = counts.get([...place, itemStem(name).toLowerCase()].join("/"));
            return hit ? `${part} (${hit.n}${hit.cap != null ? `/${hit.cap}` : ""} left)` : part;
          })
          .join(" · ");
        return shown === row.content ? row : { ...row, content: shown };
      }),
    };
  });
}
