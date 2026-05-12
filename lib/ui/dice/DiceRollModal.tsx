import * as React from "react";

export interface DiceRollModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The die type being rolled (e.g. "d8", "d10") */
  dieType: string;
  /** Called when the user confirms spending a die */
  onSpend: () => void;
  /** Called to close the modal without spending */
  onClose: () => void;
}

function sidesFromDieType(dieType: string): number {
  const match = dieType.match(/d(\d+)/i);
  return match ? parseInt(match[1], 10) : 6;
}

export function DiceRollModal({ isOpen, dieType, onSpend, onClose }: DiceRollModalProps) {
  const [result, setResult] = React.useState<number | null>(null);
  const sides = sidesFromDieType(dieType);

  const handleRoll = () => {
    setResult(Math.ceil(Math.random() * sides));
  };

  const handleUse = () => {
    onSpend();
    onClose();
    setResult(null);
  };

  const handleClose = () => {
    onClose();
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <dialog aria-details="Dice Roll Modal" open aria-label={`Roll ${dieType}`}>
      <article>
        <header>
          <output aria-details="Die Type">{dieType}</output>
          <button type="button" aria-label="Close" onClick={handleClose}>
            ✕
          </button>
        </header>
        <section aria-details="Roll Result">
          {result !== null ? (
            <output aria-details="Roll Value">{result}</output>
          ) : (
            <span aria-details="Roll Prompt">Roll your {dieType}</span>
          )}
        </section>
        <footer>
          <button type="button" onClick={handleRoll}>
            {result !== null ? "Re-roll" : "Roll"}
          </button>
          {result !== null && (
            <button type="button" onClick={handleUse}>
              Use Die
            </button>
          )}
        </footer>
      </article>
    </dialog>
  );
}
