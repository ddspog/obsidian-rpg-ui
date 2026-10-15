/**
 * What casting a spell takes, by the rules: a spell with a somatic component
 * needs a free hand for the gestures; one with a material component needs a
 * hand free to reach it — or to hold a spellcasting focus — and a focus (of
 * the spell's magic) in that hand or a component pouch to stand in for it,
 * unless the component has a cost, which nothing stands in for. One hand does
 * both jobs: the hand holding a matching focus can make the gestures too.
 * Verbal components ask for nothing held.
 */

/** A spell's components, read from its `components:` list. */
export interface ComponentNeeds {
  v: boolean;
  s: boolean;
  m: boolean;
  /** The material has a price (`worth at least 100gp`) — a pouch or focus can't stand in. */
  costly: boolean;
}

export function parseComponents(raw: unknown): ComponentNeeds | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/,(?![^(]*\))/) : [];
  const parts = list.map((x) => String(x).trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const material = parts.find((p) => /^M\b/i.test(p));
  return {
    v: parts.some((p) => /^V\b/i.test(p)),
    s: parts.some((p) => /^S\b/i.test(p)),
    m: !!material,
    costly: !!material && /\d+\s*(?:gp|sp|cp|pp|ep)\b|worth at least|\bcost/i.test(material),
  };
}

/** What a held or carried item's note says that casting cares about. */
export interface ItemFacts {
  /** It takes both hands. */
  twoHanded?: boolean;
  /** The magic it focuses (`Divine`, `Primordial`, `Arcane`). */
  focus?: string[];
  /** A component pouch. */
  pouch?: boolean;
}

const MAGIC = /^(arcane|divine|primordial)$/i;

/** Read an item's facts from its note's text (and its name, for a pouch). */
export function readItemFacts(text: string, name: string): ItemFacts {
  const facts: ItemFacts = {};
  if (/^\s*-\s*["']?(?:\[\[)?\s*Two-Handed\b/im.test(text)) facts.twoHanded = true;
  if (/component pouch/i.test(name)) facts.pouch = true;
  const focus = new Set<string>();
  // "…can be used as a spellcasting focus to channel [[Divine]] spells", "…as an Arcane spellcasting focus".
  for (const m of text.matchAll(/spellcasting focus\s+(?:to channel|for)\s*\[?\[?(\w+)/gi))
    if (MAGIC.test(m[1])) focus.add(m[1][0].toUpperCase() + m[1].slice(1).toLowerCase());
  for (const m of text.matchAll(/\bas an?\s+\[?\[?(\w+)\]?\]?\s+spellcasting focus/gi))
    if (MAGIC.test(m[1])) focus.add(m[1][0].toUpperCase() + m[1].slice(1).toLowerCase());
  if (focus.size > 0) facts.focus = [...focus];
  return facts;
}

/** A thing held in a hand: how many hands it takes, and the magic it focuses, if it is a focus. */
export interface HeldThing {
  hands: number;
  focus: string[];
}

/** What a character holds and carries, as casting sees it. */
export interface CastingKit {
  held: HeldThing[];
  pouch: boolean;
}

/** Why a spell can't be cast with this kit, or undefined when it can. */
export function castBlock(needs: ComponentNeeds | undefined, magic: string[], kit: CastingKit): string | undefined {
  if (!needs || (!needs.s && !needs.m)) return undefined;
  const wanted = magic.map((x) => x.toLowerCase());
  const serves = (h: HeldThing) => h.focus.some((f) => wanted.length === 0 || wanted.includes(f.toLowerCase()));
  // A hand holding the right focus can still gesture; any other thing in a hand fills it.
  const filled = kit.held.filter((h) => !serves(h)).reduce((n, h) => n + h.hands, 0);
  if (Math.max(0, 2 - filled) < 1) return "no free hand";
  if (needs.m && !needs.costly && !kit.held.some(serves) && !kit.pouch) return "no focus or component pouch";
  return undefined;
}
