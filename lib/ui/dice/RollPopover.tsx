import * as React from "react";
import { createPortal } from "react-dom";
import { DamageResult, D20Result, Vantage, formatModifier, rollD20, rollDamage } from "./roll";

export interface RollPopoverProps {
  /** What is being rolled: "Athletics", "Longsword". */
  label: string;
  /** Added to the d20; `null` for a roll with no attack roll (a save spell), which offers its damage only. */
  modifier: number | null;
  /** Damage expressions (`1d8+3`) to roll, with the type they deal; omit for a check. */
  damage?: Array<{ expr: string; type?: string }>;
  /** Vantage the sheet already knows about. */
  vantage?: Vantage;
  onClose: () => void;
}

const VANTAGE_LABEL: Record<Vantage, string> = { normal: "Normal", adv: "Advantage", dis: "Disadvantage" };

/**
 * A sheet that rolls d20 + modifier the moment it opens, lets the player
 * re-roll with advantage or disadvantage, and (for an attack) rolls the
 * damage, doubling the dice on a natural 20. The roll stays on the sheet;
 * nothing is written to the session log.
 */
export function RollPopover({ label, modifier, damage, vantage = "normal", onClose }: RollPopoverProps) {
  const [mode, setMode] = React.useState<Vantage>(vantage);
  const [result, setResult] = React.useState<D20Result | null>(() =>
    modifier === null ? null : rollD20(modifier, vantage)
  );
  const [damageRolls, setDamageRolls] = React.useState<Array<{ expr: string; result: DamageResult | null }>>([]);

  const roll = (next: Vantage) => {
    if (modifier === null) return;
    setMode(next);
    setResult(rollD20(modifier, next));
    setDamageRolls([]);
  };

  const crit = result?.kept === 20;
  const fumble = result?.kept === 1;

  // Portalled to the body: a sheet section with `backdrop-filter` would otherwise
  // become the containing block of this fixed overlay and clip it.
  return createPortal(
    <dialog aria-details="Roll Popover" open aria-label={`Roll ${label}`} onClick={onClose}>
      <article onClick={(e) => e.stopPropagation()}>
        <i aria-hidden="true" />
        <header>
          <h4>{label}</h4>
          {modifier !== null && <output aria-details="Roll Modifier">d20 {formatModifier(modifier)}</output>}
          <button type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {result && modifier !== null && (
          <>
            <section aria-details="Roll Result" data-outcome={crit ? "crit" : fumble ? "fumble" : undefined}>
              <output aria-details="Roll Total" aria-live="polite">
                {result.total}
              </output>
              <small>
                {result.dice.length > 1 ? (
                  <>
                    {result.dice.map((d, i) => (
                      <span key={i} data-kept={i === result.dice.indexOf(result.kept) ? "true" : "false"}>
                        {d}
                      </span>
                    ))}{" "}
                    {VANTAGE_LABEL[mode].toLowerCase()}
                  </>
                ) : (
                  <span>{result.kept}</span>
                )}{" "}
                {formatModifier(modifier)}
                {crit && " · natural 20"}
                {fumble && " · natural 1"}
              </small>
            </section>
            <div aria-details="Roll Vantage" role="group" aria-label="Roll again with">
              {(["normal", "adv", "dis"] as Vantage[]).map((v) => (
                <button key={v} type="button" aria-pressed={mode === v} onClick={() => roll(v)}>
                  {v === "normal" ? "Roll again" : VANTAGE_LABEL[v]}
                </button>
              ))}
            </div>
          </>
        )}
        {damage && damage.length > 0 && (
          <section aria-details="Roll Damage">
            {damage.map(({ expr, type }) => {
              const rolled = damageRolls.find((d) => d.expr === expr);
              return (
                <button
                  key={expr}
                  type="button"
                  data-primary="true"
                  onClick={() =>
                    setDamageRolls((prev) => [
                      ...prev.filter((d) => d.expr !== expr),
                      { expr, result: rollDamage(expr, crit) },
                    ])
                  }
                >
                  {rolled?.result ? (
                    <>
                      <b>{rolled.result.total}</b>{" "}
                      <span>
                        {type ?? expr}
                        {crit ? " (crit)" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      Roll damage{" "}
                      <span>
                        {expr}
                        {type ? ` ${type}` : ""}
                        {crit ? " (crit)" : ""}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </section>
        )}
      </article>
    </dialog>,
    document.body
  );
}
