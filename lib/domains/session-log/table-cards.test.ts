import { describe, expect, it } from "vitest";
import type { SessionFeatureCard } from "./card-types";
import { mechanismOf, tableAreaOf } from "./table-cards";

const card = (over: Partial<SessionFeatureCard>): SessionFeatureCard =>
  ({
    id: "x",
    name: "X",
    bucket: "action",
    logTemplate: "",
    source: "gm",
    actor: "Game Master",
    ...over,
  }) as SessionFeatureCard;

describe("table cards", () => {
  it("sorts into areas", () => {
    expect(tableAreaOf(card({ kind: "party" }))).toBe("Party");
    expect(tableAreaOf(card({ kind: "start-combat" }))).toBe("Combat");
    expect(tableAreaOf(card({}), "oracle")).toBe("Story");
  });
  it("tells the mechanism by the lines it writes", () => {
    expect(mechanismOf(card({ logTemplate: "? Is it so?\n->" }))).toBe("Oracles");
    expect(mechanismOf(card({ logTemplate: "gen: Event ->" }))).toBe("Generators");
    expect(mechanismOf(card({ logTemplate: "tbl: Names d20= ->" }))).toBe("Tables");
    expect(mechanismOf(card({ logTemplate: "d(Check): d20= ->" }))).toBe("Rolls");
    expect(mechanismOf(card({ logTemplate: "? Does it?\ngen: Focus ->\n! {{event}}" }))).toBe("Compound");
  });
  it("knows controls, procedures, scenes", () => {
    expect(mechanismOf(card({ kind: "next-round" }))).toBe("Controls");
    expect(mechanismOf(card({ kind: "party" }))).toBe("Procedures");
    expect(mechanismOf(card({ logTemplate: "=> opens" }), "scene")).toBe("Events & scenes");
  });
});
