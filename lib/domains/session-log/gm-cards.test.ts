import { describe, it, expect } from "vitest";
import { buildGMStacks, buildGMStacksFromFeatures, getGMCards, GM_ACTOR } from "./gm-cards";
import type { GMFeature } from "../features/types";

describe("GM Cards", () => {
  describe("getGMCards", () => {
    it("returns all GM card definitions", () => {
      const cards = getGMCards();
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.id).toMatch(/^gm:/);
        expect(card.logTemplate).toBeTruthy();
        expect(card.placeholders.length).toBeGreaterThan(0);
      }
    });

    it("includes all Lonelog primitives", () => {
      const cards = getGMCards();
      const ids = cards.map((c) => c.id);
      expect(ids).toContain("gm:world-event");
      expect(ids).toContain("gm:consequence");
      expect(ids).toContain("gm:question");
      expect(ids).toContain("gm:answer");
      expect(ids).toContain("gm:roll");
      expect(ids).toContain("gm:table");
      expect(ids).toContain("gm:generator");
      expect(ids).toContain("gm:note");
      expect(ids).toContain("gm:scene");
    });
  });

  describe("buildGMStacks", () => {
    it("returns stacks grouped by category", () => {
      const stacks = buildGMStacks();
      expect(stacks.length).toBe(4);
      expect(stacks.map((s) => s.bucket)).toEqual(["narration", "oracle", "mechanics", "meta"]);
    });

    it("sets actorType to gm on all stacks", () => {
      const stacks = buildGMStacks();
      for (const stack of stacks) {
        expect(stack.actorType).toBe("gm");
        expect(stack.actor).toBe(GM_ACTOR);
      }
    });

    it("narration stack has world event and consequence cards", () => {
      const stacks = buildGMStacks();
      const narration = stacks.find((s) => s.bucket === "narration")!;
      const names = narration.cards.map((c) => c.name);
      expect(names).toContain("World Event");
      expect(names).toContain("Consequence");
    });

    it("oracle stack has question and answer cards", () => {
      const stacks = buildGMStacks();
      const oracle = stacks.find((s) => s.bucket === "oracle")!;
      const names = oracle.cards.map((c) => c.name);
      expect(names).toContain("Oracle Question");
      expect(names).toContain("Oracle Answer");
    });

    it("mechanics stack has roll, table, generator cards", () => {
      const stacks = buildGMStacks();
      const mechanics = stacks.find((s) => s.bucket === "mechanics")!;
      const names = mechanics.cards.map((c) => c.name);
      expect(names).toContain("Roll");
      expect(names).toContain("Table");
      expect(names).toContain("Generator");
    });

    it("all cards have valid logTemplates with placeholders", () => {
      const stacks = buildGMStacks();
      for (const stack of stacks) {
        for (const card of stack.cards) {
          expect(card.logTemplate).toContain("{{");
        }
      }
    });
  });

  describe("buildGMStacksFromFeatures", () => {
    const features: GMFeature[] = [
      {
        name: "Scene Check",
        oracle: { question: "Does {{scene}} occur?", chaos: true },
        generator: { name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Alterations" },
        scene: { opens: "S{{n}} {{title}}" },
      },
      { name: "Perception", roll: { name: "Perception", die: "d20", vs: "DC 12" } },
      { name: "Weather", table: { source: "@[[Tables/Weather]]", die: "d6" } },
      { name: "Plot Twist", uses: 1, recovery: "1/session", generator: { name: "Plot Twist", roll: "d100" } },
    ];

    it("groups authored features into stacks by their primary aspect, in canonical order", () => {
      const stacks = buildGMStacksFromFeatures(features);
      expect(stacks.map((s) => s.bucket)).toEqual(["oracle", "roll", "table", "generator"]);
      for (const stack of stacks) {
        expect(stack.actorType).toBe("gm");
        expect(stack.actor).toBe(GM_ACTOR);
      }
    });

    it("puts a card's full multi-line emitted lonelog into its logTemplate", () => {
      const oracle = buildGMStacksFromFeatures(features).find((s) => s.bucket === "oracle")!;
      const card = oracle.cards.find((c) => c.name === "Scene Check")!;
      expect(card.logTemplate).toBe(
        [
          "? [CF:{{cf}}] Does {{scene}} occur?",
          "gen: Testing the Expected Scene",
          "  Alterations: d10= vs CF {{cf}} ->",
          "=> S{{n}} {{title}}",
        ].join("\n")
      );
    });

    it("carries uses/recovery onto the card", () => {
      const gen = buildGMStacksFromFeatures(features).find((s) => s.bucket === "generator")!;
      const twist = gen.cards.find((c) => c.name === "Plot Twist")!;
      expect(twist.maxUses).toBe(1);
      expect(twist.recovery).toBe("1/session");
    });

    it("skips features with no emittable aspect and returns nothing for an empty screen", () => {
      expect(buildGMStacksFromFeatures([{ name: "Empty" }])).toEqual([]);
      expect(buildGMStacksFromFeatures([])).toEqual([]);
    });

    it("expands a feature's `cards:` into one clickable card each, bucketed by first piece", () => {
      const screen: GMFeature = {
        name: "Mythic Screen",
        cards: [
          { name: "Fate Question", emits: [{ oracle: { question: "Is it locked?", chaos: true, likelihood: "likely", roll: "d100" } }] },
          {
            name: "Scene Check",
            emits: [
              { oracle: { question: "Does {{scene}} occur?", chaos: true } },
              { generator: { name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Scene" } },
              { scene: { opens: "S{{n}} {{title}}" } },
            ],
          },
        ],
      };
      const oracle = buildGMStacksFromFeatures([screen]).find((s) => s.bucket === "oracle")!;
      // Both cards lead with an oracle → both in the oracle bucket, in order.
      expect(oracle.cards.map((c) => c.name)).toEqual(["Fate Question", "Scene Check"]);
      // The card emits its pieces in the declared order.
      expect(oracle.cards.find((c) => c.name === "Scene Check")!.logTemplate).toBe(
        [
          "? [CF:{{cf}}] Does {{scene}} occur?",
          "gen: Testing the Expected Scene",
          "  Scene: d10= vs CF {{cf}} ->",
          "=> S{{n}} {{title}}",
        ].join("\n")
      );
    });

    it("honors a card's `stack:` override + carries uses/recovery", () => {
      const screen: GMFeature = {
        name: "Screen",
        cards: [
          { name: "Weather", stack: "table", uses: 2, recovery: "1/day", emits: [{ oracle: { question: "Storm?" } }] },
        ],
      };
      const table = buildGMStacksFromFeatures([screen]).find((s) => s.bucket === "table")!;
      expect(table.cards[0]).toMatchObject({ name: "Weather", maxUses: 2, recovery: "1/day" });
    });
  });
});
