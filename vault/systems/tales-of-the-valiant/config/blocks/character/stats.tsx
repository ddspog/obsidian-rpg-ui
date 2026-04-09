import * as React from "react";
import { EntityBlock, Stat } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { StatsProps } from "./stats.types";

const ATTRS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

/**
 * Block for displaying character stats, including core attributes and their saving throw details.
 */
export const stats: EntityBlock<StatsProps, CharacterEntity> = ({ self, expressions }) => (
  <article aria-label="Character Stats">
    {ATTRS.map((attr) => {
      const { value, save } = self[attr];
      const saveBonus = expressions.ModifierTotal({
        attribute: attr,
        proficiency: save.proficiency,
        bonus: save.bonus,
      });
      return (
        <Stat
          key={attr}
          value={value}
          saveBonus={saveBonus}
          proficiency={save.proficiency}
        >
          {attr}
        </Stat>
      );
    })}
  </article>
);

export default stats;
