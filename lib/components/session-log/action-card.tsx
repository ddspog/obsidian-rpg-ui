import { SessionFeatureCard } from "../../domains/session-log/card-types";
import { SessionConsumableState, getRemainingUses } from "../../domains/session-log/consumable-state";

interface ActionCardProps {
  card: SessionFeatureCard;
  consumableState: SessionConsumableState;
  depleted: boolean;
  onClick: (card: SessionFeatureCard) => void;
}

export function ActionCard({ card, consumableState, depleted, onClick }: ActionCardProps) {
  const remaining = card.maxUses != null ? getRemainingUses(consumableState, card) : null;

  return (
    <button
      className={`lonelog-action-card ${depleted ? "is-depleted" : ""}`}
      onClick={() => !depleted && onClick(card)}
      disabled={depleted}
      title={card.text || card.name}
    >
      <div className="action-card-art" />
      <div className="action-card-footer">
        <span className="action-card-name">{card.name}</span>
        {remaining != null && (
          <span className="action-card-uses">
            {remaining}/{card.maxUses}
          </span>
        )}
      </div>
    </button>
  );
}
