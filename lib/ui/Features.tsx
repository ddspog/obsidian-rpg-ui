/**
 * Features placeholder component
 *
 * Displays a list of class features, feats, and traits grouped by category.
 * Placeholder for the `rpg features` block with level gating and limited uses.
 */

import type { Feature } from "lib/systems/types";

export interface FeaturesProps {
  /** List of features to display */
  features: Feature[];
  /** Optional category label override */
  categoryLabel?: string;
}

/**
 * FeatureItem — renders a single feature with optional aspects.
 */
function FeatureItem({ feature }: { feature: Feature }) {
  return (
    <div className="rpg-ui-features__item">
      <div className="rpg-ui-features__item-header">
        {feature.type && (
          <span className="rpg-ui-features__item-type">{feature.type}</span>
        )}
        <span className="rpg-ui-features__item-name">{feature.$name}</span>
      </div>
      {feature.$contents && (
        <div className="rpg-ui-features__item-description">{feature.$contents}</div>
      )}
      {feature.aspects && feature.aspects.length > 0 && (
        <div className="rpg-ui-features__aspects">
          {feature.aspects.map((aspect) => (
            <FeatureItem key={aspect.$name} feature={aspect} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Features — displays a list of features grouped by category label.
 * Placeholder implementation; full stateful version lives in FeaturesView.
 */
export function Features({ features, categoryLabel }: FeaturesProps) {
  if (features.length === 0) {
    return <div className="rpg-ui-features rpg-ui-features--empty">No features.</div>;
  }

  return (
    <div className="rpg-ui-features">
      {categoryLabel && <div className="rpg-ui-features__category-label">{categoryLabel}</div>}
      {features.map((feature) => (
        <FeatureItem key={feature.$name} feature={feature} />
      ))}
    </div>
  );
}
