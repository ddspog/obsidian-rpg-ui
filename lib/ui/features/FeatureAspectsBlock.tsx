/**
 * FeatureAspectsBlock placeholder component
 *
 * Displays a list of aspects (actions, bonus actions, passives) for a feature.
 * Placeholder for the `rpg feature.aspects` block in feature notes.
 */

interface AspectItem {
  name?: string;
  $name?: string;
  type?: "action" | "bonus" | "passive" | string;
  description?: string;
  $contents?: string;
}

export function FeatureAspectsBlock(props: Record<string, unknown>) {
  const aspects = (props.aspects ?? []) as AspectItem[];

  return (
    <div className="rpg-ui-block rpg-ui-feature-aspects-block">
      <div className="rpg-ui-block__title">Aspects</div>
      {aspects.length === 0 ? (
        <div className="rpg-ui-block__empty">No aspects defined.</div>
      ) : (
        <div className="rpg-ui-feature-aspects-block__list">
          {aspects.map((aspect, idx) => {
            const aspectName = aspect.$name ?? aspect.name ?? `Aspect ${idx + 1}`;
            const description = aspect.$contents ?? aspect.description;
            return (
              <div key={aspectName} className="rpg-ui-feature-aspects-block__item">
                <div className="rpg-ui-feature-aspects-block__header">
                  {aspect.type && (
                    <span className="rpg-ui-feature-aspects-block__type">{aspect.type}</span>
                  )}
                  <span className="rpg-ui-feature-aspects-block__name">{aspectName}</span>
                </div>
                {description && (
                  <div className="rpg-ui-feature-aspects-block__description">{description}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
