/**
 * SpellEffectsBlock placeholder component
 *
 * Displays the mechanical effects of a spell: casting time, range, area, duration.
 * Placeholder for the `rpg spell.effects` block in spell notes.
 */

export function SpellEffectsBlock(props: Record<string, unknown>) {
  const castingTime = props.casting_time ?? props.castingTime;
  const range = props.range;
  const area = props.area;
  const duration = props.duration;
  const concentration = props.concentration as boolean | undefined;
  const ritual = props.ritual as boolean | undefined;

  const entries = (
    [
      ["Casting Time", castingTime],
      ["Range", range],
      ["Area", area],
      ["Duration", duration],
    ] as Array<[string, unknown]>
  ).filter(([, v]) => v !== undefined && v !== null && v !== "");

  return (
    <div className="rpg-ui-block rpg-ui-spell-effects-block">
      <div className="rpg-ui-block__title">Spell Effects</div>
      <div className="rpg-ui-spell-effects-block__entries">
        {entries.map(([key, value]) => (
          <div key={key} className="rpg-ui-spell-effects-block__entry">
            <span className="rpg-ui-spell-effects-block__key">{key}</span>
            <span className="rpg-ui-spell-effects-block__value">{String(value)}</span>
          </div>
        ))}
      </div>
      {(concentration || ritual) && (
        <div className="rpg-ui-spell-effects-block__tags">
          {concentration && <span className="rpg-ui-spell-effects-block__tag">Concentration</span>}
          {ritual && <span className="rpg-ui-spell-effects-block__tag">Ritual</span>}
        </div>
      )}
    </div>
  );
}
