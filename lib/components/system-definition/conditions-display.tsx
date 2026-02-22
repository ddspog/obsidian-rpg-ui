import * as React from "react";

interface Condition {
  name: string;
  icon?: string;
  description?: string;
  [key: string]: unknown;
}

interface ConditionsDisplayProps {
  conditions: Condition[];
}

export function ConditionsDisplay(props: ConditionsDisplayProps): JSX.Element {
  return (
    <div className="system-conditions-display">
      <div className="system-conditions-header">
        <span className="system-conditions-icon">🩹</span>
        <h4 className="system-conditions-title">Conditions Definition</h4>
        <span className="system-conditions-count">{props.conditions.length} conditions</span>
      </div>

      <div className="system-conditions-list">
        {props.conditions.map((condition, index) => (
          <div key={index} className="system-condition-card">
            <div className="system-condition-header">
              {condition.icon && (
                <span className="system-condition-card-icon">{condition.icon}</span>
              )}
              <strong className="system-condition-name">{condition.name}</strong>
            </div>
            {condition.description && (
              <div className="system-condition-description">{condition.description}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
