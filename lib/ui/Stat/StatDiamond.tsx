import * as React from "react";

export interface StatDiamondProps {
  /** Numeric value to display */
  value: number;
  /** Label shown below the value (e.g. "INITIATIVE", "WALK", "PROFICIENCY") */
  label: string;
  /** Display format: "bonus" (+/-), "unit" (with ft.), "value" (plain number) */
  format?: "bonus" | "unit" | "value";
  /** Visual size variant — "sm" (default) or "lg" for the center element */
  size?: "sm" | "lg";
  /** Optional advantage / disadvantage pill rendered inside the stat —
   *  green "A" for "adv", red "D" for "dis". Used by the initiative
   *  stat to carry `Initiative A.` / `Initiative D.` trait state. */
  vantage?: "adv" | "dis";
}

/** Short forms of the long labels, drawn in tight places (the hover preview) in place of the full word. */
const ABBREVIATIONS: Record<string, string> = { initiative: "INI", proficiency: "PB" };

export function StatDiamond({ value, label, format = "value", size = "sm", vantage }: StatDiamondProps) {
  const abbreviation = ABBREVIATIONS[label.trim().toLowerCase()];
  const absValue = Math.abs(value);
  const prefix = format === "bonus" ? (value >= 0 ? "+" : "\u2212") : null;
  const suffix = format === "unit" ? "ft." : null;
  const displayText =
    format === "bonus"
      ? value >= 0
        ? `+${value}`
        : String(value)
      : format === "unit"
        ? `${value} ft.`
        : String(value);

  return (
    <figure aria-details="Stat Diamond" data-size={size} data-vantage={vantage} aria-label={`${label}: ${displayText}`}>
      <output aria-details="Stat Value">
        {prefix && <span aria-details="Stat Extra">{prefix}</span>}
        {format === "bonus" ? absValue : value}
        {suffix && <span aria-details="Stat Extra">{suffix}</span>}
      </output>
      {vantage && (
        <span
          className="rpg-stat-diamond-vantage"
          data-vantage={vantage}
          aria-label={vantage === "adv" ? "Advantage" : "Disadvantage"}
        >
          {vantage === "adv" ? "A" : "D"}
        </span>
      )}
      <figcaption>
        <span className="rpg-stat-label-full">{label}</span>
        {abbreviation && (
          <span className="rpg-stat-label-short" aria-hidden="true">
            {abbreviation}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
