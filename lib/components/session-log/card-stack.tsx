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
    <div className="lonelog-card-stack" aria-label={`${stack.label} stack for ${stack.actor}`}>
      <div className="card-stack-fan">
        {stack.cards.map((card, i) => (
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
