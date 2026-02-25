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
  const buttons = [] as number[];
  for (let i = 1; i <= Math.max(1, (maxPoints || 5)); i++) buttons.push(i);

  const handleClick = (n: number) => {
    if (inspiration === n) return onUpdateInspiration(0);
    return onUpdateInspiration(n);
  };

  return (
    <div className={["rpg-inspirational-level", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={`Inspiration: ${inspiration} of ${maxPoints}, level ${level}`}>
      <div className="rpg-inspirational-level__level">{level}</div>
      <div className="rpg-inspirational-level__points" aria-hidden={true}>
        {buttons.map((n) => (
          <button
            key={n}
            type="button"
            className={"rpg-inspirational-level__point " + (n <= inspiration ? "is-active" : "")}
            aria-pressed={n <= inspiration}
            aria-label={`${n} inspiration point${n > 1 ? "s" : ""}`}
            onClick={() => handleClick(n)}
          >
            <span className="rpg-inspirational-level__point-dot" />
          </button>
        ))}
      </div>
    </div>
  );
}
