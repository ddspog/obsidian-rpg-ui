import { describe, it, expect } from "vitest";
import {
  initSessionConsumables,
  spendUse,
  unspendUse,
  resetByRecovery,
  getRemainingUses,
  isAvailable,
} from "./consumable-state";
import type { SessionFeatureCard } from "./card-types";

function makeCard(overrides: Partial<SessionFeatureCard> = {}): SessionFeatureCard {
  return {
    id: "Cleric:Channel Divinity:action",
    name: "Channel Divinity",
    bucket: "action",
    logTemplate: "@ {{actor}} uses {{name}}",
    source: "Cleric",
    actor: "Elara",
    maxUses: 2,
    recovery: "short rest",
    ...overrides,
  };
}

describe("initSessionConsumables", () => {
  it("initializes from sheet spent state", () => {
    const card = makeCard();
    const state = initSessionConsumables([card], { [card.id]: 1 });
    expect(state.spent[card.id]).toBe(1);
    expect(state.initialSpent[card.id]).toBe(1);
  });

  it("defaults to 0 when no sheet spent entry", () => {
    const card = makeCard();
    const state = initSessionConsumables([card], {});
    expect(state.spent[card.id]).toBe(0);
  });

  it("skips cards without maxUses", () => {
    const card = makeCard({ maxUses: undefined });
    const state = initSessionConsumables([card], {});
    expect(state.spent[card.id]).toBeUndefined();
  });
});

describe("spendUse", () => {
  it("increments spent count", () => {
    const card = makeCard();
    let state = initSessionConsumables([card], {});
    state = spendUse(state, card.id);
    expect(state.spent[card.id]).toBe(1);
    state = spendUse(state, card.id);
    expect(state.spent[card.id]).toBe(2);
  });

  it("creates entry for unknown card id", () => {
    const state = initSessionConsumables([], {});
    const updated = spendUse(state, "unknown:card:id");
    expect(updated.spent["unknown:card:id"]).toBe(1);
  });
});

describe("unspendUse", () => {
  it("decrements spent count", () => {
    const card = makeCard();
    let state = initSessionConsumables([card], { [card.id]: 2 });
    state = unspendUse(state, card.id);
    expect(state.spent[card.id]).toBe(1);
  });

  it("does not go below zero", () => {
    const card = makeCard();
    let state = initSessionConsumables([card], {});
    state = unspendUse(state, card.id);
    expect(state.spent[card.id]).toBe(0);
  });
});

describe("resetByRecovery", () => {
  it("resets cards matching recovery type", () => {
    const shortRest = makeCard({ id: "a", recovery: "short rest", maxUses: 2 });
    const longRest = makeCard({ id: "b", recovery: "long rest", maxUses: 1 });
    const cards = [shortRest, longRest];
    let state = initSessionConsumables(cards, { a: 2, b: 1 });

    state = resetByRecovery(state, cards, "short rest");
    expect(state.spent["a"]).toBe(0);
    expect(state.spent["b"]).toBe(1);
  });

  it("handles case-insensitive partial match", () => {
    const card = makeCard({ recovery: "1/Short Rest" });
    const cards = [card];
    let state = initSessionConsumables(cards, { [card.id]: 2 });

    state = resetByRecovery(state, cards, "short rest");
    expect(state.spent[card.id]).toBe(0);
  });

  it("long rest resets long-rest cards", () => {
    const card = makeCard({ recovery: "long rest", maxUses: 3 });
    const cards = [card];
    let state = initSessionConsumables(cards, { [card.id]: 3 });

    state = resetByRecovery(state, cards, "long rest");
    expect(state.spent[card.id]).toBe(0);
  });
});

describe("getRemainingUses", () => {
  it("returns max minus spent", () => {
    const card = makeCard({ maxUses: 3 });
    const state = initSessionConsumables([card], { [card.id]: 1 });
    expect(getRemainingUses(state, card)).toBe(2);
  });

  it("returns Infinity for unlimited cards", () => {
    const card = makeCard({ maxUses: undefined });
    const state = initSessionConsumables([], {});
    expect(getRemainingUses(state, card)).toBe(Infinity);
  });

  it("clamps to zero", () => {
    const card = makeCard({ maxUses: 1 });
    const state = { spent: { [card.id]: 5 }, initialSpent: {} };
    expect(getRemainingUses(state, card)).toBe(0);
  });
});

describe("isAvailable", () => {
  it("returns true for unlimited cards", () => {
    const card = makeCard({ maxUses: undefined });
    const state = initSessionConsumables([], {});
    expect(isAvailable(state, card)).toBe(true);
  });

  it("returns true when uses remain", () => {
    const card = makeCard({ maxUses: 2 });
    const state = initSessionConsumables([card], { [card.id]: 1 });
    expect(isAvailable(state, card)).toBe(true);
  });

  it("returns false when all uses spent", () => {
    const card = makeCard({ maxUses: 2 });
    const state = initSessionConsumables([card], { [card.id]: 2 });
    expect(isAvailable(state, card)).toBe(false);
  });
});
