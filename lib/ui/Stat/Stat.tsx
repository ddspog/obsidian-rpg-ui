import * as React from "react";

export interface StatProps {
  /** Base ability score value (e.g. 18) */
  value: number;
  /** Ability modifier — computed from value if omitted */
  modifier?: number;
  /** Pre-computed save modifier total */
  saveBonus?: number;
  /** Proficiency level for the save: 0, 0.5, 1, or 2 */
  proficiency?: number;
  className?: string;
  children?: React.ReactNode;
}

function modifierFromScore(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}

function formatMod(mod: number) {
  return (mod >= 0 ? "+" : "\u2212") + String(Math.abs(mod));
}

export function Stat({ value, modifier, saveBonus, proficiency = 0, children }: StatProps) {
  const mod = modifier ?? modifierFromScore(value);
  const modText = formatMod(mod);
  const saveText = saveBonus !== undefined ? formatMod(saveBonus) : null;

  // Map proficiency to a data attribute value for CSS targeting
  const profAttr = proficiency > 0
    ? proficiency >= 2 ? "double" : proficiency >= 1 ? "full" : "half"
    : undefined;

  return (
    <figure
      aria-details="Stat Hex Pair"
      aria-label={`${children}: ${value} (${modText})`}
    >
      {/* Back hex — save modifier (upper-right, behind) */}
      <div aria-details="Hex Back">
        <span aria-details="Hex Border" />
        <span aria-details="Hex Fill" />
        {profAttr && <span aria-details="Prof Ring" data-prof={profAttr} />}
        <small>SAVE</small>
        <output>{saveText ?? modText}</output>
      </div>

      {/* Front hex — ability modifier (bottom-left, in front) */}
      <div aria-details="Hex Front">
        <span aria-details="Hex Border" />
        <span aria-details="Hex Fill" />
        <small>{children}</small>
        <output>{modText}</output>
      </div>

      {/* Score — bottom-right, with connecting line */}
      <output aria-details="Hex Score">{value}</output>
    </figure>
  );
}
