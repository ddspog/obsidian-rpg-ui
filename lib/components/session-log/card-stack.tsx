import { CardStack as CardStackData } from "../../domains/session-log/card-types";
import { SessionFeatureCard } from "../../domains/session-log/card-types";
import { SessionConsumableState, isAvailable } from "../../domains/session-log/consumable-state";
import { ActionCard } from "./action-card";

interface CardStackProps {
  stack: CardStackData;
  consumableState: SessionConsumableState;
  onCardClick: (card: SessionFeatureCard) => void;
}

export function CardStack({ stack, consumableState, onCardClick }: CardStackProps) {
  return (
    <div
      className={`lonelog-card-stack is-${stack.bucket.split(":")[0]}`}
      aria-label={`${stack.label} stack for ${stack.actor}`}
    >
      <div className="card-stack-fan" style={{ "--card-count": stack.cards.length } as React.CSSProperties}>
        {/* Cards come most useful first; the LAST slot is the deck's front card,
            so they are laid down in reverse — the most useful lands on top. */}
        {[...stack.cards].reverse().map((card, i) => (
          <div
            key={card.id}
            className="card-stack-slot"
            style={{ "--card-index": i, "--card-count": stack.cards.length } as React.CSSProperties}
          >
            <ActionCard
              card={card}
              consumableState={consumableState}
              depleted={!isAvailable(consumableState, card)}
              onClick={onCardClick}
            />
          </div>
        ))}
      </div>
      <span className="card-stack-label">{stack.label}</span>
    </div>
  );
}
