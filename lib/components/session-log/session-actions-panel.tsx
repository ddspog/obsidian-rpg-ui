import { useState } from "react";
import { CardStack as CardStackData, SessionFeatureCard } from "../../domains/session-log/card-types";
import { SessionConsumableState } from "../../domains/session-log/consumable-state";
import { parseLogTemplate, needsUserInput, resolveWithContext, ResolutionContext } from "../../domains/session-log/template-resolver";
import { CardStack } from "./card-stack";
import { PlaceholderPopover } from "./placeholder-popover";

interface SessionActionsPanelProps {
  pcStacks: Map<string, CardStackData[]>;
  gmStacks: CardStackData[];
  consumableState: SessionConsumableState;
  entities: string[];
  onAppendText: (text: string) => void;
  onSpend: (cardId: string) => void;
}

export function SessionActionsPanel({
  pcStacks,
  gmStacks,
  consumableState,
  entities,
  onAppendText,
  onSpend,
}: SessionActionsPanelProps) {
  const actors = ["Game Master", ...pcStacks.keys()];
  const [selectedActor, setSelectedActor] = useState(actors[0] || "Game Master");
  const [activeCard, setActiveCard] = useState<SessionFeatureCard | null>(null);

  const currentStacks =
    selectedActor === "Game Master" ? gmStacks : pcStacks.get(selectedActor) || [];

  const handleCardClick = (card: SessionFeatureCard) => {
    const placeholders = parseLogTemplate(card.logTemplate);
    const userInputs = needsUserInput(placeholders);

    if (userInputs.length === 0) {
      const ctx: ResolutionContext = { actor: card.actor, name: card.name, entities };
      const resolved = resolveWithContext(card.logTemplate, ctx, {});
      onAppendText(resolved + "\n");
      if (card.maxUses != null) onSpend(card.id);
    } else {
      setActiveCard(card);
    }
  };

  const handleResolve = (resolvedText: string) => {
    onAppendText(resolvedText + "\n");
    if (activeCard?.maxUses != null) onSpend(activeCard.id);
    setActiveCard(null);
  };

  return (
    <div className="lonelog-actions-panel">
      <nav className="actions-actor-list" aria-label="Character selector">
        {actors.map((actor) => (
          <button
            key={actor}
            className={`actor-chip ${actor === selectedActor ? "is-active" : ""}`}
            onClick={() => { setSelectedActor(actor); setActiveCard(null); }}
          >
            {actor === "Game Master" ? "GM" : actor}
          </button>
        ))}
      </nav>
      <div className="actions-stacks-row">
        {currentStacks.map((stack) => (
          <CardStack
            key={`${stack.actor}-${stack.bucket}`}
            stack={stack}
            consumableState={consumableState}
            onCardClick={handleCardClick}
          />
        ))}
        {currentStacks.length === 0 && (
          <p className="actions-empty">No actions available</p>
        )}
      </div>
      {activeCard && (
        <PlaceholderPopover
          card={activeCard}
          entities={entities}
          onResolve={handleResolve}
          onCancel={() => setActiveCard(null)}
        />
      )}
    </div>
  );
}
