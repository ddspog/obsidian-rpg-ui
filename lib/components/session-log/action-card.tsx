import { SessionFeatureCard } from "../../domains/session-log/card-types";
import { SessionConsumableState, getRemainingUses } from "../../domains/session-log/consumable-state";
import { LucideIcon } from "./lucide-icon";

/** An `icon:` written as an emoji (`🎬`, `✅`) rather than a Lucide name. */
export function isEmoji(icon: string | undefined): boolean {
  return !!icon && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(icon);
}

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
      {/* The name heads the card: in a stack only each card's top edge shows,
          so that edge has to say what the card is. */}
      <div className="action-card-head">
        <span className="action-card-name">{card.name}</span>
        {remaining != null && (
          <span className="action-card-uses">
            {remaining}/{card.maxUses}
          </span>
        )}
      </div>
      <div className="action-card-art">
        {isEmoji(card.icon) ? (
          <span className="action-card-emoji" aria-hidden="true">
            {card.icon}
          </span>
        ) : (
          <LucideIcon name={card.icon} size="2.6rem" strokeWidth={1.4} className="action-card-icon" />
        )}
      </div>
    </button>
  );
}
