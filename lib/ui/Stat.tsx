import * as React from "react";

export interface StatProps {
  /** Base ability score value (e.g. 10) */
  value: number;
  /** Proficiency/save modifier or boolean; may be any structure from the system */
  save?: unknown;
  className?: string;
  children?: React.ReactNode;
}

function modifierFromScore(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}

export function Stat({ value, save, children, className }: StatProps) {
  const mod = modifierFromScore(value);
  const modText = (mod >= 0 ? "+" : "") + String(mod);

  return (
    <div className={["rpg-stat", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={`Stat ${children} with value ${value} modifier ${modText}`}>
      <div className="rpg-stat__label">{children}</div>
      <div className="rpg-stat__modifier">{modText}</div>
      <div className="rpg-stat__value">{value}</div>
      {save !== undefined && (
        <div className="rpg-stat__save" aria-hidden="true">{typeof save === 'number' ? (save >= 0 ? `+${save}` : String(save)) : (save ? '✓' : '')}</div>
      )}
    </div>
  );
}
