import * as React from "react";
import { EntityBlock, Markdown } from "rpg-ui-toolkit";
import { SkillsProps } from "./skills.types";
import { CharacterEntity } from "../../entities/character.types";
import { SKILLS, skillResolver } from "../../entities/character.skills";
import type { FeaturesBlockData } from "./features.types";

function formatMod(n: number) {
  return (n >= 0 ? "+" : "\u2212") + Math.abs(n);
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

/** Pill-shaped advantage / disadvantage indicator. Advantage is a green
 *  dot + superscript "A"; disadvantage is red + "D". Renders beside the
 *  modifier cell on the skill / save / initiative row. */
function VantageBadge({ kind }: { kind: "adv" | "dis" }) {
  return (
    <span className="rpg-vantage-badge" data-vantage={kind} aria-label={kind === "adv" ? "Advantage" : "Disadvantage"}>
      <sup>{kind === "adv" ? "A" : "D"}</sup>
    </span>
  );
}

export const skills: EntityBlock<SkillsProps, CharacterEntity> = ({ self, blocks, lookup, expressions }) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const inventory = (blocks as any).inventory;
  const view = lookup.$features?.(header, features?.choices, features?.additional, inventory);
  const traits = view?.traits ?? {};

  // Proficiency / vantage / bonus per skill — shared with the `Modifier`
  // expression, so a session-log roll reads the same number this sheet shows.
  const resolveSkill = skillResolver(self as Record<string, unknown>, traits);

  return (
    <section aria-details="Character Skills">
      <header className="rpg-tag-heading">
        <span>Skills</span>
      </header>
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
              <span aria-details="Skill Name">
                <Markdown source={`[[${name}]]`} className="rpg-inline-md" />
              </span>
              <data value={mod}>
                {vantage > 0 && <VantageBadge kind="adv" />}
                {vantage < 0 && <VantageBadge kind="dis" />}
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
