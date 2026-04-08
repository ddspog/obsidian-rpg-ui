/**
 * HealthBlock placeholder component
 *
 * Displays current, maximum, and temporary hit points for an entity.
 * Placeholder for the `rpg character.health` block in character notes.
 */

export function HealthBlock(props: Record<string, unknown>) {
  const maxHp = Number(props.max_hp ?? props.maxHp ?? 0);
  const currentHp = Number(props.current_hp ?? props.currentHp ?? maxHp);
  const tempHp = Number(props.temp_hp ?? props.tempHp ?? 0);
  const label = props.label as string | undefined;

  const percentage = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

  return (
    <div className="rpg-ui-block rpg-ui-health-block">
      {label && <div className="rpg-ui-block__label">{label}</div>}
      <div className="rpg-ui-health-block__readout">
        <span className="rpg-ui-health-block__current">{currentHp}</span>
        <span className="rpg-ui-health-block__separator"> / </span>
        <span className="rpg-ui-health-block__max">{maxHp}</span>
        {tempHp > 0 && <span className="rpg-ui-health-block__temp"> (+{tempHp})</span>}
      </div>
      <div
        className="rpg-ui-health-block__bar"
        role="progressbar"
        aria-valuenow={currentHp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
      >
        <div className="rpg-ui-health-block__bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
