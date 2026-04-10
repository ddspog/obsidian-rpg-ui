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

  return (
    <>
      {Object.entries(dice).map(([type, { max, current }]) =>
        Array.from({ length: max }, (_, i) => {
          const spent = i >= current;
          return (
            <button
              key={`${type}-${i}`}
              type="button"
              data-die={type}
              aria-label={`${type} hit die${spent ? " (spent)" : ""}`}
              aria-disabled={spent}
              onClick={() => !spent && setOpenDie(type)}
            >
              <span aria-hidden="true">{type}</span>
            </button>
          );
        }),
      )}
      {openDie && (
        <DiceRollModal
          isOpen={true}
          dieType={openDie}
          onSpend={() => onSpend(openDie)}
          onClose={() => setOpenDie(null)}
        />
      )}
    </>
  );
}
