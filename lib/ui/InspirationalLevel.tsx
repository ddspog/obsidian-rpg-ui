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
  const radiusPct = 50; // % offset from the 50% centre, reaching the outer rim

  return (
    <div
      className={["rpg-inspirational-level", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={`Inspiration: ${inspiration} of ${maxPoints}, level ${level}`}
      title="Inspiration"
    >
      {/* Central badge — shows current inspiration count */}
      <div className="rpg-inspirational-level__level">{inspiration}</div>

      {/* Radially-positioned dot buttons */}
      <div className="rpg-inspirational-level__points" aria-hidden={true}>
        {buttons.map((n) => {
          // Distribute buttons evenly, starting from the top (−90°)
          const angleDeg = (n - 1) / count * 360 - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          // Convert to percentage offsets from the top-left of the container
          const leftPct = 50 + radiusPct * Math.cos(angleRad);
          const topPct  = 50 + radiusPct * Math.sin(angleRad);

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
      </div>
    </div>
  );
}
