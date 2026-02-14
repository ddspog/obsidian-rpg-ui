/**
 * Features component
 * 
 * Displays class features, feats, and traits.
 * Phase 2: Read-only display with basic requirement checking.
 */

import { FeaturesBlock, FeatureCategory, Feature, areRequirementsMet } from "lib/domains/features";
import { RPGSystem } from "lib/systems/types";

interface FeaturesProps {
  data: FeaturesBlock;
  level: number;
  attributes: Record<string, number>;
  availableFeatures: string[];
  system: RPGSystem;
}

function FeatureItem({
  feature,
  isMet,
  system,
}: {
  feature: Feature;
  isMet: boolean;
  system: RPGSystem;
}) {
  // Find feature type definition from system
  const featureType = feature.type
    ? system.features.categories.find((ft) => ft.id === feature.type)
    : undefined;

  return (
    <div className={`rpg-feature-item ${!isMet ? "rpg-feature-unmet" : ""}`}>
      <div className="rpg-feature-header">
        <span className="rpg-feature-name">{feature.name}</span>
        {featureType && (
          <span className="rpg-feature-type" title={featureType.label}>
            {featureType.icon && <span className="rpg-feature-type-icon">{featureType.icon}</span>}
            {featureType.label}
          </span>
        )}
        {feature.level && <span className="rpg-feature-level">Lvl {feature.level}</span>}
        {feature.uses && (
          <span className="rpg-feature-uses">
            {feature.uses} use{feature.uses > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {feature.description && (
        <div className="rpg-feature-description">{feature.description}</div>
      )}
      {!isMet && feature.requires && (
        <div className="rpg-feature-requirement">
          {feature.requires.level && `Requires level ${feature.requires.level}`}
          {feature.requires.feature && `Requires: ${feature.requires.feature}`}
          {feature.requires.attribute &&
            Object.entries(feature.requires.attribute)
              .map(([attr, min]) => `${attr} ${min}+`)
              .join(", ")}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  level,
  attributes,
  availableFeatures,
  system,
}: {
  category: FeatureCategory;
  level: number;
  attributes: Record<string, number>;
  availableFeatures: string[];
  system: RPGSystem;
}) {
  const categoryMet = areRequirementsMet(category.requires, {
    level,
    attributes,
    availableFeatures,
  });

  if (!categoryMet && !category.features?.some((f) => !f.level || f.level <= level)) {
    return null;
  }

  return (
    <div className="rpg-feature-category">
      <h4 className="rpg-category-title">
        {category.icon && <span className="rpg-category-icon">{category.icon}</span>}
        {category.name}
      </h4>
      <div className="rpg-features-list">
        {category.features?.map((feature, idx) => {
          const featureMet = areRequirementsMet(feature.requires, {
            level,
            attributes,
            availableFeatures,
          });
          return <FeatureItem key={idx} feature={feature} isMet={featureMet} system={system} />;
        })}
        {category.choices?.map((choice, idx) => (
          <div key={`choice-${idx}`} className="rpg-feature-choice">
            <div className="rpg-choice-header">
              <span className="rpg-choice-name">{choice.name}</span>
              <span className="rpg-choice-pick">
                Pick {choice.pick} of {choice.options.length}
              </span>
            </div>
            <div className="rpg-choice-options">
              {choice.options.map((option, optIdx) => (
                <div key={optIdx} className="rpg-choice-option">
                  {option}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Features({ data, level, attributes, availableFeatures, system }: FeaturesProps) {
  return (
    <div className="rpg-features">
      {data.class && (
        <div className="rpg-features-header">
          <h3 className="rpg-features-class">{data.class}</h3>
        </div>
      )}
      {data.categories.map((category, idx) => (
        <CategorySection
          key={idx}
          category={category}
          level={level}
          attributes={attributes}
          availableFeatures={availableFeatures}
          system={system}
        />
      ))}
    </div>
  );
}
