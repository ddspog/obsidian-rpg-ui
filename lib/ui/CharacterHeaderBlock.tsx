/**
 * CharacterHeaderBlock placeholder component
 *
 * Displays a character header with name, classes, race, and background.
 * Placeholder for the `rpg character.header` block in character notes.
 */

export function CharacterHeaderBlock(props: Record<string, unknown>) {
  const name = props.name as string | undefined;
  const classes = props.classes as Array<{ name: string; level: number }> | undefined;
  const race = props.race as string | undefined;
  const background = props.background as string | undefined;

  const totalLevel =
    Array.isArray(classes) && classes.every((c) => c.level !== undefined)
      ? classes.reduce((sum, c) => sum + c.level, 0)
      : undefined;
  const classLine = Array.isArray(classes) ? classes.map((c) => `${c.name} ${c.level}`).join(" / ") : undefined;

  return (
    <div className="rpg-ui-block rpg-ui-character-header-block">
      {name && <div className="rpg-ui-block__title">{name}</div>}
      {classLine && (
        <div className="rpg-ui-block__detail">
          <span className="rpg-ui-block__detail-key">Class</span>
          <span className="rpg-ui-block__detail-value">{classLine}</span>
          {totalLevel !== undefined && (
            <span className="rpg-ui-block__detail-extra">(Level {totalLevel})</span>
          )}
        </div>
      )}
      {race && (
        <div className="rpg-ui-block__detail">
          <span className="rpg-ui-block__detail-key">Race</span>
          <span className="rpg-ui-block__detail-value">{race}</span>
        </div>
      )}
      {background && (
        <div className="rpg-ui-block__detail">
          <span className="rpg-ui-block__detail-key">Background</span>
          <span className="rpg-ui-block__detail-value">{background}</span>
        </div>
      )}
    </div>
  );
}
