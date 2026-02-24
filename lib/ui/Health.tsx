/**
 * Health placeholder component
 *
 * Renders a health/HP display panel. Placeholder for the upcoming `rpg healthpoints` block
 * with full caster support, hit dice, and death saves.
 */

export interface HealthProps {
  /** Maximum hit points */
  maxHp: number;
  /** Current hit points */
  currentHp: number;
  /** Temporary hit points */
  tempHp?: number;
  /** Optional label to display */
  label?: string;
}

/**
 * Health — displays current HP as a bar with numeric readout.
 * Placeholder implementation; full stateful version lives in HealthView.
 */
export function Health({ maxHp, currentHp, tempHp = 0, label }: HealthProps) {
  const percentage = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

  return (
    <div className="rpg-ui-health">
      {label && <div className="rpg-ui-health__label">{label}</div>}
      <div className="rpg-ui-health__readout">
        <span className="rpg-ui-health__current">{currentHp}</span>
        <span className="rpg-ui-health__separator"> / </span>
        <span className="rpg-ui-health__max">{maxHp}</span>
        {tempHp > 0 && <span className="rpg-ui-health__temp"> (+{tempHp})</span>}
      </div>
      <div
        className="rpg-ui-health__bar"
        role="progressbar"
        aria-valuenow={currentHp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
      >
        <div className="rpg-ui-health__bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
