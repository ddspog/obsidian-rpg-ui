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
      {/* Icon rendered via CSS ::before (ideal: inline SVG eye icon) */}
      <dt className="rpg-tag-heading"><span>Senses</span></dt>
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
