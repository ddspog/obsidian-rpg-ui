import { describe, it, expect } from "vitest";
import { cardSummary } from "./card-summary";
import type { SessionFeatureCard } from "./card-types";

const card = (extra: Partial<SessionFeatureCard>): SessionFeatureCard => ({
  id: "x",
  name: "Card",
  bucket: "action",
  logTemplate: "",
  source: "gm",
  actor: "Game Master",
  ...extra,
});

describe("cardSummary — what the confirmation says", () => {
  it("uses the card's summary", () => {
    expect(cardSummary(card({ summary: " Ask a yes/no question. ", text: "Long body." }))).toBe(
      "Ask a yes/no question."
    );
  });

  it("falls back to the description's first prose paragraph, skipping worked examples", () => {
    const text = "? [CF:3] Does he find tomes?\n-> Yes (d100=35)\n\nMythic's core oracle. Ask a Yes/No question.";
    expect(cardSummary(card({ text }))).toBe("Mythic's core oracle. Ask a Yes/No question.");
  });

  it("is empty when there is nothing to say", () => {
    expect(cardSummary(card({}))).toBe("");
  });
});
