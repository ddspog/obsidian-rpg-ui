import * as React from "react";

export interface ProgressHealthProps {
  /** Current HP value */
  value: number;
  /** Maximum HP value */
  max: number;
  /** Secondary value (e.g. temp HP) shown as a second color segment */
  secondary?: number;
  /** Label shown above the bar (e.g. "HIT POINTS") */
  label?: string;
}

/**
 * A health-specific progress bar with values displayed inside the fill.
 * Supports a secondary segment (temp HP) rendered in a different color.
 *
 * ```tsx
 * <ProgressHealth label="HIT POINTS" value={32} max={58} secondary={5} />
 * ```
 */
export function ProgressHealth({ value, max, secondary = 0, label }: ProgressHealthProps): React.ReactElement {
  const safeMax = max > 0 ? max : 1;
  const safeValue = Math.max(0, Math.min(value ?? 0, safeMax));
  const safeSecondary = Math.max(0, secondary ?? 0);
  const total = safeMax + safeSecondary;

  // Green fill: current HP relative to the full bar (max + temp)
  const primaryPercent = (safeValue / total) * 100;

  // Blue segment position: starts where max HP ends on the full bar scale
  const secondaryLeft = (safeMax / total) * 100;

  // Blue segment width:
  // - 0 or 1: CSS min-width only (no proportional growth)
  // - 2+: proportional to temp / total
  const secondaryWidth = safeSecondary >= 2
    ? `calc(var(--temp-min-w) + ${(safeSecondary / total) * 100}%)`
    : undefined;

  return (
    <figure aria-details="Progress Health">
      {label && <figcaption>{label}</figcaption>}
      <div
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
      >
        <div aria-details="Bar Fill" style={{ width: `${primaryPercent}%` }} />
        <div
          aria-details="Bar Secondary"
          data-empty={safeSecondary === 0 || undefined}
          style={{ left: `${secondaryLeft}%`, width: secondaryWidth }}
        />
        <output>
          {safeValue} / {safeMax}
          <span aria-details="Secondary Value">+{safeSecondary}</span>
        </output>
      </div>
    </figure>
  );
}
