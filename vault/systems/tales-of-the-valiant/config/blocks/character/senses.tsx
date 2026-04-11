import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { SensesProps } from "./senses.types";
import { CharacterEntity } from "../../entities/character.types";

export const senses: EntityBlock<SensesProps, CharacterEntity> = ({ self, blocks, expressions }) => (
  <section aria-label="Character Senses">
    <output aria-label="Passive Insight">
      <data>{expressions.Passive({
        attribute: 'WIS',
        proficiency: blocks.skills.Insight.proficiency,
        vantage: blocks.skills.Insight.vantage,
        bonus: blocks.skills.Insight.bonus
      })}</data>
      <small>P. Insight</small>
    </output>
    <output aria-label="Passive Investigation">
      <data>{expressions.Passive({
        attribute: 'INT',
        proficiency: blocks.skills.Investigation.proficiency,
        vantage: blocks.skills.Investigation.vantage,
        bonus: blocks.skills.Investigation.bonus
      })}</data>
      <small>P. Investigation</small>
    </output>
    <output aria-label="Passive Perception">
      <data>{expressions.Passive({
        attribute: 'WIS',
        proficiency: blocks.skills.Perception.proficiency,
        vantage: blocks.skills.Perception.vantage,
        bonus: blocks.skills.Perception.bonus
      })}</data>
      <small>P. Perception</small>
    </output>
    <dl aria-label="Senses List">
      <dt><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 3C4.5 3 1.6 5.3.3 8c1.3 2.7 4.2 5 7.7 5s6.4-2.3 7.7-5C14.4 5.3 11.5 3 8 3zm0 8.3a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg> Senses</dt>
      {self.senses_list.map((sense, i) => (
        <dd key={i}>
          <span>{sense.type}</span>
          {sense.range != null && <span aria-details="Sense Range">{sense.range} ft.</span>}
        </dd>
      ))}
    </dl>
  </section>
);

export default senses;
