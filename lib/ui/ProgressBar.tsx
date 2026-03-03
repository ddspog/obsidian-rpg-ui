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

  return (
    <figure aria-details="Progress Bar" className={className}>
      <figcaption>
        {label && <span>{label}</span>}
        {safeValue} / {safeMax}
      </figcaption>
      <progress value={safeValue} max={safeMax} />
    </figure>
  );
}
