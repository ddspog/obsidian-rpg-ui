import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { SkillsProps } from "./skills.types";
import { CharacterEntity } from "../../entities/character.types";

type Attr = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const SKILLS: { name: keyof SkillsProps; attr: Attr }[] = [
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

function formatMod(n: number) {
  return (n >= 0 ? "+" : "\u2212") + Math.abs(n);
}

function ProfDot({ level }: { level: number }) {
  if (level >= 2) {
    // Expertise: filled + outer ring
    return (
      <svg aria-label="Expertise" viewBox="0 0 10 10" width="12" height="12">
        <circle cx="5" cy="5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="5" cy="5" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  if (level >= 1) {
    // Proficient: filled circle
    return (
      <svg aria-label="Proficient" viewBox="0 0 10 10" width="12" height="12">
        <circle cx="5" cy="5" r="3.5" fill="currentColor" />
      </svg>
    );
  }
  if (level > 0) {
    // Half proficiency: half-filled
    return (
      <svg aria-label="Half Proficient" viewBox="0 0 10 10" width="12" height="12">
        <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M5 1.5 A3.5 3.5 0 0 0 5 8.5 Z" fill="currentColor" />
      </svg>
    );
  }
  // None: empty circle
  return (
    <svg aria-label="Not Proficient" viewBox="0 0 10 10" width="12" height="12">
      <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export const skills: EntityBlock<SkillsProps, CharacterEntity> = ({ self, expressions }) => (
  <section aria-label="Character Skills">
    <header className="rpg-tag-heading"><span>Skills</span></header>
    <menu>
      {SKILLS.map(({ name, attr }) => {
        const skill = self[name];
        const mod = expressions.ModifierTotal({
          attribute: attr,
          proficiency: skill.proficiency,
          bonus: skill.bonus,
        });
        const vantage = skill.vantage ?? 0;
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

export default skills;
