import * as React from "react";

interface SpellcastingData {
  ability?: string;
  spells_known?: number | string;
  cantrips_known?: number | string;
  spell_slots?: Record<string, number>;
  [key: string]: unknown;
}

interface SpellcastingDisplayProps {
  data: SpellcastingData;
}

export function SpellcastingDisplay(props: SpellcastingDisplayProps): JSX.Element {
  return (
    <div className="system-spellcasting-display">
      <div className="system-spellcasting-header">
        <span className="system-spellcasting-icon">🔮</span>
        <h4 className="system-spellcasting-title">Spellcasting Definition</h4>
      </div>

      <div className="system-spellcasting-content">
        {props.data.ability && (
          <div className="system-spellcasting-row">
            <span className="system-spellcasting-label">Spellcasting Ability:</span>
            <span className="system-spellcasting-value">{props.data.ability}</span>
          </div>
        )}

        {props.data.cantrips_known && (
          <div className="system-spellcasting-row">
            <span className="system-spellcasting-label">Cantrips Known:</span>
            <span className="system-spellcasting-value">{props.data.cantrips_known}</span>
          </div>
        )}

        {props.data.spells_known && (
          <div className="system-spellcasting-row">
            <span className="system-spellcasting-label">Spells Known:</span>
            <span className="system-spellcasting-value">{props.data.spells_known}</span>
          </div>
        )}

        {props.data.spell_slots && Object.keys(props.data.spell_slots).length > 0 && (
          <div className="system-spellcasting-slots">
            <span className="system-spellcasting-label">Spell Slots:</span>
            <div className="system-spellcasting-slots-grid">
              {Object.entries(props.data.spell_slots).map(([level, count]) => (
                <div key={level} className="system-spellcasting-slot">
                  <span className="system-slot-level">Level {level}:</span>
                  <span className="system-slot-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
