import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { SkillsProps } from "./skills.types";
import { CharacterEntity } from "../../entities/character.types";
import { SkillDetails } from "../../entities/character.common";
import type { FeaturesBlockData } from "./features.types";

type Attr = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

type SkillName =
  | "Acrobatics" | "Animal Handling" | "Arcana" | "Athletics"
  | "Deception" | "History" | "Insight" | "Intimidation"
  | "Investigation" | "Medicine" | "Nature" | "Perception"
  | "Performance" | "Persuasion" | "Religion" | "Sleight of Hand"
  | "Stealth" | "Survival";

const SKILLS: { name: SkillName; attr: Attr }[] = [
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

function formatMod(n: number) {
  return (n >= 0 ? "+" : "\u2212") + Math.abs(n);
}

/** Strip a trait-value prefix (`+`, `[[…]]`, alias pipe) down to a bare
 *  skill name we can match against the canonical list. */
function bareLabel(raw: string): string {
  return raw
    .replace(/^\+/, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .trim();
}

function ProfDot({ level }: { level: number }) {
  if (level >= 2) {
    return (
      <svg aria-label="Expertise" viewBox="0 0 10 10" width="12" height="12">
        <circle cx="5" cy="5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="5" cy="5" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  if (level >= 1) {
    return (
      <svg aria-label="Proficient" viewBox="0 0 10 10" width="12" height="12">
        <circle cx="5" cy="5" r="3.5" fill="currentColor" />
      </svg>
    );
  }
  if (level > 0) {
    return (
      <svg aria-label="Half Proficient" viewBox="0 0 10 10" width="12" height="12">
        <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M5 1.5 A3.5 3.5 0 0 0 5 8.5 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg aria-label="Not Proficient" viewBox="0 0 10 10" width="12" height="12">
      <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export const skills: EntityBlock<SkillsProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  expressions,
}) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const view = lookup.$features?.(header, features?.choices);
  const traits = view?.traits ?? {};

  // Count full-proficiency picks. A skill appearing twice in `Skill P.`
  // counts as expertise (level 2); a single entry is level 1. A skill
  // listed in `Skill E.` is expertise outright, regardless of whether
  // `Skill P.` also mentions it. Half-prof picks (level 0.5) come from
  // `Skill J.` (Jack of all trades style) so they never compete with
  // full proficiency on the same skill.
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
  // Trait-driven vantage + flat bonuses. `Skill A.` grants advantage
  // (+1 vantage), `Skill D.` disadvantage (−1), `Skill B.` contributes
  // a flat numeric bonus added on top of the attribute+PB modifier.
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
    // `Skill B.: "+2 Athletics"` — number precedes the skill name.
    const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+(.+?)\s*$/);
    if (!match) continue;
    const bonus = parseFloat(match[1]);
    const name = bareLabel(match[2]);
    if (!Number.isFinite(bonus) || !SKILL_SET.has(name)) continue;
    bonusByName.set(name, (bonusByName.get(name) ?? 0) + bonus);
  }

  // Author-only additions layered on top of the trait-derived counts.
  const additional = self.additional ?? {};
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

  const resolveSkill = (name: SkillName): SkillDetails => {
    const override = (self as Record<string, unknown>)[name] as Partial<SkillDetails> | undefined;
    return {
      proficiency: override?.proficiency ?? derivedProficiency(name),
      vantage: override?.vantage ?? vantageByName.get(name) ?? 0,
      bonus: override?.bonus ?? bonusByName.get(name) ?? 0,
    };
  };

  return (
    <section aria-details="Character Skills">
      <header className="rpg-tag-heading"><span>Skills</span></header>
      <menu>
        {SKILLS.map(({ name, attr }) => {
          const skill = resolveSkill(name);
          const mod = expressions.ModifierTotal({
            attribute: attr,
            proficiency: skill.proficiency,
            bonus: skill.bonus,
          });
          const vantage = skill.vantage;
          return (
            <li key={name} data-vantage={vantage > 0 ? "adv" : vantage < 0 ? "dis" : undefined}>
              <ProfDot level={skill.proficiency} />
              <abbr aria-details="Skill Attribute">{attr}</abbr>
              <span aria-details="Skill Name">{name}</span>
              <data value={mod}>
                {vantage > 0 && <span aria-details="Vantage">{"\u25B2"}</span>}
                {vantage < 0 && <span aria-details="Vantage">{"\u25BC"}</span>}
                {formatMod(mod)}
              </data>
            </li>
          );
        })}
      </menu>
    </section>
  );
};

export default skills;
