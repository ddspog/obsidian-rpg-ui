/**
 * Tales of the Valiant skills — the canonical list and how a character's
 * proficiency, vantage and bonus in each is resolved.
 *
 * Shared by the `character.skills` block (which renders every skill) and the
 * `Modifier` expression (which answers "what is Insight for this character?"
 * for a session-log roll), so both read the same numbers.
 */

import type { SkillDetails } from "./character.common";

export type Attr = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export type SkillName =
  | "Acrobatics"
  | "Animal Handling"
  | "Arcana"
  | "Athletics"
  | "Deception"
  | "History"
  | "Insight"
  | "Intimidation"
  | "Investigation"
  | "Medicine"
  | "Nature"
  | "Perception"
  | "Performance"
  | "Persuasion"
  | "Religion"
  | "Sleight of Hand"
  | "Stealth"
  | "Survival";

export const SKILLS: { name: SkillName; attr: Attr }[] = [
  { name: "Acrobatics", attr: "DEX" },
  { name: "Animal Handling", attr: "WIS" },
  { name: "Arcana", attr: "INT" },
  { name: "Athletics", attr: "STR" },
  { name: "Deception", attr: "CHA" },
  { name: "History", attr: "INT" },
  { name: "Insight", attr: "WIS" },
  { name: "Intimidation", attr: "CHA" },
  { name: "Investigation", attr: "INT" },
  { name: "Medicine", attr: "WIS" },
  { name: "Nature", attr: "INT" },
  { name: "Perception", attr: "WIS" },
  { name: "Performance", attr: "CHA" },
  { name: "Persuasion", attr: "CHA" },
  { name: "Religion", attr: "INT" },
  { name: "Sleight of Hand", attr: "DEX" },
  { name: "Stealth", attr: "DEX" },
  { name: "Survival", attr: "WIS" },
];

const SKILL_SET = new Set<string>(SKILLS.map((s) => s.name));

/** Attribute abbreviations by their spelled-out name (`Wisdom` → `WIS`). */
export const ATTR_BY_NAME: Record<string, Attr> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

/** Strip a trait-value prefix (`+`, `[[…]]`, alias pipe) down to a bare
 *  skill name we can match against the canonical list. */
export function bareLabel(raw: string): string {
  return raw.replace(/^\+/, "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
}

/** Author additions on the skills block, layered over the trait-derived counts. */
interface SkillsAdditional {
  profs?: string[];
  expertise?: string[];
  half_profs?: string[];
}

/**
 * Build the per-skill resolver from the skills block's own YAML (`self`) and
 * the character's resolved traits.
 *
 * A skill appearing twice in `Skill P.` counts as expertise (level 2); a single
 * entry is level 1. A skill listed in `Skill E.` is expertise outright. Half
 * proficiency (0.5) comes from `Skill J.`. `Skill A.` / `Skill D.` add vantage,
 * `Skill B.` a flat bonus (`"+2 Athletics"`). A per-skill override on the block
 * (`Insight: { proficiency: 1 }`) wins over everything derived.
 */
export function skillResolver(
  self: Record<string, unknown> | undefined,
  traits: Record<string, string[]>
): (name: SkillName) => SkillDetails {
  const profCounts = new Map<string, number>();
  for (const raw of traits["Skill P."] ?? []) {
    const name = bareLabel(raw);
    if (!SKILL_SET.has(name)) continue;
    profCounts.set(name, (profCounts.get(name) ?? 0) + 1);
  }
  for (const raw of traits["Skill E."] ?? []) {
    const name = bareLabel(raw);
    if (!SKILL_SET.has(name)) continue;
    profCounts.set(name, Math.max(profCounts.get(name) ?? 0, 2));
  }
  const halfNames = new Set<string>();
  for (const raw of traits["Skill J."] ?? []) {
    const name = bareLabel(raw);
    if (SKILL_SET.has(name)) halfNames.add(name);
  }
  const vantageByName = new Map<string, number>();
  const bonusByName = new Map<string, number>();
  for (const raw of traits["Skill A."] ?? []) {
    const name = bareLabel(raw);
    if (!SKILL_SET.has(name)) continue;
    vantageByName.set(name, (vantageByName.get(name) ?? 0) + 1);
  }
  for (const raw of traits["Skill D."] ?? []) {
    const name = bareLabel(raw);
    if (!SKILL_SET.has(name)) continue;
    vantageByName.set(name, (vantageByName.get(name) ?? 0) - 1);
  }
  for (const raw of traits["Skill B."] ?? []) {
    const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+(.+?)\s*$/);
    if (!match) continue;
    const bonus = parseFloat(match[1]);
    const name = bareLabel(match[2]);
    if (!Number.isFinite(bonus) || !SKILL_SET.has(name)) continue;
    bonusByName.set(name, (bonusByName.get(name) ?? 0) + bonus);
  }

  const additional = (self?.additional ?? {}) as SkillsAdditional;
  for (const n of additional.profs ?? []) {
    if (SKILL_SET.has(n)) profCounts.set(n, (profCounts.get(n) ?? 0) + 1);
  }
  for (const n of additional.expertise ?? []) {
    if (SKILL_SET.has(n)) profCounts.set(n, Math.max(profCounts.get(n) ?? 0, 2));
  }
  for (const n of additional.half_profs ?? []) {
    if (SKILL_SET.has(n)) halfNames.add(n);
  }

  const derivedProficiency = (name: string): number => {
    const count = profCounts.get(name) ?? 0;
    if (count >= 2) return 2;
    if (count >= 1) return 1;
    if (halfNames.has(name)) return 0.5;
    return 0;
  };

  return (name) => {
    const override = self?.[name] as Partial<SkillDetails> | undefined;
    return {
      proficiency: override?.proficiency ?? derivedProficiency(name),
      vantage: override?.vantage ?? vantageByName.get(name) ?? 0,
      bonus: override?.bonus ?? bonusByName.get(name) ?? 0,
    };
  };
}

/** A trait value's number: `+3`, `[[2]]`, `"+1"` → 3, 2, 1; anything else 0. */
export function parseNumericTrait(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  const n = parseFloat(cleaned.replace(/^[+\s]+/, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Initiative: DEX sets the baseline (the ToV rule), then the trait taxonomy
 * layers on top — `Initiative P.` full proficiency, `Initiative J.` half,
 * `Initiative E.` expertise (double PB), `Initiative B.` flat bonuses — and
 * `Initiative A.` / `Initiative D.` vantage. Shared by the Health block (which
 * shows it) and the `Modifier` expression (which a session-log roll reads).
 */
export function initiativeDetails(traits: Record<string, string[]>): SkillDetails & { attr: Attr } {
  const expertise = (traits["Initiative E."] ?? []).length > 0;
  const full = (traits["Initiative P."] ?? []).length > 0;
  const half = (traits["Initiative J."] ?? []).length > 0;
  const adv = (traits["Initiative A."] ?? []).length > 0;
  const dis = (traits["Initiative D."] ?? []).length > 0;
  return {
    attr: "DEX",
    proficiency: expertise ? 2 : full ? 1 : half ? 0.5 : 0,
    bonus: (traits["Initiative B."] ?? []).reduce((n, raw) => n + parseNumericTrait(raw), 0),
    vantage: adv && !dis ? 1 : dis && !adv ? -1 : 0,
  };
}
