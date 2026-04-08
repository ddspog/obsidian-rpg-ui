/**
 * SpellInfoBlock placeholder component
 *
 * Displays metadata about a spell: level, school, components, and description.
 * Placeholder for the `rpg spell.info` block in spell notes.
 */

export function SpellInfoBlock(props: Record<string, unknown>) {
  const name = props.name as string | undefined;
  const level = props.level as string | number | undefined;
  const school = props.school as string | undefined;
  const components = props.components as string | string[] | undefined;
  const description = props.description as string | undefined;

  const componentsStr = Array.isArray(components) ? components.join(", ") : components;
  const levelLabel = level === 0 || level === "0" ? "Cantrip" : level !== undefined ? `Level ${level}` : undefined;

  return (
    <div className="rpg-ui-block rpg-ui-spell-info-block">
      {name && <div className="rpg-ui-block__title">{name}</div>}
      <div className="rpg-ui-spell-info-block__meta">
        {levelLabel && (
          <span className="rpg-ui-spell-info-block__level">{levelLabel}</span>
        )}
        {school && (
          <span className="rpg-ui-spell-info-block__school">{school}</span>
        )}
        {componentsStr && (
          <span className="rpg-ui-spell-info-block__components">{componentsStr}</span>
        )}
      </div>
      {description && (
        <div className="rpg-ui-spell-info-block__description">{description}</div>
      )}
    </div>
  );
}
