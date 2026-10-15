/**
 * The session's bookkeeping — what the log changed on each party member's
 * sheet, and whether the sheet shows it yet:
 *
 *   Talon      HP           10 → 6 / 10       [Update sheet]
 *              Mystic Mark  0 → 1 spent of 2   ✓ on sheet
 *   Kowyn      1st-Circle Slots  1 → 2 spent
 *
 * The log counts from each sheet as it first read it (its BASELINE) — not as
 * the sheet is now, or applying `HP 6` would have the log take the damage off
 * again. Each row is the log's own progress (`from` → `target`); a sheet that
 * shows it is done — and stays done once seen, though later logs move the
 * sheet on (see {@link rowId}).
 */

import type { Health } from "./health";

/** What a sheet holds that a session changes. */
export interface SheetSnapshot {
  hp?: Health;
  /** Experience points (`xp: 88`). */
  xp?: number;
  /** The sheet's other counts a session moves, by the name the log writes:
   *  `Hit Dice` (left), `Exhaustion`, `Luck`, coins (`GP`, `SP`, `CP`…). */
  counters?: Record<string, number>;
  /** Death saves marked (`death_saves: { successes, failures }`). */
  deathSaves?: { successes: number; failures: number };
  /** Uses spent of each feature, by its sheet key (`Druid:Nature's Gift:bonus`). */
  uses: Record<string, number>;
  /** Spell slots spent, by caster and circle (`{ Druid: { "1": 1 } }`). */
  slots: Record<string, Record<string, number>>;
  /** Ammunition carried, in pieces, by `owner/container/item` (`talon/quiver/arrows`). */
  ammo?: Record<string, import("./ammo").AmmoStack>;
}

/** One party member's sheet, as the bookkeeping reads it. */
export interface PartySheet {
  /** The name the log writes (`Talon`). */
  name: string;
  /** Their note (`Talon Pallton`). */
  page: string;
  /** The sheet as it is now. */
  sheet: SheetSnapshot;
  /** The sheet as the log first read it. */
  baseline: SheetSnapshot;
  /** The features with uses to count, as the log names them (`Mystic Mark`). */
  uses: Array<{ key: string; name: string; max?: number; recovery?: string }>;
  /** Its spellcasters with slots, in the sheet's order (`Druid`). */
  casters: string[];
  /** Each caster's slots by circle (index 0 = 1st), as its system counts them. */
  slotMax?: Record<string, number[]>;
  /** The most of each count it keeps (`Hit Dice`: 1). */
  counterMax?: Record<string, number>;
}

export type BookkeepingKind = "hp" | "uses" | "slot" | "saves" | "xp" | "counter" | "ammo" | "note";

/** The counts the bookkeeping writes to their own sheet field. */
export const COUNTERS = ["Hit Dice", "Exhaustion", "Luck", "PP", "GP", "EP", "SP", "CP"];
const counterOf = (resource: string) => COUNTERS.find((c) => c.toLowerCase() === resource.trim().toLowerCase());

/** One thing the log changed on a sheet. */
export interface BookkeepingRow {
  who: string;
  page: string;
  kind: BookkeepingKind;
  /** What it is (`HP`, `Nature's Gift`, `1st-Circle Slots`). */
  label: string;
  /** Where it's written: `current_hp`, a feature's key, or `caster:circle`. */
  key: string;
  /** Its value as the log began (the baseline). */
  from: number;
  /** Its value on the sheet now. */
  sheet: number;
  /** What the log says it should be. */
  target: number;
  /** Its most (HP, uses). */
  max?: number;
  /** A spend it counts (uses, slots): shown as what's left of its most. */
  spends?: boolean;
  /** How much the log spent past what the sheet had (`Hit Dice-1` with none left). */
  short?: number;
  /** Whether the sheet shows it already. */
  ok: boolean;
}

/** `1st-Circle Slot` → 1. */
export function slotCircle(resource: string): number | undefined {
  const m = resource.trim().match(/^(\d+)(?:st|nd|rd|th)-circle slots?$/i);
  return m ? parseInt(m[1], 10) : undefined;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Every change the log made to the party's sheets. `spent` is what the log
 * spent of each resource (`resourcesSpent`: `change` < 0 is spent), `hpEnd`
 * where it leaves each one's hit points (counted from the baseline).
 */
export function bookkeeping(
  party: PartySheet[],
  spent: Array<{ who: string; resource: string; change: number }>,
  hpEnd: (name: string) => Health | undefined
): BookkeepingRow[] {
  const rows: BookkeepingRow[] = [];
  for (const pc of party) {
    const row = (r: Omit<BookkeepingRow, "who" | "page" | "ok">): BookkeepingRow => ({
      who: pc.name,
      page: pc.page,
      ...r,
      ok: r.sheet === r.target,
    });

    // Their hit points, when the log moved them.
    const end = hpEnd(pc.name);
    const was = pc.baseline.hp;
    if (end && was && end.current !== was.current) {
      rows.push(
        row({
          kind: "hp",
          label: "HP",
          key: "current_hp",
          from: was.current,
          sheet: pc.sheet.hp?.current ?? was.current,
          target: end.current,
          max: end.max,
        })
      );
    }

    // Its death saves, when the log moved them: marked while dying, wiped once
    // healed or stable.
    if (end && was) {
      const life = end.life;
      const now =
        life?.state === "dying" || life?.state === "dead"
          ? { successes: life.successes, failures: life.failures }
          : { successes: 0, failures: 0 };
      const from = pc.baseline.deathSaves ?? { successes: 0, failures: 0 };
      const sheetSaves = pc.sheet.deathSaves ?? from;
      for (const [key, label] of [
        ["successes", "Death saves ✓"],
        ["failures", "Death saves ✗"],
      ] as const) {
        if (now[key] === from[key]) continue;
        rows.push(
          row({
            kind: "saves",
            label,
            key,
            from: from[key],
            sheet: sheetSaves[key],
            target: Math.min(3, now[key]),
            max: 3,
          })
        );
      }
    }

    // Experience earned (`[Jacqui/XP+87]` — a fight's share, a reward): onto its `xp:`.
    const earned = spent
      .filter((e) => same(e.who, pc.name) && /^xp$/i.test(e.resource.trim()))
      .reduce((n, e) => n + e.change, 0);
    if (earned !== 0) {
      const base = pc.baseline.xp ?? 0;
      rows.push(
        row({ kind: "xp", label: "XP", key: "xp", from: base, sheet: pc.sheet.xp ?? base, target: base + earned })
      );
    }

    // Counts the sheet keeps as they are — hit dice left, exhaustion, Luck,
    // coins: moved by the log's ±n.
    for (const s of spent.filter((e) => same(e.who, pc.name) && counterOf(e.resource))) {
      const name = counterOf(s.resource)!;
      const base = pc.baseline.counters?.[name] ?? 0;
      const max = pc.counterMax?.[name];
      rows.push(
        row({
          kind: "counter",
          label: name,
          key: name,
          from: base,
          sheet: pc.sheet.counters?.[name] ?? base,
          target: Math.max(0, base + s.change),
          ...(max != null ? { max } : {}),
          ...(base + s.change < 0 ? { short: -(base + s.change) } : {}),
        })
      );
    }

    for (const s of spent.filter(
      (e) => same(e.who, pc.name) && !/^xp$/i.test(e.resource.trim()) && !counterOf(e.resource)
    )) {
      const used = -s.change;
      const circle = slotCircle(s.resource);
      if (circle != null && pc.casters.length > 0) {
        const caster = pc.casters[0];
        const base = pc.baseline.slots[caster]?.[String(circle)] ?? 0;
        const max = pc.slotMax?.[caster]?.[circle - 1];
        rows.push(
          row({
            kind: "slot",
            label: `${s.resource.replace(/\s*slots?$/i, "")} Slots`,
            key: `${caster}:${circle}`,
            from: base,
            sheet: pc.sheet.slots[caster]?.[String(circle)] ?? 0,
            target: Math.max(0, max ? Math.min(max, base + used) : base + used),
            spends: true,
            ...(max ? { max } : {}),
            ...(max && base + used > max ? { short: base + used - max } : {}),
          })
        );
        continue;
      }
      const feature = pc.uses.find((u) => same(u.name, s.resource));
      if (feature) {
        const base = pc.baseline.uses[feature.key] ?? 0;
        const target = Math.max(0, Math.min(feature.max ?? Infinity, base + used));
        rows.push(
          row({
            kind: "uses",
            label: feature.name,
            key: feature.key,
            from: base,
            sheet: pc.sheet.uses[feature.key] ?? 0,
            target,
            spends: true,
            ...(feature.max != null ? { max: feature.max } : {}),
            ...(feature.max != null && base + used > feature.max ? { short: base + used - feature.max } : {}),
          })
        );
        continue;
      }
      // Nothing on the sheet to write it to: shown, to keep by hand.
      rows.push({
        who: pc.name,
        page: pc.page,
        kind: "note",
        label: s.resource,
        key: s.resource,
        from: 0,
        sheet: 0,
        target: used,
        ok: false,
      });
    }
  }
  return rows;
}

/**
 * What the drawer's cards have left — each feature's uses spent, as the log
 * leaves them (its baseline and the log's own `-1`s), by its sheet key.
 */
export function usesSpent(rows: BookkeepingRow[], party: PartySheet[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pc of party) for (const [key, n] of Object.entries(pc.baseline.uses)) out[key] = n;
  for (const r of rows) if (r.kind === "uses") out[r.key] = r.target;
  return out;
}

/**
 * A change's identity, to remember it done: who, what, and the value the log
 * leaves it at — so it stays done after later logs move the sheet on, and
 * opens again only if this log's own outcome changes.
 */
export const rowId = (row: BookkeepingRow): string => `${row.who}\u0000${row.kind}\u0000${row.key}\u0000${row.target}`;

/**
 * What a sheet should read once a change is written: the log's progress
 * (`target − from`) on top of the sheet as it is now — the target itself while
 * the sheet still reads as the log began — kept within its bounds.
 */
export function appliedValue(row: BookkeepingRow): number {
  const next = row.sheet + (row.target - row.from);
  return Math.max(0, row.max != null ? Math.min(row.max, next) : next);
}
