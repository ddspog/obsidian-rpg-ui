import * as React from "react";

export interface ProgressBarProps {
  /** Current value */
  value: number;
  /** Maximum value */
  max: number;
  /** Optional label shown above or as aria-label */
  label?: string;
  /** Optional CSS class appended to the root element */
  className?: string;
}

/**
 * A simple labelled progress bar.
 *
 * ```tsx
 * <ProgressBar value={self.xp} max={lookup.table.xp[level - 1]} />
 * ```
 */
export function ProgressBar({ value, max, label, className }: ProgressBarProps): React.ReactElement {
  const safeMax = max > 0 ? max : 1;
  const safeValue = Math.max(0, Math.min(value ?? 0, safeMax));
  const pct = Math.round((safeValue / safeMax) * 100);

  return (
    <div
      className={["rpg-progress-bar", className].filter(Boolean).join(" ")}
      role="meter"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label ?? "Progress"}
    >
      {label && <span className="rpg-progress-bar__label">{label}</span>}
      <div className="rpg-progress-bar__track">
        <div
          className="rpg-progress-bar__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="rpg-progress-bar__values">
        {safeValue} / {safeMax}
      </span>
    </div>
  );
}
