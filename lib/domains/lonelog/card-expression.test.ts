import { describe, it, expect } from "vitest";
import { parseCard, isCardDraw, parseCardDraws, formatCard, suitColor } from "./card-expression";

describe("parseCard", () => {
  describe("standard deck", () => {
    it("parses ace of hearts", () => {
      const card = parseCard("Ah");
      expect(card).toEqual({ type: "standard", raw: "Ah", rank: "Ace", suit: "Hearts", reversed: false });
    });

    it("parses queen of spades", () => {
      const card = parseCard("Qs");
      expect(card).toEqual({ type: "standard", raw: "Qs", rank: "Queen", suit: "Spades", reversed: false });
    });

    it("parses 10 of diamonds", () => {
      const card = parseCard("10d");
      expect(card).toEqual({ type: "standard", raw: "10d", rank: "10", suit: "Diamonds", reversed: false });
    });

    it("parses 7 of clubs", () => {
      const card = parseCard("7c");
      expect(card).toEqual({ type: "standard", raw: "7c", rank: "7", suit: "Clubs", reversed: false });
    });
  });

  describe("jokers", () => {
    it("parses generic joker", () => {
      const card = parseCard("Jkr");
      expect(card).toEqual({ type: "joker", raw: "Jkr", name: "Joker", reversed: false });
    });

    it("parses red joker", () => {
      const card = parseCard("RJkr");
      expect(card).toEqual({ type: "joker", raw: "RJkr", name: "Red Joker", reversed: false });
    });

    it("parses black joker", () => {
      const card = parseCard("BJkr");
      expect(card).toEqual({ type: "joker", raw: "BJkr", name: "Black Joker", reversed: false });
    });
  });

  describe("major arcana", () => {
    it("parses The Fool", () => {
      const card = parseCard("M0");
      expect(card).toEqual({ type: "major_arcana", raw: "M0", number: 0, name: "The Fool", reversed: false });
    });

    it("parses The Tower reversed", () => {
      const card = parseCard("M16r");
      expect(card).toEqual({ type: "major_arcana", raw: "M16r", number: 16, name: "The Tower", reversed: true });
    });

    it("parses The World", () => {
      const card = parseCard("M21");
      expect(card).toEqual({ type: "major_arcana", raw: "M21", number: 21, name: "The World", reversed: false });
    });

    it("rejects invalid major arcana number", () => {
      expect(parseCard("M22")).toBeNull();
    });
  });

  describe("minor arcana", () => {
    it("parses Ace of Cups", () => {
      const card = parseCard("ACu");
      expect(card).toEqual({ type: "minor_arcana", raw: "ACu", rank: "Ace", suit: "Cups", reversed: false });
    });

    it("parses Knight of Pentacles", () => {
      const card = parseCard("KnPe");
      expect(card).toEqual({ type: "minor_arcana", raw: "KnPe", rank: "Knight", suit: "Pentacles", reversed: false });
    });

    it("parses Page of Swords reversed", () => {
      const card = parseCard("PgSwr");
      expect(card).toEqual({ type: "minor_arcana", raw: "PgSwr", rank: "Page", suit: "Swords", reversed: true });
    });

    it("parses 7 of Wands", () => {
      const card = parseCard("7Wa");
      expect(card).toEqual({ type: "minor_arcana", raw: "7Wa", rank: "7", suit: "Wands", reversed: false });
    });

    it("parses 10 of Cups reversed", () => {
      const card = parseCard("10Cur");
      expect(card).toEqual({ type: "minor_arcana", raw: "10Cur", rank: "10", suit: "Cups", reversed: true });
    });
  });

  it("returns null for non-card text", () => {
    expect(parseCard("hello")).toBeNull();
    expect(parseCard("2d6")).toBeNull();
    expect(parseCard("")).toBeNull();
  });
});

describe("isCardDraw", () => {
  it("detects draw= pattern", () => {
    expect(isCardDraw("draw=Qs")).toBe(true);
    expect(isCardDraw("draw=M16r")).toBe(true);
  });

  it("detects position=card patterns", () => {
    expect(isCardDraw("Past=5Sw, Present=KWa")).toBe(true);
  });

  it("rejects dice rolls", () => {
    expect(isCardDraw("2d6+3=9")).toBe(false);
    expect(isCardDraw("d20+5=17 vs DC 15")).toBe(false);
  });
});

describe("parseCardDraws", () => {
  it("parses a single draw", () => {
    const spread = parseCardDraws("draw=Qs");
    expect(spread.draws).toHaveLength(1);
    expect(spread.draws[0].position).toBeUndefined();
    expect(spread.draws[0].card.type).toBe("standard");
    expect(spread.draws[0].card.rank).toBe("Queen");
  });

  it("parses a spread", () => {
    const spread = parseCardDraws("Past=5Sw, Present=KWa, Future=ACu");
    expect(spread.draws).toHaveLength(3);
    expect(spread.draws[0].position).toBe("Past");
    expect(spread.draws[0].card.rank).toBe("5");
    expect(spread.draws[1].position).toBe("Present");
    expect(spread.draws[1].card.rank).toBe("King");
    expect(spread.draws[2].position).toBe("Future");
    expect(spread.draws[2].card.rank).toBe("Ace");
  });

  it("parses major arcana draws", () => {
    const spread = parseCardDraws("draw=M12r");
    expect(spread.draws[0].card.type).toBe("major_arcana");
    expect(spread.draws[0].card.name).toBe("The Hanged Man");
    expect(spread.draws[0].card.reversed).toBe(true);
  });

  it("handles oracle deck free text", () => {
    const spread = parseCardDraws("draw=The Lantern");
    expect(spread.draws[0].card.type).toBe("oracle");
    expect(spread.draws[0].card.name).toBe("The");
  });
});

describe("formatCard", () => {
  it("formats standard card", () => {
    expect(formatCard({ type: "standard", raw: "Qs", rank: "Queen", suit: "Spades", reversed: false }))
      .toBe("Queen of Spades");
  });

  it("formats major arcana", () => {
    expect(formatCard({ type: "major_arcana", raw: "M16", number: 16, name: "The Tower", reversed: false }))
      .toBe("The Tower");
  });

  it("formats reversed major arcana", () => {
    expect(formatCard({ type: "major_arcana", raw: "M16r", number: 16, name: "The Tower", reversed: true }))
      .toBe("The Tower (reversed)");
  });

  it("formats minor arcana", () => {
    expect(formatCard({ type: "minor_arcana", raw: "KnPe", rank: "Knight", suit: "Pentacles", reversed: false }))
      .toBe("Knight of Pentacles");
  });
});

describe("suitColor", () => {
  it("red for hearts and diamonds", () => {
    expect(suitColor({ type: "standard", raw: "Ah", rank: "Ace", suit: "Hearts", reversed: false })).toBe("red");
    expect(suitColor({ type: "standard", raw: "Kd", rank: "King", suit: "Diamonds", reversed: false })).toBe("red");
  });

  it("black for clubs and spades", () => {
    expect(suitColor({ type: "standard", raw: "7c", rank: "7", suit: "Clubs", reversed: false })).toBe("black");
    expect(suitColor({ type: "standard", raw: "Qs", rank: "Queen", suit: "Spades", reversed: false })).toBe("black");
  });

  it("neutral for major arcana and oracle", () => {
    expect(suitColor({ type: "major_arcana", raw: "M0", number: 0, name: "The Fool", reversed: false })).toBe("neutral");
    expect(suitColor({ type: "oracle", raw: "X", name: "X", reversed: false })).toBe("neutral");
  });
});
