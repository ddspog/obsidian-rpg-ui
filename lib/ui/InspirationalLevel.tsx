import * as React from "react";

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

export function InspirationalLevel({ level, inspiration, maxPoints, onUpdateInspiration, className }: InspirationalLevelProps) {
  const count = Math.max(1, maxPoints || 5);
  const buttons: number[] = [];
  for (let i = 1; i <= count; i++) buttons.push(i);

  const handleClick = (n: number) => {
    if (inspiration === n) return onUpdateInspiration(0);
    return onUpdateInspiration(n);
  };

  // Radius as a percentage of the container's half-width (container is 72px, half = 36px).
  // Buttons are positioned along a circle whose radius leaves them on the edge (≈ 85% from centre).
  const radiusPct = 92; // % offset from the 50% centre — make placement much more pronounced (clearly outside badge)

  return (
    <figure
      className={["rpg-inspirational-level", className].filter(Boolean).join(" ")}
      aria-details="Inspirational Level"
      aria-label={`Inspiration: ${inspiration} of ${maxPoints}, level ${level}`}
      title="Inspiration"
    >
      {/* Central badge — shows current inspiration count (semantic output) */}
      <output className="rpg-inspirational-level__level">{inspiration}</output>

      {/* Radially-positioned dot buttons (semantic menu) */}
      <menu className="rpg-inspirational-level__points" aria-label="Inspiration points">
        {buttons.map((n) => {
          // Distribute buttons evenly, starting from the top (−90°)
          const angleDeg = (n - 1) / count * 360 - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          // Convert to percentage offsets from the top-left of the container.
          // radiusPct is a percentage of the container's half-width (e.g. 72 means 72% of 36px).
          // To convert that to a percent offset of the full container (for CSS %), halve it.
          const offsetPercent = radiusPct / 2;
          const leftPct = 50 + offsetPercent * Math.cos(angleRad);
          const topPct  = 50 + offsetPercent * Math.sin(angleRad);

          return (
            <button
              key={n}
              type="button"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className={"rpg-inspirational-level__point " + (n <= inspiration ? "is-active" : "")}
              aria-pressed={n <= inspiration}
              aria-label={`${n} inspiration point${n > 1 ? "s" : ""}`}
              onClick={() => handleClick(n)}
            >
              <span className="rpg-inspirational-level__point-dot" />
            </button>
          );
        })}
      </menu>
    </figure>
  );
}
