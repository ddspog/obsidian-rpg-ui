import { describe, expect, it } from "vitest";

import { bindMultiattack, classifyMonsterFeature } from "./monster-actions";
import type { WeaponAttackAction } from "./types";

// Real prose from the Tales of the Valiant Monster Vault notes (feature.details bodies).
const LONGSWORD =
  "*Melee Weapon Attack:* +3 to hit, reach 5 ft., one target. *Hit:* 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.";
const LONGBOW = "*Ranged Weapon Attack:* +3 to hit, range 150/600 ft., one target. *Hit:* 5 (1d8 + 1) piercing damage.";
const MIMIC_BITE = "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 1 piercing damage.";
const HOBGOBLIN_MULTI = "The hobgoblin makes two Longsword or Longbow attacks.";
const LIGHTNING_BREATH =
  "The behir exhales lightning in a 30-foot line that is 5 feet wide. Each creature in that line must make a DC 16 Dexterity saving throw, taking 54 (12d8) lightning damage on a failed save, or half as much damage on a successful one.\n\n![[actions-3.webp]]";
const TACTICAL_ANALYSIS =
  "The hobgoblin briefly studies one creature it can see within 30 feet of it. It has advantage on the next attack roll it makes against that creature before the start of the hobgoblin’s next turn.";
const CONJURER_SPELLS =
  "The hobgoblin conjurer casts one of the following spells, using INT as the spellcasting ability (spell save DC 13).\n\nAt will: *light, mage hand, prestidigitation*";

describe("classifyMonsterFeature: attacks", () => {
  it("reads the Longsword: +3, first-listed 1d8+1 slashing, two-handed option ignored", () => {
    expect(classifyMonsterFeature({ name: "Longsword", type: "action", text: LONGSWORD })).toEqual({
      action: {
        kind: "weapon",
        name: "Longsword",
        hitBonus: 3,
        damage: { expr: "1d8+1", type: "slashing" },
      },
    });
  });

  it("reads the Longbow: +3, 1d8+1 piercing", () => {
    expect(classifyMonsterFeature({ name: "Longbow", type: "action", text: LONGBOW })).toEqual({
      action: {
        kind: "weapon",
        name: "Longbow",
        hitBonus: 3,
        damage: { expr: "1d8+1", type: "piercing" },
      },
    });
  });

  it("reads flat damage: a +4 attack dealing a flat 1 piercing", () => {
    expect(classifyMonsterFeature({ name: "Bite", type: "action", text: MIMIC_BITE })).toEqual({
      action: { kind: "weapon", name: "Bite", hitBonus: 4, damage: { expr: "1", type: "piercing" } },
    });
  });

  it("reads 'Melee or Ranged' phrasing and keeps the first damage group of a 'plus' pair", () => {
    const text =
      "*Melee or Ranged Weapon Attack:* +7 to hit, reach 5 ft. or range 20/60 ft., one target. *Hit:* 6 (1d4 + 4) piercing damage plus 7 (2d6) poison damage.";
    expect(classifyMonsterFeature({ name: "Dagger", type: "action", text }).action).toEqual({
      kind: "weapon",
      name: "Dagger",
      hitBonus: 7,
      damage: { expr: "1d4+4", type: "piercing" },
    });
  });

  it("reads a flat first group even when dice follow it", () => {
    const text =
      "*Melee Weapon Attack:* +2 to hit, reach 5 ft., one target. *Hit:* 1 piercing damage plus 3 (1d6) poison damage.";
    expect(classifyMonsterFeature({ name: "Sting", type: "action", text }).action).toMatchObject({
      hitBonus: 2,
      damage: { expr: "1", type: "piercing" },
    });
  });

  it("reads a negative to-hit and a Hit marker on its own paragraph", () => {
    const text = "*Melee Weapon Attack:* -1 to hit, reach 5 ft., one target.\n\n*Hit:* 20 (3d10 + 4) piercing damage.";
    expect(classifyMonsterFeature({ name: "Bite", type: "action", text }).action).toMatchObject({
      hitBonus: -1,
      damage: { expr: "3d10+4", type: "piercing" },
    });
  });
});

describe("classifyMonsterFeature: save area effects", () => {
  it("reads Lightning Breath: DC 16 DEX, 12d8 lightning, half on success, area", () => {
    expect(
      classifyMonsterFeature({ name: "Lightning Breath (Recharge 5–6)", type: "action", text: LIGHTNING_BREATH })
    ).toEqual({
      action: {
        kind: "save",
        name: "Lightning Breath (Recharge 5–6)",
        dc: 16,
        ability: "dex",
        damage: { expr: "12d8", type: "lightning" },
        onSuccess: "half",
        area: true,
        circle: 0,
      },
    });
  });

  it("takes onSuccess none when the prose gives no half damage", () => {
    const text =
      "Each creature in the cloud must make a DC 13 Constitution saving throw, taking 10 (3d6) poison damage on a failed save.";
    expect(classifyMonsterFeature({ name: "Spores", type: "action", text }).action).toMatchObject({
      kind: "save",
      dc: 13,
      ability: "con",
      damage: { expr: "3d6", type: "poison" },
      onSuccess: "none",
    });
  });

  it("skips a save with no parseable damage", () => {
    const text = "The creature must succeed on a DC 14 Wisdom saving throw or be frightened for 1 minute.";
    expect(classifyMonsterFeature({ name: "Scare", type: "action", text })).toEqual({ skip: "unsupported-feature" });
  });
});

describe("classifyMonsterFeature: multiattack", () => {
  it("returns the parsed Multiattack", () => {
    expect(classifyMonsterFeature({ name: "Multiattack", type: "action", text: HOBGOBLIN_MULTI })).toEqual({
      multiattack: { count: 2, attacks: ["Longsword", "Longbow"] },
    });
  });

  it("skips a Multiattack that names no attacks", () => {
    expect(classifyMonsterFeature({ name: "Multiattack", type: "action", text: "The thing attacks wildly." })).toEqual({
      skip: "unsupported-feature",
    });
  });
});

describe("classifyMonsterFeature: skips", () => {
  it("skips Spellcasting and Innate Spellcasting by name", () => {
    expect(classifyMonsterFeature({ name: "Spellcasting", type: "action", text: CONJURER_SPELLS })).toEqual({
      skip: "monster-spellcasting",
    });
    expect(classifyMonsterFeature({ name: "Innate Spellcasting", type: "trait", text: "Anything." })).toEqual({
      skip: "monster-spellcasting",
    });
  });

  it("skips by the 'casts one of the following spells' prose whatever the name", () => {
    expect(classifyMonsterFeature({ name: "Arcane Gift", type: "action", text: CONJURER_SPELLS })).toEqual({
      skip: "monster-spellcasting",
    });
  });

  it("skips bonus, trait, legendary and reaction features, even attack-shaped ones", () => {
    for (const type of ["bonus", "trait", "legendary", "reaction"]) {
      expect(classifyMonsterFeature({ name: "Longsword", type, text: LONGSWORD })).toEqual({
        skip: "unsupported-feature",
      });
    }
    expect(classifyMonsterFeature({ name: "Tactical Analysis", type: "bonus", text: TACTICAL_ANALYSIS })).toEqual({
      skip: "unsupported-feature",
    });
  });

  it("skips a type-less feature and unparseable action prose", () => {
    expect(classifyMonsterFeature({ name: "Longsword", text: LONGSWORD })).toEqual({ skip: "unsupported-feature" });
    expect(classifyMonsterFeature({ name: "Tactical Analysis", type: "action", text: TACTICAL_ANALYSIS })).toEqual({
      skip: "unsupported-feature",
    });
  });

  it("skips an attack roll with no damage", () => {
    const text = "*Melee Weapon Attack:* +5 to hit, reach 5 ft., one target. *Hit:* The target is grappled.";
    expect(classifyMonsterFeature({ name: "Grab", type: "action", text })).toEqual({ skip: "unsupported-feature" });
  });
});

describe("bindMultiattack", () => {
  const longsword: WeaponAttackAction = {
    kind: "weapon",
    name: "Longsword",
    hitBonus: 3,
    damage: { expr: "1d8+1", type: "slashing" },
  };
  const longbow: WeaponAttackAction = {
    kind: "weapon",
    name: "Longbow",
    hitBonus: 3,
    damage: { expr: "1d8+1", type: "piercing" },
  };

  it("binds 'two Longsword or Longbow attacks' to two Longsword swings (tie goes to the first listed)", () => {
    const parsed = classifyMonsterFeature({ name: "Multiattack", type: "action", text: HOBGOBLIN_MULTI }).multiattack!;
    const bound = bindMultiattack(
      parsed,
      new Map([
        ["Longsword", longsword],
        ["Longbow", longbow],
      ])
    );
    expect(bound).toEqual({ kind: "multiattack", name: "Multiattack", swings: [longsword, longsword] });
  });

  it("takes the alternative with the higher average, not the first listed", () => {
    const strong: WeaponAttackAction = { ...longbow, damage: { expr: "2d8+1", type: "piercing" } };
    const bound = bindMultiattack(
      { count: 2, attacks: ["Longsword", "Longbow"] },
      { Longsword: longsword, Longbow: strong }
    );
    expect(bound).toEqual({ kind: "multiattack", name: "Multiattack", swings: [strong, strong] });
  });

  it("matches names case-insensitively and ignores attacks the monster lacks", () => {
    const bound = bindMultiattack({ count: 3, attacks: ["BOW", "longbow"] }, { Longbow: longbow });
    expect(bound).toMatchObject({ kind: "multiattack", swings: [longbow, longbow, longbow] });
  });

  it("is unsupported when no named attack is bound", () => {
    expect(bindMultiattack({ count: 2, attacks: ["Bite"] }, { Longsword: longsword })).toEqual({
      skip: "unsupported-feature",
    });
    expect(bindMultiattack({ count: 2, attacks: ["Bite"] }, new Map())).toEqual({ skip: "unsupported-feature" });
  });
});
