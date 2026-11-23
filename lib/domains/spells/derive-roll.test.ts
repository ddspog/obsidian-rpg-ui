import { describe, expect, it } from "vitest";
import { circleNumber, deriveSpellRoll } from "./derive-roll";

describe("deriveSpellRoll", () => {
  it("reads an area save with half damage and its upcast", () => {
    expect(
      deriveSpellRoll({
        circle: "3rd-Circle",
        range: "150 feet",
        text: "Each creature in a 20-foot-radius sphere centered on that point must make a DEX save. A target takes 8d6 fire damage on a failed save, or half as much damage on a success.\n\n*At Higher Circles.* When you cast this spell using a spell slot of 4th circle or higher, the damage increases by 1d6 for each slot above 3rd.",
      })
    ).toEqual({
      roll: {
        form: "save",
        circle: 3,
        range: "150 feet",
        save: { ability: "DEX", on_success: "half damage" },
        damage: { roll: "8d6", type: "fire" },
        upcast: Object.fromEntries(
          [4, 5, 6, 7, 8, 9].map((c) => [c, { damage: { roll: `${c + 5}d6`, type: "fire" } }])
        ),
      },
    });
  });

  it("reads a cantrip attack with its damage by level", () => {
    const r = deriveSpellRoll({
      circle: "Cantrip",
      text: "Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
    });
    expect(r).toMatchObject({
      roll: {
        form: "spell",
        circle: 0,
        damage: { roll: "1d10", type: "fire" },
        leveled: { at: { 5: {}, 11: {}, 17: {} } },
      },
    });
  });

  it("reads a save that brings a condition, as effects and notes", () => {
    expect(
      deriveSpellRoll({
        circle: 2,
        duration: "Concentration, up to 1 minute",
        text: "The target must succeed on a WIS save or be paralyzed for the duration.",
      })
    ).toEqual({
      roll: {
        form: "save",
        circle: 2,
        save: { ability: "WIS", on_success: "negates paralyzed" },
        effects: ["paralyzed"],
        notes: "The target must succeed on a WIS save or be paralyzed for the duration (Concentration, up to 1 minute)",
      },
    });
  });

  it("reads 'taking … damage', a chosen type, falling prone, a heal and a smite", () => {
    expect(
      deriveSpellRoll({
        circle: 1,
        text: "Each creature in the area must make a DEX save, taking 3d6 cold damage on a failure.",
      })
    ).toMatchObject({ roll: { damage: { roll: "3d6", type: "cold" }, save: { on_success: "no damage" } } });
    expect(
      deriveSpellRoll({
        circle: 1,
        text: "You choose cold, fire, lightning, or thunder damage. Each creature in the area must make a DEX save, taking 2d8 damage of the type you chose on a failure.",
      })
    ).toMatchObject({ roll: { damage: { roll: "2d8", type: "cold" } } });
    expect(
      deriveSpellRoll({
        circle: 1,
        text: "Each creature standing in its area must succeed on a DEX save or fall prone.",
      })
    ).toMatchObject({ roll: { form: "save", effects: ["prone"] } });
    expect(
      deriveSpellRoll({
        circle: 1,
        text: "A creature of your choice regains hit points equal to 1d4 + your spellcasting ability modifier. When you cast this spell using a spell slot of 2nd circle or higher, the healing increases by 1d4 for each slot above 1st.",
      })
    ).toMatchObject({
      roll: { form: "healing", damage: { roll: "1d4", type: "healing" }, upcast: { 2: { damage: { roll: "2d4" } } } },
    });
    expect(
      deriveSpellRoll({
        circle: 1,
        text: "The first time you hit, the attack deals an extra 2d6 radiant damage to the target.",
      })
    ).toMatchObject({ roll: { form: "rider", damage: { roll: "2d6", type: "radiant" } } });
  });

  it("gives none, and why, to a spell its words do not fit", () => {
    expect(deriveSpellRoll({ circle: 1, text: "You touch a creature. It has advantage on checks." })).toEqual({
      skip: "no attack, save or healing in its words",
    });
    expect(circleNumber("Cantrip")).toBe(0);
    expect(circleNumber("5th-Circle")).toBe(5);
  });
});
