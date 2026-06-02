import * as React from "react";

export interface DeathSaveDotsProps {
  /** Which side of the AC badge: "successes" or "failures" */
  side: "successes" | "failures";
  /** Total number of circles (default 3) */
  count?: number;
  /** How many are currently filled */
  filled: number;
  /** Called with new filled count when a dot is clicked */
  onChange: (value: number) => void;
}

export function DeathSaveDots({ side, count = 3, filled, onChange }: DeathSaveDotsProps) {
  const handleClick = (n: number) => {
    // clicking the already-last filled dot toggles it off; otherwise set to n
    onChange(filled === n ? n - 1 : n);
  };

  return (
    <fieldset aria-details={`Death Save ${side === "successes" ? "Successes" : "Failures"}`}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={n <= filled}
          aria-label={`Death save ${side === "successes" ? "success" : "failure"} ${n}`}
          onClick={() => handleClick(n)}
        />
      ))}
    </fieldset>
  );
}
