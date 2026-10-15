import { useState, useCallback, useMemo } from "react";
import type { SessionFeatureCard } from "../domains/session-log/card-types";
import {
  SessionConsumableState,
  initSessionConsumables,
  spendUse,
  unspendUse,
  resetByRecovery,
  getRemainingUses,
  isAvailable,
} from "../domains/session-log/consumable-state";

export interface UseSessionConsumablesReturn {
  state: SessionConsumableState;
  spend: (cardId: string) => void;
  unspend: (cardId: string) => void;
  reset: (recovery: string) => void;
  remaining: (card: SessionFeatureCard) => number;
  available: (card: SessionFeatureCard) => boolean;
}

export function useSessionConsumables(
  cards: SessionFeatureCard[],
  sheetSpent: Record<string, number>
): UseSessionConsumablesReturn {
  const [state, setState] = useState<SessionConsumableState>(() => initSessionConsumables(cards, sheetSpent));

  const spend = useCallback((cardId: string) => setState((s) => spendUse(s, cardId)), []);

  const unspend = useCallback((cardId: string) => setState((s) => unspendUse(s, cardId)), []);

  const reset = useCallback((recovery: string) => setState((s) => resetByRecovery(s, cards, recovery)), [cards]);

  const remaining = useCallback((card: SessionFeatureCard) => getRemainingUses(state, card), [state]);

  const available = useCallback((card: SessionFeatureCard) => isAvailable(state, card), [state]);

  return useMemo(
    () => ({ state, spend, unspend, reset, remaining, available }),
    [state, spend, unspend, reset, remaining, available]
  );
}
