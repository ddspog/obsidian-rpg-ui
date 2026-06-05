import { SessionFeatureCard } from "./card-types";

export interface SessionConsumableState {
  spent: Record<string, number>;
  initialSpent: Record<string, number>;
}

export function initSessionConsumables(
  cards: SessionFeatureCard[],
  sheetSpent: Record<string, number>,
): SessionConsumableState {
  const spent: Record<string, number> = {};
  const initialSpent: Record<string, number> = {};

  for (const card of cards) {
    if (card.maxUses == null) continue;
    const count = sheetSpent[card.id] ?? 0;
    spent[card.id] = count;
    initialSpent[card.id] = count;
  }

  return { spent, initialSpent };
}

export function spendUse(
  state: SessionConsumableState,
  cardId: string,
): SessionConsumableState {
  const current = state.spent[cardId] ?? 0;
  return {
    ...state,
    spent: { ...state.spent, [cardId]: current + 1 },
  };
}

export function unspendUse(
  state: SessionConsumableState,
  cardId: string,
): SessionConsumableState {
  const current = state.spent[cardId] ?? 0;
  if (current <= 0) return state;
  return {
    ...state,
    spent: { ...state.spent, [cardId]: current - 1 },
  };
}

export function resetByRecovery(
  state: SessionConsumableState,
  cards: SessionFeatureCard[],
  recovery: string,
): SessionConsumableState {
  const normalised = recovery.toLowerCase().trim();
  const newSpent = { ...state.spent };

  for (const card of cards) {
    if (card.maxUses == null) continue;
    if (!card.recovery) continue;
    if (card.recovery.toLowerCase().trim().includes(normalised)) {
      newSpent[card.id] = 0;
    }
  }

  return { ...state, spent: newSpent };
}

export function getRemainingUses(
  state: SessionConsumableState,
  card: SessionFeatureCard,
): number {
  if (card.maxUses == null) return Infinity;
  const spent = state.spent[card.id] ?? 0;
  return Math.max(0, card.maxUses - spent);
}

export function isAvailable(
  state: SessionConsumableState,
  card: SessionFeatureCard,
): boolean {
  if (card.maxUses == null) return true;
  return getRemainingUses(state, card) > 0;
}
