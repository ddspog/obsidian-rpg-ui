import * as React from "react";
import { DeathSaveDots } from "./DeathSaveDots";

export interface DeathSavesProps {
  /** Current hit points; the saves show on their own at 0 or below. */
  hp: number;
  successes: number;
  failures: number;
  onChange: (saves: { successes: number; failures: number }) => void;
}

/**
 * Death saves in the health area: a "Death saves" chip until they matter, then a labelled
 * Pass / Fail row. They matter at 0 HP, or once any pip is marked; the chip opens them early.
 */
export function DeathSaves({ hp, successes, failures, onChange }: DeathSavesProps) {
  const [open, setOpen] = React.useState(false);
  const active = hp <= 0 || successes > 0 || failures > 0;
  const shown = active || open;

  return (
    <div aria-details="Death Saves" data-active={active ? "true" : "false"}>
      {!active && (
        <button type="button" aria-expanded={shown} onClick={() => setOpen(!open)}>
          Death saves
        </button>
      )}
      {shown && (
        <div role="group" aria-label="Death saves">
          {active && <span aria-details="Death Saves Label">Death saves</span>}
          <span aria-details="Death Saves Side">Pass</span>
          <DeathSaveDots side="successes" filled={successes} onChange={(v) => onChange({ successes: v, failures })} />
          <span aria-details="Death Saves Side">Fail</span>
          <DeathSaveDots side="failures" filled={failures} onChange={(v) => onChange({ successes, failures: v })} />
        </div>
      )}
    </div>
  );
}
