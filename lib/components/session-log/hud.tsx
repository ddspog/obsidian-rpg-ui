/**
 * HUD Component
 * Provides entity selector, summary panel, and quick-action buttons
 */

import * as React from "react";
import type { EntityData } from "lib/services/entity-resolver";
import { EntitySummary } from "./entity-summary";

export interface HUDProps {
  entities: EntityData[];
  onAppendText?: (text: string) => void;
}

export function HUD({ entities, onAppendText }: HUDProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  if (entities.length === 0) {
    return (
      <div className="lonelog-hud">
        <p className="hud-no-entities">No entities configured</p>
      </div>
    );
  }

  const selectedEntity = entities[selectedIndex];

  const handleAppendAction = (symbol: string, text: string) => {
    if (onAppendText) {
      onAppendText(`${symbol} ${text}\n`);
    }
  };

  return (
    <div className="lonelog-hud">
      {/* Entity Selector */}
      <div className="hud-entity-selector">
        {entities.length > 1 && (
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(parseInt(e.target.value, 10))}
            className="entity-dropdown"
          >
            {entities.map((entity, index) => (
              <option key={index} value={index}>
                {entity.name}
              </option>
            ))}
          </select>
        )}
        {entities.length === 1 && (
          <div className="entity-single-name">{selectedEntity.name}</div>
        )}
      </div>

      {/* Entity Summary Panel */}
      <EntitySummary entity={selectedEntity} />

      {/* Quick Action Buttons */}
      {onAppendText && (
        <div className="hud-quick-actions">
          <button
            className="quick-action-btn action-btn"
            onClick={() =>
              handleAppendAction("@", `${selectedEntity.name} takes action`)
            }
            title="Add Action"
          >
            @ Action
          </button>

          <button
            className="quick-action-btn question-btn"
            onClick={() => handleAppendAction("?", "Is something true?")}
            title="Ask Oracle"
          >
            ? Oracle
          </button>

          <button
            className="quick-action-btn roll-btn"
            onClick={() =>
              handleAppendAction("d:", "d20+0=10 vs DC 10 -> Success")
            }
            title="Add Roll"
          >
            🎲 Roll
          </button>

          <button
            className="quick-action-btn consequence-btn"
            onClick={() => {
              if (onAppendText) {
                onAppendText("=> Something happens\n");
              }
            }}
            title="Add Consequence"
          >
            ⇒ Consequence
          </button>

          <button
            className="quick-action-btn note-btn"
            onClick={() => {
              if (onAppendText) {
                onAppendText("(note: Add a note)\n");
              }
            }}
            title="Add Note"
          >
            📝 Note
          </button>
        </div>
      )}
    </div>
  );
}
