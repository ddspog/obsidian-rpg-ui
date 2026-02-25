import { EntityBlock, SkillLI } from "rpg-ui-toolkit";
import { SkillsProps } from "./skills.types";
import { CharacterEntity } from "../../entities/character.types";

export const skills: EntityBlock<SkillsProps, CharacterEntity> = ({ self, blocks, lookup, system }) => (
  <article aria-label="Character Skills">
    <ul aria-label='Skill List'>
      <SkillLI value={self.Acrobatics}>Acrobatics</SkillLI>
      <SkillLI value={self['Animal Handling']}>Animal Handling</SkillLI>
      <SkillLI value={self.Arcana}>Arcana</SkillLI>
      <SkillLI value={self.Athletics}>Athletics</SkillLI>
      <SkillLI value={self.Deception}>Deception</SkillLI>
      <SkillLI value={self.History}>History</SkillLI>
      <SkillLI value={self.Insight}>Insight</SkillLI>
      <SkillLI value={self.Intimidation}>Intimidation</SkillLI>
      <SkillLI value={self.Investigation}>Investigation</SkillLI>
      <SkillLI value={self.Medicine}>Medicine</SkillLI>
      <SkillLI value={self.Nature}>Nature</SkillLI>
      <SkillLI value={self.Perception}>Perception</SkillLI>
      <SkillLI value={self.Performance}>Performance</SkillLI>
      <SkillLI value={self.Persuasion}>Persuasion</SkillLI>
      <SkillLI value={self.Religion}>Religion</SkillLI>
      <SkillLI value={self['Sleight of Hand']}>Sleight of Hand</SkillLI>
      <SkillLI value={self.Stealth}>Stealth</SkillLI>
    </ul>
  </article>
);

export default skills;
