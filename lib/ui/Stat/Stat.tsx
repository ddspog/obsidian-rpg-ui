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
  /** Vantage on the save: "adv" renders a green "A" badge at the top of
   *  the back hex; "dis" renders a red "D". Omit for no badge. */
  saveVantage?: "adv" | "dis";
  className?: string;
  children?: React.ReactNode;
}

function modifierFromScore(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}

function formatMod(mod: number) {
  return (mod >= 0 ? "+" : "\u2212") + String(Math.abs(mod));
}

/* ── Pre-computed hex geometry (viewBox 0 0 110 110) ──────────────────────── */

// Front hex — 76×86, bottom-left corner
const FRONT_BORDER = "38,24 76,45.5 76,88.5 38,110 0,88.5 0,45.5";
const FRONT_FILL = "38,25.5 74.5,46.25 74.5,87.75 38,108.5 1.5,87.75 1.5,46.25";

// Back hex — 60×68, upper-right corner
const BACK_BORDER = "80,0 110,17 110,51 80,68 50,51 50,17";
const BACK_FILL = "80,1.5 108.5,17.75 108.5,50.25 80,66.5 51.5,50.25 51.5,17.75";

// Proficiency ring — 88% of back hex, centered at (80, 34)
const PROF_RING_OUTER = "M80,4.08 L106.4,19.04 L106.4,48.96 L80,63.92 L53.6,48.96 L53.6,19.04Z";
const PROF_RING_INNER = "M80,5.58 L55.1,19.79 L55.1,48.21 L80,62.42 L104.9,48.21 L104.9,19.79Z";
const PROF_RING_FULL = `${PROF_RING_OUTER} ${PROF_RING_INNER}`;

// Half proficiency — stroked midline polygon (average of 88% outer/inner)
const PROF_RING_MID = "80,4.83 105.65,19.42 105.65,48.58 80,63.17 54.35,48.58 54.35,19.42";

// Double proficiency inner ring — 82% of back hex
const PROF_INNER_OUTER = "M80,6.12 L104.6,20.06 L104.6,47.94 L80,61.88 L55.4,47.94 L55.4,20.06Z";
const PROF_INNER_INNER = "M80,7.62 L56.9,20.81 L56.9,47.19 L80,60.38 L103.1,47.19 L103.1,20.81Z";
const PROF_RING_DOUBLE_INNER = `${PROF_INNER_OUTER} ${PROF_INNER_INNER}`;

export function Stat({ value, modifier, saveBonus, proficiency = 0, saveVantage, children }: StatProps) {
  const id = React.useId();
  const mod = modifier ?? modifierFromScore(value);
  const modText = formatMod(mod);
  const saveText = saveBonus !== undefined ? formatMod(saveBonus) : null;

  const profAttr = proficiency > 0 ? (proficiency >= 2 ? "double" : proficiency >= 1 ? "full" : "half") : undefined;

  return (
    <svg aria-details="Stat Hex Pair" aria-label={`${children}: ${value} (${modText})`} viewBox="0 0 110 110">
      <defs>
        <radialGradient id={`hex-glow-${id}`} cx="0.4" cy="0.3" r="0.6">
          <stop offset="0%" stopColor="white" stopOpacity="0.06" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Back hex — save modifier (drawn first, behind) */}
      <g aria-details="Hex Back">
        <polygon points={BACK_BORDER} className="rpg-hex-border" />
        <polygon points={BACK_FILL} className="rpg-hex-fill" />
        <polygon points={BACK_FILL} fill={`url(#hex-glow-${id})`} />
        {profAttr === "full" && <path d={PROF_RING_FULL} className="rpg-hex-prof-ring" fillRule="evenodd" />}
        {profAttr === "half" && (
          <>
            <path d={PROF_RING_FULL} className="rpg-hex-prof-ring" fillRule="evenodd" />
            <polygon points={PROF_RING_MID} className="rpg-hex-prof-dash" />
          </>
        )}
        {profAttr === "double" && (
          <>
            <path d={PROF_RING_FULL} className="rpg-hex-prof-ring" fillRule="evenodd" />
            <path d={PROF_RING_DOUBLE_INNER} className="rpg-hex-prof-ring" fillRule="evenodd" />
          </>
        )}
        <text x="80" y="27" textAnchor="middle" dominantBaseline="auto" className="rpg-hex-label rpg-hex-label--back">
          SAVE
        </text>
        <text x="80" y="43" textAnchor="middle" dominantBaseline="auto" className="rpg-hex-value rpg-hex-value--back">
          {saveText ?? modText}
        </text>
        {saveVantage && (
          <g aria-details="Save Vantage" data-vantage={saveVantage}>
            <circle cx="105" cy="8" r="7" className="rpg-hex-vantage-badge" />
            <text x="105" y="11" textAnchor="middle" dominantBaseline="middle" className="rpg-hex-vantage-label">
              {saveVantage === "adv" ? "A" : "D"}
            </text>
          </g>
        )}
      </g>

      {/* Front hex — ability modifier (drawn second, on top) */}
      <g aria-details="Hex Front">
        <polygon points={FRONT_BORDER} className="rpg-hex-border" />
        <polygon points={FRONT_FILL} className="rpg-hex-fill" />
        <polygon points={FRONT_FILL} fill={`url(#hex-glow-${id})`} />
        <text x="38" y="58" textAnchor="middle" dominantBaseline="auto" className="rpg-hex-label">
          {children}
        </text>
        <text x="38" y="82" textAnchor="middle" dominantBaseline="auto" className="rpg-hex-value">
          {modText}
        </text>
      </g>

      {/* Score — bottom-right */}
      <text x="106" y="90" textAnchor="end" dominantBaseline="auto" className="rpg-hex-score">
        {value}
      </text>
    </svg>
  );
}
