import * as React from "react";

export interface ExhaustionBarProps {
  /** Current exhaustion level 0–6 */
  value?: number;
}

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

export function ExhaustionBar({ value = 0 }: ExhaustionBarProps) {
  const level = Math.max(0, Math.min(6, value));
  const pct = (level / 6) * 100;

  return (
    <figure aria-details="Exhaustion Bar">
      <figcaption>Exhaustion</figcaption>
      <div aria-details="Exhaustion Track">
        <div aria-details="Exhaustion Fill" style={{ width: `${pct}%` }} />
        {LEVELS.map((n) => (
          <span
            key={n}
            aria-details="Exhaustion Tick"
            style={{ left: `${(n / 6) * 100}%` }}
            data-active={n <= level ? "true" : "false"}
          >
            {n}
          </span>
        ))}
      </div>
    </figure>
  );
}
