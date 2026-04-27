import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { AttacksProps } from "./attacks.types";
import { CharacterEntity } from "../../entities/character.types";

function formatHit(n: number) {
  return (n >= 0 ? "+" : "\u2212") + Math.abs(n);
}

export const attacks: EntityBlock<AttacksProps, CharacterEntity> = ({ self }) => (
  <section aria-label="Favorite Attacks">
    <header className="rpg-tag-heading"><span>Attacks</span></header>
    <table>
      <thead>
        <tr>
          <th aria-label="Icon"></th>
          <th>Name</th>
          <th>Hit</th>
          <th>Range</th>
          <th>Damage</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {(Array.isArray(self.attacks) ? self.attacks : []).map((atk, i) => (
          <tr key={i}>
            <td className="rpg-attack-icon">
              <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
                <path fill="currentColor" d="M9.5 1l-1 3.5L5 8l-3.5 1L0 10.5l2 2 2.5-.5L7 14.5 8.5 16l1.5-1.5L8.5 12l2.5-2.5L14.5 8 16 6.5 14 4.5l-2.5.5L9 2.5z"/>
              </svg>
            </td>
            <td className="rpg-attack-name">{atk.name || atk.label || `Attack ${i + 1}`}</td>
            <td className="rpg-attack-hit">{atk.to_hit !== undefined ? formatHit(atk.to_hit) : ""}</td>
            <td className="rpg-attack-range">{atk.range ?? ""}</td>
            <td className="rpg-attack-damage">{atk.damage ? `${atk.damage.roll} ${atk.damage.type}` : ""}</td>
            <td className="rpg-attack-notes">{atk.notes ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

export default attacks;
