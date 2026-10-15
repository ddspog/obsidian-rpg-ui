/**
 * The PARTY's cards — what the group does together, between fights and on the
 * road — as the lines they write. The popup gathers the choices; these turn
 * them into Lonelog, its tags carrying every change to the sheets:
 *
 *   @(Party) Short rest
 *   @(Kowyn) Spends a hit die
 *   d: Healing | 1d8+2=
 *   => They patched up by the fire. [Kowyn/Hit Dice-1] [Time: +1h]
 *
 * Each card has ONE outcome line — how it went, in words — and every change
 * rides on it as tags.
 *
 * Rests follow Tales of the Valiant ("Resting"): a short rest is an hour and
 * hit dice (each its die + CON); a long rest is 8 hours — all hit points back,
 * half the hit dice (at least one), what recharges on a long rest — and only
 * for those with at least 1 HP.
 */

import type { Health } from "./health";

/** One of the party, as the cards see them now. */
export interface PartyMember {
  /** As the log names them (`Talon`). */
  name: string;
  hp?: Health;
  /** CON modifier — each hit die adds it. */
  con?: number;
  /** Hit dice by size: how many are left, of how many. */
  hitDice: Array<{ die: string; left: number; max: number }>;
  /** Features with uses: spent now, and when they come back (`on long rest`). */
  uses: Array<{ name: string; spent: number; max?: number; recovery?: string }>;
  /** Spell slots spent now, by circle. */
  slots: Array<{ circle: number; spent: number }>;
  exhaustion?: number;
}

const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const slotName = (circle: number) => `${ordinal(circle)}-Circle Slot`;
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

/** Uses that come back on a short rest — `short rest` in their recovery (a long one gives them back too). */
const onShortRest = (recovery?: string) => /\bshort\b/i.test(recovery ?? "");
const onLongRest = (recovery?: string) => /\b(short|long)\b/i.test(recovery ?? "");

/** One member's short rest: the hit dice spent (by size), each rolled + CON. */
export interface ShortRestChoice {
  member: PartyMember;
  dice: Record<string, number>;
}

export function shortRest(choices: ShortRestChoice[], hours = 1): string {
  const lines = ["@(Party) Short rest"];
  const tags: string[] = [];
  for (const { member, dice } of choices) {
    const spent = Object.entries(dice).filter(([, n]) => n > 0);
    const total = spent.reduce((n, [, k]) => n + k, 0);
    // Each member's hit dice, rolled as their own entry.
    if (total > 0) {
      lines.push(`@(${member.name}) Spends ${total === 1 ? "a hit die" : `${total} hit dice`}`);
      const con = member.con ?? 0;
      const roll = spent.map(([die, n]) => `${n}${die}`).join("+");
      lines.push(`d: Healing | ${roll}${con ? signed(con * total) : ""}=`);
      tags.push(`[${member.name}/Hit Dice-${total}]`);
    }
    // What recharges on a short rest comes back all the same.
    for (const u of member.uses)
      if (u.spent > 0 && onShortRest(u.recovery)) tags.push(`[${member.name}/${u.name}+${u.spent}]`);
  }
  // How it went — and every change, and the time it took, on the one outcome line.
  lines.push(`=> {{outcome?}} ${[...tags, `[Time: +${hours}h]`].join(" ")}`);
  return lines.join("\n");
}

/** What a long rest gives each member — and why one gets nothing. */
export function longRest(
  members: PartyMember[],
  opts: { fed?: boolean; interrupted?: boolean; hours?: number } = {}
): { text: string; skipped: Array<{ name: string; why: string }> } {
  const hours = opts.hours ?? 8;
  const lines = ["@(Party) Long rest"];
  const skipped: Array<{ name: string; why: string }> = [];
  if (opts.interrupted) {
    lines.push(`=> {{outcome?}} Interrupted — no benefit; the rest must begin again. [Time: +${hours}h]`);
    return { text: lines.join("\n"), skipped: members.map((m) => ({ name: m.name, why: "the rest was interrupted" })) };
  }
  const all: string[] = [];
  for (const m of members) {
    // A long rest needs at least 1 HP to begin.
    if (m.hp && m.hp.current <= 0) {
      skipped.push({ name: m.name, why: "at 0 HP — a long rest needs at least 1" });
      continue;
    }
    const tags: string[] = [];
    if (m.hp && m.hp.current < m.hp.max) tags.push(`[PC:${m.name}|HP ${m.hp.max}]`);
    // Half its hit dice back (at least one), up to what it's missing.
    const totalMax = m.hitDice.reduce((n, d) => n + d.max, 0);
    let regain = Math.max(1, Math.floor(totalMax / 2));
    let back = 0;
    for (const d of [...m.hitDice].sort((a, b) => parseInt(b.die.slice(1), 10) - parseInt(a.die.slice(1), 10))) {
      const take = Math.min(regain, d.max - d.left);
      back += take;
      regain -= take;
    }
    if (back > 0) tags.push(`[${m.name}/Hit Dice+${back}]`);
    for (const u of m.uses) if (u.spent > 0 && onLongRest(u.recovery)) tags.push(`[${m.name}/${u.name}+${u.spent}]`);
    for (const s of m.slots) if (s.spent > 0) tags.push(`[${m.name}/${slotName(s.circle)}+${s.spent}]`);
    if (opts.fed !== false && (m.exhaustion ?? 0) > 0) tags.push(`[${m.name}/Exhaustion-1]`);
    all.push(...tags);
  }
  lines.push(`=> {{outcome?}} ${[...all, `[Time: +${hours}h]`].join(" ")}`);
  return { text: lines.join("\n"), skipped };
}

/** One thing found: its name, a note to link when there is one, how many. */
export interface LootRow {
  name: string;
  link?: boolean;
  qty: number;
}

/** Where a found thing goes: a destination's address, or another thing found
 *  (a Pouch) — `found:` and its row. Nowhere: it's left behind. */
export type LootTarget = { to: "dest"; path: string[] } | { to: "found"; row: number };

const asItem = (r: LootRow) => (r.link ? `[[${r.name}]]` : r.name);

/**
 * Each row's address — its destination's, or the found container's own after
 * where THAT goes (`Kowyn's Bag/[[Pouch]]`). Undefined when it goes nowhere,
 * or into something itself going nowhere (or into itself, round and round).
 */
export function lootPaths(rows: LootRow[], targets: Array<LootTarget | undefined>): Array<string[] | undefined> {
  const resolve = (i: number, seen: Set<number>): string[] | undefined => {
    const t = targets[i];
    if (!t || seen.has(i)) return undefined;
    if (t.to === "dest") return t.path;
    const outer = resolve(t.row, new Set([...seen, i]));
    return outer && rows[t.row] ? [...outer, asItem(rows[t.row])] : undefined;
  };
  return rows.map((_, i) => resolve(i, new Set()));
}

/**
 * What the party takes from the fallen — each thing into its own place (a
 * member, a container one carries, or a container found with it) — and coins,
 * to one member or split evenly among some.
 */
export function loot(opts: {
  items: Array<LootRow & { path?: string[] }>;
  coins?: Record<string, number>;
  coinsTo?: string;
  split?: string[];
  note?: string;
}): string {
  const items = opts.items.filter((i) => i.qty > 0 && i.name.trim() && i.path && i.path.length > 0);
  const tags = items.map((i) => `[Inv:${i.path!.join("/")}/${asItem(i)}+${i.qty}]`);
  const coins = Object.entries(opts.coins ?? {}).filter(([, n]) => n > 0);
  const who = opts.split && opts.split.length > 0 ? opts.split : opts.coinsTo ? [opts.coinsTo] : [];
  for (const w of who) {
    for (const [cur, n] of coins) {
      const each = Math.floor(n / who.length);
      if (each > 0) tags.push(`[${w}/${cur.toUpperCase()}+${each}]`);
    }
  }
  return [
    "@(Party) Loots the fallen",
    `=> ${opts.note?.trim() || "{{outcome?}}"}${tags.length ? ` ${tags.join(" ")}` : ""}`,
  ].join("\n");
}

/** A journey's role: who takes it, and the check it rolls. */
export interface TravelRole {
  role: string;
  who: string;
  skill: string;
}

/** Miles a day by pace (Player's Guide); a stage's hours follow from its distance. */
export const PACE_MILES_PER_DAY: Record<string, number> = { fast: 30, normal: 24, slow: 18 };

/** One stage of a journey: where to, how far, the ground, the pace, the checks its roles make. */
export function travel(opts: {
  destination: string;
  miles?: number;
  terrain?: string;
  pace: "fast" | "normal" | "slow";
  dc: number;
  roles: TravelRole[];
  encounterUnder?: number;
}): string {
  const perHour = PACE_MILES_PER_DAY[opts.pace] / 8;
  const hours = opts.miles ? Math.max(1, Math.round(opts.miles / perHour)) : undefined;
  const what = [opts.miles ? `${opts.miles} miles` : "", opts.terrain ?? "", `${opts.pace} pace`]
    .filter(Boolean)
    .join(", ");
  const lines = [`@(Party) Travels to ${opts.destination} — ${what}`];
  for (const r of opts.roles.filter((x) => x.who)) {
    lines.push(`d(${r.who}): ${r.role} | d20+[[${r.skill}]]= vs DC ${opts.dc} ->`);
  }
  if (opts.encounterUnder) lines.push(`d: Encounter (under ${opts.encounterUnder}) | d100=`);
  lines.push(`=> {{outcome?}}${hours ? ` [Time: +${hours}h]` : ""}`);
  return lines.join("\n");
}

/** The weather now: season, temperature, wind, sky — a running tag. */
export function weather(opts: {
  season?: string;
  temperature?: string;
  wind?: string;
  sky?: string;
  note?: string;
}): string {
  const parts = [opts.season, opts.temperature, opts.wind, opts.sky].map((p) => p?.trim()).filter(Boolean);
  return `=> ${opts.note?.trim() || "{{outcome?}}"} [Weather: ${parts.join(" · ")}]`;
}

/** A check the whole group makes — half or more succeeding, the group does. */
export function groupCheck(opts: { what: string; skill: string; dc: number; members: string[] }): string {
  const lines = [`@(Party) ${opts.what.trim() || `${opts.skill} as a group`}`];
  for (const m of opts.members) lines.push(`d(${m}): ${opts.skill} | d20+[[${opts.skill}]]= vs DC ${opts.dc} ->`);
  lines.push("=> {{outcome?}}");
  return lines.join("\n");
}

/** Luck handed out — after a hard fight survived, a great moment. */
export function luck(opts: { members: string[]; amount?: number; why?: string }): string {
  const n = opts.amount ?? 1;
  return [
    `@(Party) Earns Luck`,
    `=> ${opts.why?.trim() || "{{outcome?}}"} ${opts.members.map((m) => `[${m}/Luck+${n}]`).join(" ")}`,
  ].join("\n");
}

/** An item's price in gp; for one sold in bundles (20 Arrows), the bundle's, and how many in it. */
export interface ItemPrice {
  price: number;
  bundle?: number;
}

/** One buy or sale: the item, how many (bundles, when it comes in them), the
 *  price of each (in gp), and which way. */
export interface ShopRow {
  item: string;
  link?: boolean;
  qty: number;
  price: number;
  /** Pieces in a bundle (Arrows' 20): `qty` counts bundles, the tag pieces. */
  bundle?: number;
  sell?: boolean;
}

/** A trip to a shop: what one member buys or sells, and what it costs them. */
export function shop(opts: { who: string; at?: string; rows: ShopRow[] }): string {
  const rows = opts.rows.filter((r) => r.item.trim() && r.qty > 0);
  const lines = [`@(${opts.who}) ${opts.at?.trim() ? `Trades at ${opts.at.trim()}` : "Trades"}`];
  // Ammunition is counted in pieces: a bundle of 20 Arrows bought is +20.
  const items = rows.map(
    (r) => `[Inv:${opts.who}/${r.link ? `[[${r.item}]]` : r.item}${r.sell ? "-" : "+"}${r.qty * (r.bundle ?? 1)}]`
  );
  // Coins: in copper, so silver and copper prices add up — then back to gp, sp, cp.
  const cp = Math.round(rows.reduce((n, r) => n + (r.sell ? 1 : -1) * r.price * r.qty * 100, 0));
  const sign = cp < 0 ? "-" : "+";
  const abs = Math.abs(cp);
  const coins = (
    [
      ["GP", Math.floor(abs / 100)],
      ["SP", Math.floor((abs % 100) / 10)],
      ["CP", abs % 10],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([cur, n]) => `[${opts.who}/${cur}${sign}${n}]`);
  lines.push(`=> {{outcome?}} ${[...items, ...coins].join(" ")}`);
  return lines.join("\n");
}

/** The session's end: its XP — a milestone, a great moment — for each. */
export function endSession(opts: { members: string[]; xp: number; why?: string }): string {
  const tags = opts.xp > 0 ? ` ${opts.members.map((m) => `[${m}/XP+${opts.xp}]`).join(" ")}` : "";
  return [`@(Party) Ends the session`, `=> ${opts.why?.trim() || "{{outcome?}}"}${tags}`].join("\n");
}
