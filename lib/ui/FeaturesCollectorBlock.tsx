/**
 * FeaturesCollectorBlock placeholder component
 *
 * Displays a list of features gathered for the character across all sources.
 * Placeholder for the `rpg character.features` block in character notes.
 */

interface FeatureItem {
  name?: string;
  $name?: string;
  type?: string;
  description?: string;
  $contents?: string;
}

export function FeaturesCollectorBlock(props: Record<string, unknown>) {
  const features = (props.features ?? []) as FeatureItem[];
  const title = (props.title as string | undefined) ?? "Features";

  return (
    <div className="rpg-ui-block rpg-ui-features-collector-block">
      <div className="rpg-ui-block__title">{title}</div>
      {features.length === 0 ? (
        <div className="rpg-ui-block__empty">No features.</div>
      ) : (
        <div className="rpg-ui-features-collector-block__list">
          {features.map((feature, idx) => {
            const featureName = feature.$name ?? feature.name ?? `Feature ${idx + 1}`;
            const description = feature.$contents ?? feature.description;
            return (
              <div key={featureName} className="rpg-ui-features-collector-block__item">
                {feature.type && (
                  <span className="rpg-ui-features-collector-block__type">{feature.type}</span>
                )}
                <span className="rpg-ui-features-collector-block__name">{featureName}</span>
                {description && (
                  <div className="rpg-ui-features-collector-block__description">{description}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
