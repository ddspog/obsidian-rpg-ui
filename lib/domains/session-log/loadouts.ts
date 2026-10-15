/**
 * Loadouts: what a character holds, set on their sheet and switched at will —
 *
 *   loadouts:
 *     Bow: { main_hand: "[[Longbow]]" }
 *     Blades: { main_hand: "[[Shortsword]]", off_hand: "[[Shortsword]]" }
 *     Sword & Board: { main_hand: "[[Longsword]]", shield: "[[Shield]]" }
 *     Scout: { main_hand: "[[Shortsword]]", light: "[[Torch]]" }
 *     Bard: { main_hand: "[[Rapier]]", instrument: "[[Lute]]" }
 *
 * Switching rewrites which inventory entry sits in each hand (`slot:`); what
 * a character can strike with, and the cards for it, follow from the slots.
 * Armour and everything in a bag stay as they are.
 */

/** What a loadout can hold: a weapon in each hand, a shield, a light (a torch), an instrument. */
export const HANDS = ["main_hand", "off_hand", "shield", "light", "instrument"] as const;
export type Hand = (typeof HANDS)[number];

export interface Loadout {
  name: string;
  /** Each hand's item, as the sheet writes it (`[[Longbow]]`). */
  hands: Partial<Record<Hand, string>>;
}

/** `[[Longbow|bow]]` → `Longbow`. */
const stem = (n: unknown) =>
  typeof n === "string"
    ? n
        .replace(/^\[\[|\]\]$/g, "")
        .split("|")[0]
        .split("/")
        .pop()!
        .trim()
        .toLowerCase()
    : "";
const shown = (n: string) =>
  n
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")
    .pop()!
    .trim();

/** The loadouts a sheet declares, in the order it writes them. */
export function readLoadouts(raw: unknown): Loadout[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).flatMap(([name, v]) => {
    if (!v || typeof v !== "object") return [];
    const hands: Loadout["hands"] = {};
    for (const h of HANDS) {
      const item = (v as Record<string, unknown>)[h];
      if (typeof item === "string" && item.trim()) hands[h] = item.trim();
    }
    return Object.keys(hands).length > 0 ? [{ name, hands }] : [];
  });
}

/** A loadout in words: `Shortsword + Shortsword`, or `Longsword + Shield`. */
export function describeLoadout(l: Loadout): string {
  return HANDS.flatMap((h) => (l.hands[h] ? [shown(l.hands[h]!)] : [])).join(" + ");
}

/**
 * The inventory with the loadout in hand: every hand emptied, then each named
 * item set in its hand. An item named for both hands (two Shortswords) is a
 * `qty: 2` entry in the main hand, or two entries. `missing` names what the
 * sheet doesn't carry.
 */
export function applyLoadout(items: unknown[], loadout: Loadout): { items: unknown[]; missing: string[] } {
  const out = (JSON.parse(JSON.stringify(items)) as unknown[]).map((e) =>
    typeof e === "string" ? { name: e } : e
  ) as Array<Record<string, unknown>>;
  for (const e of out)
    if (e && typeof e === "object" && (HANDS as readonly string[]).includes(String(e.slot))) delete e.slot;
  const missing: string[] = [];
  const taken = new Set<Record<string, unknown>>();
  const wanted = HANDS.flatMap((h) => (loadout.hands[h] ? [{ hand: h, item: loadout.hands[h]! }] : []));
  for (const { hand, item } of wanted) {
    const want = stem(item);
    // A pair (qty 2) already in the main hand holds the off hand's too.
    const pair = out.find(
      (e) => e && taken.has(e) && stem(e.name) === want && e.slot === "main_hand" && Number(e.qty) >= 2
    );
    if (pair && hand === "off_hand") continue;
    const entry = out.find((e) => e && typeof e === "object" && !taken.has(e) && stem(e.name) === want);
    if (!entry) {
      missing.push(shown(item));
      continue;
    }
    taken.add(entry);
    entry.slot = hand;
  }
  return { items: out, missing };
}
