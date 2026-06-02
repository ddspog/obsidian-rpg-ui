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
    <svg aria-details="Progress Numbered" height="32">
      <defs>
        <linearGradient id="rpg-numbered-fill-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4a9" />
          <stop offset="60%" stopColor="#e07b39" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <rect className="rpg-numbered-track" x="0" y="0" width="100%" height="100%" rx="3" />
      <rect className="rpg-numbered-fill" x="0" y="0" width={`${pct}%`} height="100%" rx="3" />
      {ticks.map((n) => (
        <text
          key={n}
          className="rpg-numbered-tick"
          x={`${((n - 0.5) / max) * 100}%`}
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          data-active={n <= clamped ? "true" : "false"}
        >
          {n}
        </text>
      ))}
    </svg>
  );
}
