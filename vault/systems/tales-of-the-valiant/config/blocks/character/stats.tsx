import { EntityBlock, Stat } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { StatsProps } from "./stats.types";

/**
 * Block for displaying character stats, including core attributes and their saving throw details.
 */
export const stats: EntityBlock<StatsProps, CharacterEntity> = ({ self }) => (
  <article aria-label="Character Stats">
    <Stat value={self.STR.value} save={self.STR.save}>STR</Stat>
    <Stat value={self.DEX.value} save={self.DEX.save}>DEX</Stat>
    <Stat value={self.CON.value} save={self.CON.save}>CON</Stat>
    <Stat value={self.INT.value} save={self.INT.save}>INT</Stat>
    <Stat value={self.WIS.value} save={self.WIS.save}>WIS</Stat>
    <Stat value={self.CHA.value} save={self.CHA.save}>CHA</Stat>
  </article>
);

export default stats;
