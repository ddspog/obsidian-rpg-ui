/**
 * Statblock placeholder component
 *
 * Renders an NPC or monster stat block in the classic D&D-style layout.
 * Placeholder for the `rpg entity.statblock` block definition registered
 * via BlockDefinition in the monster entity config.
 */

import type { AttributeDefinition } from "lib/systems/types";

export interface StatblockProps {
  /** Creature name */
  name: string;
  /** Size and type string (e.g. "Medium humanoid (goblinoid)") */
  sizeType?: string;
  /** Alignment (e.g. "Neutral Evil") */
  alignment?: string;
  /** Armor Class */
  ac?: number;
  /** AC source description (e.g. "leather armor") */
  acSource?: string;
  /** Hit points */
  hp?: number;
  /** Hit dice expression (e.g. "2d6+2") */
  hitDice?: string;
  /** Speed (e.g. "30 ft.") */
  speed?: string;
  /** Attribute scores keyed by attribute identifier */
  scores?: Record<string, number>;
  /** Attribute definitions from the active system */
  attributes?: AttributeDefinition[];
  /** Challenge rating */
  cr?: number | string;
  /** Proficiency bonus */
  proficiencyBonus?: number;
}

/**
 * Statblock — renders a creature stat block in a columnar format.
 * Placeholder implementation; intended to be registered as a BlockDefinition
 * component in the monster entity's `blocks.statblock` definition.
 */
export function Statblock({
  name,
  sizeType,
  alignment,
  ac,
  acSource,
  hp,
  hitDice,
  speed,
  scores = {},
  attributes = [],
  cr,
  proficiencyBonus,
}: StatblockProps) {
  return (
    <div className="rpg-ui-statblock">
      <div className="rpg-ui-statblock__header">
        <div className="rpg-ui-statblock__name">{name}</div>
        {(sizeType || alignment) && (
          <div className="rpg-ui-statblock__meta">
            {[sizeType, alignment].filter(Boolean).join(", ")}
          </div>
        )}
      </div>

      <div className="rpg-ui-statblock__divider" />

      <div className="rpg-ui-statblock__basics">
        {ac !== undefined && (
          <div className="rpg-ui-statblock__basic">
            <strong>Armor Class</strong> {ac}
            {acSource && ` (${acSource})`}
          </div>
        )}
        {hp !== undefined && (
          <div className="rpg-ui-statblock__basic">
            <strong>Hit Points</strong> {hp}
            {hitDice && ` (${hitDice})`}
          </div>
        )}
        {speed && (
          <div className="rpg-ui-statblock__basic">
            <strong>Speed</strong> {speed}
          </div>
        )}
      </div>

      {attributes.length > 0 && (
        <>
          <div className="rpg-ui-statblock__divider" />
          <div className="rpg-ui-statblock__attributes">
            {attributes.map((attr) => {
              const score = scores[attr.$name] ?? 10;
              const modifier = Math.floor((score - 10) / 2);
              const sign = modifier >= 0 ? "+" : "";
              return (
                <div key={attr.$name} className="rpg-ui-statblock__attribute">
                  <div className="rpg-ui-statblock__attribute-label">
                    {attr.alias ?? attr.$name.slice(0, 3).toUpperCase()}
                  </div>
                  <div className="rpg-ui-statblock__attribute-value">
                    {score} ({sign}{modifier})
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(cr !== undefined || proficiencyBonus !== undefined) && (
        <>
          <div className="rpg-ui-statblock__divider" />
          <div className="rpg-ui-statblock__challenge">
            {cr !== undefined && (
              <div className="rpg-ui-statblock__basic">
                <strong>Challenge</strong> {cr}
              </div>
            )}
            {proficiencyBonus !== undefined && (
              <div className="rpg-ui-statblock__basic">
                <strong>Proficiency Bonus</strong> +{proficiencyBonus}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
