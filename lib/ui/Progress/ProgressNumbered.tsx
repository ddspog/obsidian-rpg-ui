import * as React from "react";

export interface ProgressNumberedProps {
  /** Current value */
  value?: number;
  /** Maximum value (determines number of ticks) */
  max?: number;
}

export function ProgressNumbered({ value = 0, max = 6 }: ProgressNumberedProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const ticks = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div aria-details="Progress Numbered">
      <div aria-details="Progress Numbered Fill" style={{ width: `${pct}%` }} />
      {ticks.map((n) => (
        <span
          key={n}
          aria-details="Progress Numbered Tick"
          style={{ left: `${((n - 0.5) / max) * 100}%` }}
          data-active={n <= clamped ? "true" : "false"}
        >
          {n}
        </span>
      ))}
    </div>
  );
}
