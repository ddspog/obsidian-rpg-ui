import { EntityBlock, Stat, StatUL } from "rpg-ui-toolkit";
import { SensesProps } from "./senses.types";
import { CharacterEntity } from "../../entities/character.types";

export const senses: EntityBlock<SensesProps, CharacterEntity> = ({ self, blocks, expressions }) => (
  <article aria-label="Character Senses">
    <Stat value={expressions.Passive({
      attribute: 'WIS',
      proficiency: blocks.skills.Insight.proficiency,
      vantage: blocks.skills.Insight.vantage,
      bonus: blocks.skills.Insight.bonus
    })}>P. Insight</Stat>
    <Stat value={expressions.Passive({
      attribute: 'INT',
      proficiency: blocks.skills.Investigation.proficiency,
      vantage: blocks.skills.Investigation.vantage,
      bonus: blocks.skills.Investigation.bonus
    })}>P. Investigation</Stat>
    <Stat value={expressions.Passive({
      attribute: 'WIS',
      proficiency: blocks.skills.Perception.proficiency,
      vantage: blocks.skills.Perception.vantage,
      bonus: blocks.skills.Perception.bonus
    })}>P. Perception</Stat>
    <StatUL title='Senses'>
      {self.senses_list.map((sense, i) => <li key={i}>{sense.type}{sense.range && ` ${sense.range}`}</li>)}
    </StatUL>
  </article>
)

export default senses;
