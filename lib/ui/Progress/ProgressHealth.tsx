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
 * A health-specific progress bar rendered as an inline SVG.
 *
 * ```tsx
 * <ProgressHealth value={32} max={58} secondary={5} />
 * ```
 */
export function ProgressHealth({ value, max, secondary = 0 }: ProgressHealthProps): React.ReactElement {
  const safeMax = max > 0 ? max : 1;
  const safeValue = Math.max(0, Math.min(value ?? 0, safeMax));
  const safeSecondary = Math.max(0, secondary ?? 0);
  const total = safeMax + safeSecondary;

  const primaryPct = `${(safeValue / total) * 100}%`;

  // Enforce minimum visible width for the secondary segment
  const rawSecondaryPct = safeSecondary >= 1 ? (safeSecondary / total) * 100 : 0;
  const secondaryPct = rawSecondaryPct > 0 ? `${Math.max(rawSecondaryPct, 8)}%` : "0%";

  return (
    <svg
      aria-details="Progress Health"
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      height="32"
    >
      <rect className="rpg-hp-track" x="0" y="0" width="100%" height="100%" />
      <rect className="rpg-hp-fill" x="0" y="0" width={primaryPct} height="100%" />
      {rawSecondaryPct > 0 && (
        <rect className="rpg-hp-secondary" x={`calc(100% - ${secondaryPct})`} y="0" width={secondaryPct} height="100%" />
      )}
      <foreignObject x="0" y="0" width="100%" height="100%">
        <output aria-label="HP Summary">
          {safeValue} / {safeMax}
          <span aria-details="Secondary Value">+{safeSecondary}</span>
        </output>
      </foreignObject>
    </svg>
  );
}
