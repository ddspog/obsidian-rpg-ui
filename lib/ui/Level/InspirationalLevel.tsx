import * as React from "react";
import { CircleBadge } from "../Badge/CircleBadge";
import { StarDot } from "../Stat/StarDot";

export interface InspirationalLevelProps {
  /** Current computed character level */
  level: number;
  /** Current inspiration points (0..maxPoints) */
  inspiration: number;
  /** Maximum inspiration points */
  maxPoints: number;
  /** Called when the user updates inspiration; value is 0..maxPoints */
  onUpdateInspiration: (value: number) => void;
  className?: string;
}

export function InspirationalLevel({
  level,
  inspiration,
  maxPoints,
  onUpdateInspiration,
  className,
}: InspirationalLevelProps) {
  const count = Math.max(1, maxPoints || 5);
  const buttons: number[] = [];
  for (let i = 1; i <= count; i++) buttons.push(i);

  const handleClick = (n: number) => {
    if (inspiration === n) return onUpdateInspiration(0);
    return onUpdateInspiration(n);
  };

  // radiusPct = % of the container half-width (36px) used as the orbital radius.
  // 100 => dots centered exactly on the perimeter of the 72px figure square.
  const radiusPct = 100;

  return (
    <figure aria-details="Inspirational Level">
      {/* Decorative medallion ring — fills the full figure area */}
      <CircleBadge ringColor="var(--rpg-badge-ring, #2d2a27)" decorColor="var(--rpg-badge-decor, #e3dcce)" />

      {/* Central badge — shows current character level (semantic output) */}
      <output aria-details="Character Level">{level}</output>

      {/* Radially-positioned dot buttons (semantic menu) */}
      <menu aria-details="Inspiration Points">
        {buttons.map((n) => {
          // Distribute buttons evenly, starting from the top (−90°)
          const angleDeg = ((n - 1) / count) * 360 - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          // Convert to percentage offsets from the top-left of the container.
          // radiusPct is a percentage of the container's half-width (e.g. 72 means 72% of 36px).
          // To convert that to a percent offset of the full container (for CSS %), halve it.
          const offsetPercent = radiusPct / 2;
          const leftPct = 50 + offsetPercent * Math.cos(angleRad);
          const topPct = 50 + offsetPercent * Math.sin(angleRad);

          return (
            <button
              key={n}
              type="button"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              aria-pressed={n <= inspiration}
              aria-label={`${n} inspiration point${n > 1 ? "s" : ""}`}
              onClick={() => handleClick(n)}
            >
              <StarDot
                fillColor={n <= inspiration ? "var(--rpg-star-active-fill, #7a5500)" : "var(--rpg-star-fill, #2d2a27)"}
                decorColor={
                  n <= inspiration ? "var(--rpg-star-active-decor, #FFD400)" : "var(--rpg-star-decor, #e3dcce)"
                }
                accentColor={
                  n <= inspiration ? "var(--rpg-star-active-accent, #4a3200)" : "var(--rpg-star-accent, #3c3833)"
                }
                highlightColor={
                  n <= inspiration ? "var(--rpg-star-active-highlight, #fffacc)" : "var(--rpg-star-highlight, #f0ece0)"
                }
              />
            </button>
          );
        })}
      </menu>
    </figure>
  );
}
