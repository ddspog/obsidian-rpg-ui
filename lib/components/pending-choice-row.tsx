import * as React from "react";
import type { PendingChoice } from "../domains/features/types";

export interface PendingChoiceRowProps {
  pending: PendingChoice;
  /**
   * Called when the user clicks an option button. Receives the option label
   * (i.e. its `name` or `value`). Caller is responsible for toggling the
   * pick in the character's `choices` map. When omitted the buttons render
   * disabled — useful for read-only displays.
   */
  onToggle?: (option: string) => void;
}

export function PendingChoiceRow({ pending, onToggle }: PendingChoiceRowProps) {
  return (
    <aside className="rpg-feature-pending" aria-label={`Pending ${pending.feature.name}`}>
      <p>
        <strong>{pending.source}</strong>: pick {pending.remaining} more for{" "}
        <em>{pending.feature.name}</em>
      </p>
      {pending.options.length > 0 && (
        <menu aria-label="Choice Options">
          {pending.options.map((o, i) => {
            const raw = o.name ?? "(unnamed)";
            // Strip [[wikilink]] delimiters for a clean button label; the
            // underlying option keeps the wikilink so traits render as links.
            const label = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
            const alreadyPicked = pending.picked.includes(raw);
            const slotsFull = pending.remaining === 0;
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={alreadyPicked}
                  disabled={!onToggle || (slotsFull && !alreadyPicked)}
                  onClick={() => onToggle?.(raw)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </menu>
      )}
    </aside>
  );
}

export default PendingChoiceRow;
