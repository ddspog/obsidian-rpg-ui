/**
 * A character's Armor Class — the one the sheet's defense badges show, and the
 * one a session log's attacks are rolled against (the `ArmorClass` expression).
 *
 * Natural AC (`natural_ac:`, or the best `Natural AC` trait a feature grants),
 * replaced by worn body armor's formula with the DEX modifier, plus the best
 * shield WIELDED (in the shield slot or the off hand — a shield stowed in a
 * pack gives nothing), plus the bonuses on top: an equipped item's `ac_bonus:`
 * (or `armor.bonus:`) and any `AC Bonus` traits features grant. A sheet that
 * assigns no hands at all counts the shield it carries, as it always did.
 */

import { parseNumericTrait } from "./character.skills";

/** Armor alone, and the shield's bonus on top of it. */
export function characterArmorClass(
  blocks: unknown,
  lookup: { $items?: Record<string, Record<string, unknown>> } | undefined,
  traits: Record<string, string[]>,
  naturalAcYaml: number | undefined
): { armor: number; shieldBonus: number; bonus: number } {
  // Natural AC: author may set `natural_ac:` in the YAML or a feature may
  // grant it via a `Natural AC` trait entry (Monk-style unarmored defense,
  // heritage armored skin, …). Take the highest so a trait grant never
  // regresses a player's written AC but a high feature floor still wins.
  const fromTraits = (traits["Natural AC"] ?? []).map(parseNumericTrait).filter((n) => Number.isFinite(n) && n > 0);
  const naturalAc = Math.max(naturalAcYaml ?? 10, ...(fromTraits.length > 0 ? fromTraits : [0]));
  const traitBonus = (traits["AC Bonus"] ?? []).reduce((n, raw) => n + parseNumericTrait(raw), 0);
  const worn = resolveEquippedAc(blocks, lookup, naturalAc);
  return { ...worn, bonus: worn.bonus + traitBonus };
}

// ─── Equipped AC ────────────────────────────────────────────────────────────

/**
 * Combine the inventory's equipped armor + shield with the character's
 * DEX modifier into the two AC values shown on the defense badges.
 * Falls back to `naturalAc` when no body armor is equipped, so unarmored
 * Monks / Barbarians still get a sensible base.
 */
function resolveEquippedAc(
  blocks: unknown,
  lookup: { $items?: Record<string, Record<string, unknown>> } | undefined,
  naturalAc: number
): { armor: number; shieldBonus: number; bonus: number } {
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const items = Array.isArray(inv?.items) ? inv.items : [];
  const lib = lookup?.$items ?? {};
  const dexMod = abilityModFromBlocks(blocks, "DEX");

  let armor = naturalAc;
  let shieldBonus = 0;
  let bonus = 0;
  // Hands assigned on the sheet? Then only a shield in the shield slot or the off hand counts.
  const handsAssigned = items.some(
    (raw) =>
      !!raw &&
      typeof raw === "object" &&
      ["main_hand", "off_hand", "shield"].includes((raw as { slot?: string }).slot ?? "")
  );

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { name?: unknown; slot?: unknown };
    if (typeof o.name !== "string") continue;
    const name = wikiStem(o.name);
    if (!name) continue;
    const fm = lib[name];
    if (!fm) continue;
    const armorBlock =
      fm.armor && typeof fm.armor === "object"
        ? (fm.armor as { ac?: unknown; category?: unknown; bonus?: unknown })
        : undefined;
    // A bonus an equipped item gives of its own (a ring of protection, +1 armor).
    if (typeof o.slot === "string" && o.slot) {
      const extra = parseAcBonus(
        typeof fm.ac_bonus === "number" || typeof fm.ac_bonus === "string"
          ? String(fm.ac_bonus)
          : typeof armorBlock?.bonus === "number" || typeof armorBlock?.bonus === "string"
            ? String(armorBlock.bonus)
            : undefined
      );
      bonus += extra;
    }
    if (!armorBlock) continue;
    const formula = typeof armorBlock.ac === "string" ? armorBlock.ac : undefined;
    const category = typeof armorBlock.category === "string" ? armorBlock.category.toLowerCase() : undefined;

    if (category === "shield") {
      // Shields are "equipped" by mere inventory presence — the player
      // doesn't toggle them. Take the strongest shield bonus so multiple
      // shields don't stack (5e rule: only one shield at a time).
      const wielded = !handsAssigned || o.slot === "shield" || o.slot === "off_hand";
      const value = wielded ? parseAcBonus(formula) : 0;
      if (value > shieldBonus) shieldBonus = value;
    } else if (o.slot === "armor") {
      armor = computeArmorValue(formula, category, dexMod) ?? armor;
    }
  }
  return { armor, shieldBonus, bonus };
}

function abilityModFromBlocks(blocks: unknown, key: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA"): number {
  const stats = (blocks as { stats?: Record<string, unknown> })?.stats ?? {};
  const cell = stats[key];
  let score = 10;
  if (typeof cell === "number") score = cell;
  else if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
    score = (cell as { value: number }).value;
  }
  return Math.floor((score - 10) / 2);
}

/** Parse a bonus-style AC formula (`"+2"`, `"+1"`). Falls back to 0. */
function parseAcBonus(raw: string | undefined): number {
  if (!raw) return 0;
  const m = raw.match(/[+-]?\d+/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Resolve a body-armor AC string into a numeric value for the wielder.
 *  Parses out the base (leading integer), the DEX component (`+ DEX`),
 *  and an optional inline cap (`(max N)`). Falls back to the 5e default
 *  per category when no explicit cap is declared — medium ≤ 2, heavy = 0,
 *  light uncapped. */
function computeArmorValue(formula: string | undefined, category: string | undefined, dexMod: number): number | null {
  if (!formula) return null;
  const baseMatch = formula.match(/-?\d+/);
  if (!baseMatch) return null;
  const base = Number(baseMatch[0]);
  if (!Number.isFinite(base)) return null;
  const wantsDex = /\bdex\b/i.test(formula);
  if (!wantsDex) return base;
  const explicitCap = formula.match(/max\s+(\d+)/i);
  const cap = explicitCap ? Number(explicitCap[1]) : category === "heavy" ? 0 : category === "medium" ? 2 : Infinity;
  return base + Math.min(dexMod, cap);
}

function wikiStem(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim();
}
