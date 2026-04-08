/**
 * ClassFeaturesBlock placeholder component
 *
 * Displays the features granted by a class at each level.
 * Placeholder for the `rpg class.features` block in class notes.
 */

interface ClassFeatureEntry {
  level: number;
  name?: string;
  $name?: string;
  description?: string;
  $contents?: string;
}

export function ClassFeaturesBlock(props: Record<string, unknown>) {
  const features = (props.features ?? []) as ClassFeatureEntry[];
  const className = props.class as string | undefined;

  return (
    <div className="rpg-ui-block rpg-ui-class-features-block">
      <div className="rpg-ui-block__title">{className ? `${className} Features` : "Class Features"}</div>
      {features.length === 0 ? (
        <div className="rpg-ui-block__empty">No features defined.</div>
      ) : (
        <div className="rpg-ui-class-features-block__list">
          {features.map((feature, idx) => {
            const featureName = feature.$name ?? feature.name ?? `Feature ${idx + 1}`;
            const description = feature.$contents ?? feature.description;
            return (
              <div key={featureName} className="rpg-ui-class-features-block__item">
                <div className="rpg-ui-class-features-block__level">Level {feature.level}</div>
                <div className="rpg-ui-class-features-block__name">{featureName}</div>
                {description && (
                  <div className="rpg-ui-class-features-block__description">{description}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
