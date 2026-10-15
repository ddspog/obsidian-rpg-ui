/**
 * A passive feature, read: what it is and what it changes — nothing written to
 * the log unless asked. (Playing it as a card would log `uses Explorer`, which
 * means nothing for something always on.) "Note in the log" is for the moment
 * it matters: `@(Talon) Heightened Senses applies`.
 */

import * as React from "react";
import type { SessionFeatureCard } from "../../domains/session-log/card-types";
import { describeModifier } from "../../domains/session-log/modifiers";
import { InlineMarkdown } from "./inline-markdown";

interface PassivePopoverProps {
  card: SessionFeatureCard;
  sourcePath?: string;
  onNote: () => void;
  onClose: () => void;
}

export function PassivePopover({ card, sourcePath, onNote, onClose }: PassivePopoverProps) {
  const text = card.text ?? card.summary ?? "";
  return (
    <div className="lonelog-placeholder-popover" role="dialog" aria-label={card.name}>
      <div className="placeholder-form">
        <header className="placeholder-head">
          <strong className="placeholder-title">{card.name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim()}</strong>
          <p className="placeholder-hint">Passive — always on · {card.actor}</p>
        </header>
        {text && (
          <div className="placeholder-passive-text">
            <InlineMarkdown source={text} sourcePath={sourcePath ?? ""} />
          </div>
        )}
        {card.modifies && card.modifies.length > 0 && (
          <ul className="placeholder-modified" aria-label="What it changes">
            {card.modifies.map((m, i) => (
              <li key={i}>
                <b>{m.on}</b> {describeModifier(m)}
              </li>
            ))}
          </ul>
        )}
        <div className="placeholder-buttons">
          <button type="button" className="placeholder-submit" onClick={onNote}>
            Note in the log
          </button>
          <button type="button" className="placeholder-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
