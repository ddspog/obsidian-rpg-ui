import { describe, expect, it } from "vitest";
import { castBlock, parseComponents, readItemFacts, type CastingKit } from "./casting";

const kit = (over: Partial<CastingKit> = {}): CastingKit => ({ held: [], pouch: false, ...over });

describe("parseComponents", () => {
  it("reads V, S, M and a cost", () => {
    expect(parseComponents(["V", "S"])).toEqual({ v: true, s: true, m: false, costly: false });
    expect(parseComponents(["V", "M (a small icicle)"])).toMatchObject({ m: true, costly: false });
    expect(parseComponents(["M (a pearl worth at least 100gp and an owl feather)"])).toMatchObject({ costly: true });
    expect(parseComponents(undefined)).toBeUndefined();
  });
});

describe("readItemFacts", () => {
  it("finds two-handed, the magic a focus serves, a pouch", () => {
    expect(readItemFacts('properties:\n    - "[[Two-Handed]]"', "Glaive").twoHanded).toBe(true);
    expect(
      readItemFacts("This item can be used as a spellcasting focus to channel [[Divine]] spells.", "Holy Symbol").focus
    ).toEqual(["Divine"]);
    expect(readItemFacts("can be used as an Arcane spellcasting focus", "Staff of X").focus).toEqual(["Arcane"]);
    expect(readItemFacts("", "Component Pouch").pouch).toBe(true);
  });
});

describe("castBlock", () => {
  const vs = parseComponents(["V", "S"]);
  const vm = parseComponents(["V", "M (a feather)"]);
  const costly = parseComponents(["M (a ruby worth 50gp)"]);
  it("asks nothing for a verbal spell", () => {
    expect(castBlock(parseComponents(["V"]), [], kit({ held: [{ hands: 2, focus: [] }] }))).toBeUndefined();
  });
  it("needs a free hand for gestures", () => {
    expect(
      castBlock(
        vs,
        [],
        kit({
          held: [
            { hands: 1, focus: [] },
            { hands: 1, focus: [] },
          ],
        })
      )
    ).toBe("no free hand");
    expect(castBlock(vs, [], kit({ held: [{ hands: 2, focus: [] }] }))).toBe("no free hand");
    expect(castBlock(vs, [], kit({ held: [{ hands: 1, focus: [] }] }))).toBeUndefined();
  });
  it("lets the hand holding the right focus gesture", () => {
    const k = kit({
      held: [
        { hands: 1, focus: ["Primordial"] },
        { hands: 1, focus: [] },
      ],
    });
    expect(castBlock(vs, ["Primordial"], k)).toBeUndefined();
    expect(castBlock(vs, ["Divine"], k)).toBe("no free hand");
  });
  it("needs a focus of the spell's magic or a pouch for a material component", () => {
    expect(castBlock(vm, ["Primordial"], kit())).toBe("no focus or component pouch");
    expect(castBlock(vm, ["Primordial"], kit({ pouch: true }))).toBeUndefined();
    expect(castBlock(vm, ["Primordial"], kit({ held: [{ hands: 1, focus: ["Primordial"] }] }))).toBeUndefined();
    expect(castBlock(vm, ["Divine"], kit({ held: [{ hands: 1, focus: ["Primordial"] }] }))).toBe(
      "no focus or component pouch"
    );
  });
  it("can't check a costly component, only the hand", () => {
    expect(castBlock(costly, [], kit())).toBeUndefined();
  });
});
