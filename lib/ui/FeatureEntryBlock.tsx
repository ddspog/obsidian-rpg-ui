/**
 * FeatureEntryBlock placeholder component
 *
 * Displays a single feature with its name, type, and description.
 * Placeholder for the `rpg feature.feature` block in feature notes.
 */

export function FeatureEntryBlock(props: Record<string, unknown>) {
  const name = (props.$name ?? props.name) as string | undefined;
  const type = props.type as string | undefined;
  const description = (props.$contents ?? props.description) as string | undefined;
  const source = props.source as string | undefined;

  return (
    <div className="rpg-ui-block rpg-ui-feature-entry-block">
      <div className="rpg-ui-feature-entry-block__header">
        {type && <span className="rpg-ui-feature-entry-block__type">{type}</span>}
        {name && <span className="rpg-ui-feature-entry-block__name">{name}</span>}
        {source && <span className="rpg-ui-feature-entry-block__source">{source}</span>}
      </div>
      {description && (
        <div className="rpg-ui-feature-entry-block__description">{description}</div>
      )}
    </div>
  );
}
