import { EntityBlock, TriggerButton } from "rpg-ui-toolkit";
import { AttacksProps } from "./attacks.types";
import { CharacterEntity } from "../../entities/character.types";

export const attacks: EntityBlock<AttacksProps, CharacterEntity> = ({ self, trigger }) => (
  <article aria-label="Favorite Attacks">
    <table className="rpg-attacks-table">
      <tbody>
        {(Array.isArray(self.attacks) ? self.attacks : []).map((atk, i) => (
          <tr key={i} className="rpg-attack-row">
            <th className="rpg-attack-name" scope="row">{atk.name || atk.label || `Attack ${i + 1}`}</th>
            <td className="rpg-attack-meta">
              {atk.to_hit !== undefined && <span className="rpg-attack-item__tohit">{atk.to_hit >= 0 ? `+${atk.to_hit}` : atk.to_hit}</span>}
              {atk.range && <span className="rpg-attack-item__range">{atk.range}</span>}
              {atk.damage && <span className="rpg-attack-item__damage">{atk.damage.roll} {atk.damage.type}</span>}
            </td>
            <td className="rpg-attack-actions">
              <TriggerButton onClick={() => trigger(`attack:${i}`)} icon="🎲">Roll</TriggerButton>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </article>
);

export default attacks;
