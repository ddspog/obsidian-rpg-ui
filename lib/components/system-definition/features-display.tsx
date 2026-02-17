import * as React from "react";

interface Feature {
  name: string;
  description?: string;
  level?: number;
  uses?: number | string;
  [key: string]: unknown;
}

interface FeaturesDisplayProps {
  features: Feature[];
}

export function FeaturesDisplay(props: FeaturesDisplayProps): JSX.Element {
  return (
    <div className="system-features-display">
      <div className="system-features-header">
        <span className="system-features-icon">✨</span>
        <h4 className="system-features-title">Features Definition</h4>
        <span className="system-features-count">{props.features.length} features</span>
      </div>

      <div className="system-features-list">
        {props.features.map((feature, index) => (
          <div key={index} className="system-feature-card">
            <div className="system-feature-header">
              <strong className="system-feature-name">{feature.name}</strong>
              {feature.level && (
                <span className="system-feature-level">Level {feature.level}</span>
              )}
            </div>
            {feature.description && (
              <div className="system-feature-description">{feature.description}</div>
            )}
            {feature.uses && (
              <div className="system-feature-uses">
                Uses: {feature.uses}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
