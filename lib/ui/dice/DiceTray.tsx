import * as React from "react";
import { DiceRollModal } from "./DiceRollModal";

export interface DiceTrayProps {
  /** Map of die type to {max, current} counts */
  dice: Record<string, { max: number; current: number }>;
  /** Called when a die is spent, with the die type key */
  onSpend: (dieType: string) => void;
}

export function DiceTray({ dice, onSpend }: DiceTrayProps) {
  const [openDie, setOpenDie] = React.useState<string | null>(null);

  // Expand the record into individual die instances (e.g. d8: {max:2} → [d8, d8])
  const diceList: Array<{ type: string; index: number; spent: boolean }> = [];
  for (const [type, { max, current }] of Object.entries(dice)) {
    for (let i = 0; i < max; i++) {
      diceList.push({ type, index: i, spent: i >= current });
    }
  }

  return (
    <figure aria-details="Dice Tray">
      <figcaption>HIT DICE</figcaption>
      <menu aria-details="Dice List">
        {diceList.map(({ type, index, spent }) => (
          <button
            key={`${type}-${index}`}
            type="button"
            data-die={type}
            aria-label={`${type} hit die${spent ? " (spent)" : ""}`}
            aria-disabled={spent}
            onClick={() => !spent && setOpenDie(type)}
          >
            <span aria-hidden="true">{type}</span>
          </button>
        ))}
      </menu>
      {openDie && (
        <DiceRollModal
          isOpen={true}
          dieType={openDie}
          onSpend={() => onSpend(openDie)}
          onClose={() => setOpenDie(null)}
        />
      )}
    </figure>
  );
}
