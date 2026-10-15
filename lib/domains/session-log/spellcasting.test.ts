import { describe, it, expect } from "vitest";
import { ordinal, slotName, statusCard, withCast, withInflict } from "./spellcasting";
import { resolveLogTemplate } from "./template-resolver";

const javelin = [
  '@({{actor}}) @[[Kowyn]].action("Icicle Javelin º") → {{target}}',
  "d: Attack | d20+6= vs AC {{target_ac}} ->",
  "d: Cold damage | 3d8=",
].join("\n");
const cast = { circle: 1, damage: { 1: "3d8 cold", 2: "4d8 cold", 3: "5d8 cold" } };

describe("casting with a slot", () => {
  it("names circles and their slots", () => {
    expect([1, 2, 3, 4, 11, 21].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "21st"]);
    expect(slotName(2)).toBe("2nd-Circle Slot");
  });

  it("rolls the circle's damage, and spends its slot", () => {
    expect(withCast(javelin, cast, 2, "Kowyn").split("\n")).toEqual([
      '@({{actor}}) @[[Kowyn]].action("Icicle Javelin º") → {{target}}',
      "d: Attack | d20+6= vs AC {{target_ac}} ->",
      "d: Cold damage | 4d8=",
      "=> [Kowyn/2nd-Circle Slot-1]",
    ]);
    expect(withCast(javelin, cast, 1, "Kowyn")).toContain("3d8=\n=> [Kowyn/1st-Circle Slot-1]");
  });

  it("leaves a condition on its target — a foe's, or one of the party's", () => {
    expect(withInflict("@(Kowyn) Javelin → {{target}}", "pinned", true)).toBe(
      "@(Kowyn) Javelin → {{target}}\n=> [F:{{target}}|+pinned]"
    );
    expect(withInflict("x", "pinned", false)).toBe("x\n=> [PC:{{target}}|+pinned]");
  });

  it("names what left the condition", () => {
    expect(withInflict("x", "pinned", true, "Icicle Javelin º")).toBe(
      "x\n=> [F:{{target}}|+pinned([[Icicle Javelin º]])]"
    );
  });
});

describe("a status card", () => {
  const card = statusCard({
    actor: "Fat Kobold, A",
    isFoe: true,
    condition: "pinned",
    save: "STR",
    when: "at the start of its turn",
    fail: "its speed is 0 until the start of its next turn",
    modifier: -2,
    from: "Icicle Javelin º",
  });

  it("rolls the save against the DC", () => {
    expect(card.bucket).toBe("status");
    expect(resolveLogTemplate(card.logTemplate, { actor: "Fat Kobold, A", dc: "13" })).toBe(
      "@(Fat Kobold, A) Struggles against being pinned\nd: STR save | d20-2= vs DC 13 ->"
    );
  });

  it("frees its bearer on a success, and says how", () => {
    expect(card.status).toEqual({ condition: "pinned", onSuccess: "=> [F:{{actor}}|-pinned]" });
    expect(card.summary).toBe(
      "Pinned (Icicle Javelin º): At the start of its turn, a STR save; on a failure, its speed is 0 until the start of its next turn. A success frees them."
    );
  });

  it("says when it's only its source's effect, not a condition", () => {
    expect(card.text).toBe("Not a condition of its own — an effect of Icicle Javelin º.");
  });

  it("shows a condition's own rules, and ends one with no save to make", () => {
    const prone = statusCard({
      actor: "Lilith",
      isFoe: false,
      condition: "prone",
      rules: ["A prone creature can only crawl."],
    });
    expect(prone.text).toBe("A prone creature can only crawl.");
    expect(prone.logTemplate).toBe("@({{actor}}) Is no longer prone\n=> [PC:{{actor}}|-prone]");
    expect(prone.status).toBeUndefined();
  });
});
