import { describe, expect, it } from "vitest";

import {
  acReactionOf,
  areaTargets,
  attackReach,
  bindMultiattack,
  bonusMovesOf,
  classifyMonsterFeature,
  inflictOfHit,
  inflictOfSave,
  parseLairActions,
  parseMonsterSpellcasting,
  reactionFrom,
  saveReach,
  useLimitOf,
} from "./monster-actions";
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
        reach: { melee: 5 },
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
        reach: { range: 150 },
      },
    });
  });

  it("reads flat damage: a +4 attack dealing a flat 1 piercing", () => {
    expect(classifyMonsterFeature({ name: "Bite", type: "action", text: MIMIC_BITE })).toEqual({
      action: {
        kind: "weapon",
        name: "Bite",
        hitBonus: 4,
        damage: { expr: "1", type: "piercing" },
        reach: { melee: 5 },
      },
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
      // It can throw, but it closes in.
      reach: { melee: 5 },
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
        targets: 1,
        reach: { range: 30 },
        circle: 0,
        limit: { recharge: 5 },
      },
    });
  });

  it("reads a use limit and the size of an area", () => {
    expect(useLimitOf("Fire Breath (Recharge 6)", "")).toEqual({ recharge: 6 });
    expect(useLimitOf("Stinking Cloud (1/Day)", "")).toEqual({ perDay: 1 });
    expect(useLimitOf("Bite", "")).toBeUndefined();
    expect(areaTargets("in a 15-foot cone")).toEqual({ targets: 2 });
    expect(areaTargets("in a 20-foot-radius sphere")).toEqual({ targets: 4 });
    expect(areaTargets("in a 60-foot line that is 5 feet wide")).toEqual({ targets: 2 });
    expect(areaTargets("each creature within 10 feet")).toEqual({});
  });

  it("leaves a feature that needs a partner unsupported", () => {
    const text =
      "Two kobolds within 5 feet of each other can combine their actions to split the earth in a 20-foot line. Each creature in that line must make a DC 13 Dexterity saving throw, taking 7 (2d6) bludgeoning damage.";
    expect(classifyMonsterFeature({ name: "Small but Fierce", type: "action", text })).toEqual({
      skip: "unsupported-feature",
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
  it("reads Spellcasting's list for the loader, and skips a spellcasting feature with none", () => {
    expect(classifyMonsterFeature({ name: "Spellcasting", type: "action", text: CONJURER_SPELLS })).toEqual({
      spellcasting: { ability: "int", dc: 13, lists: [{ spells: ["light", "mage hand", "prestidigitation"] }] },
      skip: "monster-spellcasting",
    });
    expect(classifyMonsterFeature({ name: "Innate Spellcasting", type: "trait", text: "Anything." })).toEqual({
      skip: "monster-spellcasting",
    });
  });

  it("knows spellcasting by the 'casts one of the following spells' prose whatever the name", () => {
    expect(
      classifyMonsterFeature({ name: "Arcane Gift", type: "action", text: CONJURER_SPELLS }).spellcasting
    ).toBeDefined();
  });

  it("reads uses a day, wikilinked names and parentheses", () => {
    expect(
      parseMonsterSpellcasting(
        "The priest casts one of the following spells, using WIS as the spellcasting ability (spell save DC 13).\n\nAt will: *[[guidance]], [[lux|Lux]]*\n\n3/day each: *[[bane]]*, *invisibility* (self only)\n\n1/day: *[[dispel magic]]*"
      )
    ).toEqual({
      ability: "wis",
      dc: 13,
      lists: [
        { spells: ["guidance", "lux"] },
        { perDay: 3, spells: ["bane", "invisibility"] },
        { perDay: 1, spells: ["dispel magic"] },
      ],
    });
  });

  it("reads a bonus action's attack, and the moves a bonus action gives", () => {
    expect(classifyMonsterFeature({ name: "Longsword", type: "bonus", text: LONGSWORD }).bonus).toMatchObject({
      kind: "weapon",
      hitBonus: 3,
      reach: { melee: 5 },
    });
    expect(
      classifyMonsterFeature({
        name: "Nimble Escape",
        type: "bonus",
        text: "The goblin takes the Disengage or Hide action.",
      })
    ).toEqual({ bonusMoves: ["disengage", "hide"] });
  });

  it("skips trait and reaction features, even attack-shaped ones, and a bonus action it cannot play", () => {
    for (const type of ["trait", "reaction"]) {
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

describe("conditions in monster prose", () => {
  it("reads a hit's condition with its own save", () => {
    expect(
      inflictOfHit(
        "7 (1d8 + 3) bludgeoning damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone."
      )
    ).toEqual({ condition: "prone", save: { ability: "str", dc: 13 }, lasts: "start" });
  });

  it("reads a condition a hit brings, and how long", () => {
    expect(
      inflictOfHit("5 (1d6 + 2) piercing damage, and the target is poisoned until the end of its next turn.")
    ).toEqual({
      condition: "poisoned",
      lasts: "end",
    });
    expect(inflictOfHit("6 (1d8 + 2) bludgeoning damage, and the target is grappled (escape DC 13).")).toBeUndefined();
    expect(inflictOfHit("8 (1d10 + 3) slashing damage.")).toBeUndefined();
  });

  it("reads what a failed save brings", () => {
    expect(
      inflictOfSave(
        "Each creature in that line must make a DC 13 Dexterity saving throw. On a failure, a creature takes 7 (2d6) bludgeoning damage and is knocked prone."
      )
    ).toEqual({ condition: "prone", lasts: "start" });
    expect(
      classifyMonsterFeature({
        name: "Frightful Shriek",
        type: "action",
        text: "Each creature within 30 feet must succeed on a DC 12 Wisdom saving throw, taking 5 (2d4) psychic damage on a failed save and becoming frightened for 1 minute.",
      }).action
    ).toMatchObject({ kind: "save", inflicts: { condition: "frightened", lasts: "fight" } });
  });
});

describe("the Monster Vault's short saves and legendary actions", () => {
  const WING =
    "The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 DEX save or take 22 (4d6 + 8) bludgeoning damage and be knocked prone.";

  it("reads 'a DC 23 DEX save' like 'a Dexterity saving throw'", () => {
    expect(
      classifyMonsterFeature({
        name: "Fire Breath (Recharge 5–6)",
        type: "action",
        text: "The dragon exhales fire in a 60-foot cone. Each creature in that area must make a DC 21 DEX save, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.",
      }).action
    ).toMatchObject({
      kind: "save",
      dc: 21,
      ability: "dex",
      damage: { expr: "18d6", type: "fire" },
      targets: 6,
      limit: { recharge: 5 },
    });
  });

  it("reads a legendary action with its cost: its own save, or one of the monster's attacks", () => {
    expect(
      classifyMonsterFeature({ name: "Wing Attack (Costs 2 Actions)", type: "legendary", text: WING })
    ).toMatchObject({
      legendary: { cost: 2, action: { kind: "save", dc: 23, ability: "dex", inflicts: { condition: "prone" } } },
    });
    expect(
      classifyMonsterFeature({ name: "Tail Attack", type: "legendary", text: "The dragon makes a Tail attack." })
    ).toMatchObject({
      legendary: { cost: 1, attackRef: "Tail" },
    });
    expect(
      classifyMonsterFeature({
        name: "Detect",
        type: "legendary",
        text: "The dragon automatically detects every creature within 60 feet.",
      })
    ).toEqual({ skip: "unsupported-feature" });
  });
});

describe("reactions and Legendary Resistance", () => {
  it("reads a reaction that raises the creature's own AC, not one that shields another", () => {
    expect(acReactionOf("The veteran adds 2 to its AC against one melee attack that would hit it.")).toEqual({
      ac: 2,
      untilTurn: false,
    });
    expect(
      acReactionOf(
        "When a creature the fenrosk can see attacks it, the fenrosk can curl into a tight ball, increasing its AC by 2 until the start of its next turn."
      )
    ).toEqual({ ac: 2, untilTurn: true });
    expect(
      acReactionOf(
        "When a friendly creature the guard can see within 5 feet of it is the target of an attack, the friendly creature adds 2 to its AC against that attack."
      )
    ).toBeUndefined();
  });

  it("reads Legendary Resistance's uses and a Parry from a reaction feature", () => {
    expect(
      classifyMonsterFeature({
        name: "Legendary Resistance (3/Day)",
        type: "trait",
        text: "If the dragon fails a save, it can choose to succeed instead.",
      })
    ).toMatchObject({ legendaryResistance: 3 });
    expect(
      classifyMonsterFeature({
        name: "Parry",
        type: "reaction",
        text: "The veteran adds 2 to its AC against one melee attack that would hit it.",
      })
    ).toMatchObject({ reaction: { ac: 2 } });
  });
});

describe("reach, bonus moves and lair actions", () => {
  it("reads where an attack reaches", () => {
    expect(attackReach("*Melee Weapon Attack:* +5 to hit, reach 10 ft., one target.")).toEqual({ melee: 10 });
    expect(attackReach("_Ranged Weapon Attack:_ +4 to hit, range 80/320 ft., one target.")).toEqual({ range: 80 });
    expect(attackReach("*Melee or Ranged Weapon Attack:* +4 to hit, reach 5 ft. or range 20/60 ft.")).toEqual({
      melee: 5,
    });
    expect(attackReach("+4 to hit, one target.")).toBeUndefined();
  });

  it("reads how far a save effect reaches from its user", () => {
    expect(saveReach("a point it can see within 120 feet of it")).toEqual({ range: 120 });
    expect(saveReach("The dragon exhales fire in a 30-foot cone.")).toEqual({ range: 30 });
    expect(saveReach("Each creature in the area must make a DC 13 DEX save.")).toBeUndefined();
  });

  it("reads the moves a bonus action gives", () => {
    expect(bonusMovesOf("The goblin takes the Disengage or Hide action.")).toEqual(["disengage", "hide"]);
    expect(bonusMovesOf("It can take the Dash, Disengage, or Hide action.")).toEqual(["dash", "disengage", "hide"]);
    expect(bonusMovesOf("The hobgoblin briefly studies one creature.")).toEqual([]);
  });

  it("reads a lair's actions from its note, and leaves out what it cannot play", () => {
    const note = [
      "## A Red Dragon's Lair",
      "### Lair Actions",
      "On initiative count 20 (losing initiative ties), the dragon can take a lair action:",
      "- **Collapse.** Each creature in a 20-foot square area must succeed on a DC 15 DEX save or be knocked prone.",
      "- **Swirling Ash.** Each creature within 30 feet of that point must make a DC 15 CON save. On a failure, a",
      "creature takes 10 (3d6) fire damage.",
      "- **Whispers.** The dragon speaks into every mind in the lair.",
      "### Regional Effects",
      "- **Heat.** Water near the lair is hot.",
    ].join("\n");
    const lair = parseLairActions(note);
    expect(lair.map((a) => a.name)).toEqual(["Collapse", "Swirling Ash"]);
    expect(lair[0]).toMatchObject({ kind: "save", dc: 15, ability: "dex", damage: { expr: "0" } });
    expect(lair[0]).toMatchObject({ inflicts: { condition: "prone" } });
    expect(lair[1]).toMatchObject({ kind: "save", ability: "con", damage: { expr: "3d6", type: "fire" } });
    expect(parseLairActions("# A note with no lair")).toEqual([]);
  });
});

describe("reactionFrom", () => {
  it("reads a counterattack, naming its attack or not", () => {
    expect(
      reactionFrom(
        "Reflexive Strike",
        "When the warlord is hit by an attack roll, it can make one Battle Axe attack against the attacker."
      )
    ).toMatchObject({ kind: "counter", attackRef: "Battle Axe" });
    expect(
      reactionFrom(
        "Counterattack (Recharge 6)",
        "When a creature the alseid can see hits it with an attack, the alseid can make one melee or ranged attack against the attacker."
      )
    ).toEqual({ kind: "counter", name: "Counterattack (Recharge 6)", limit: { recharge: 6 } });
  });

  it("reads damage back, with a save or without", () => {
    expect(
      reactionFrom(
        "Blasphemous Word",
        "When a creature the void angel can see hits it with an attack, the angel can utter a dark word. The attacker takes 4 (1d8) necrotic damage."
      )
    ).toMatchObject({ kind: "retaliate", damage: { expr: "1d8", type: "necrotic" } });
    expect(
      reactionFrom(
        "Stunning Jolt",
        "When a creature within 5 feet of it hits it with a melee attack, the creature must succeed on a DC 15 CON save or be stunned until the end of its next turn."
      )
    ).toMatchObject({
      kind: "retaliate",
      within: 5,
      meleeOnly: true,
      save: { ability: "con", dc: 15 },
      inflicts: { condition: "stunned" },
    });
  });

  it("reads disadvantage, halving and a counterspell", () => {
    expect(
      reactionFrom(
        "Fin Flare",
        "When a creature the xypth can see attacks it, the xypth flares its fins. The attacker has disadvantage on the attack roll."
      )
    ).toMatchObject({ kind: "disadvantage" });
    expect(
      reactionFrom(
        "Huddle",
        "When a creature the ankylosaurus can see hits it with a weapon attack, it halves the attack's damage against it."
      )
    ).toMatchObject({ kind: "halve" });
    expect(
      reactionFrom(
        "Counter Spell",
        "When a creature the archmage can see within 30 feet of it casts a spell, the archmage can counter the spell, interrupting the casting."
      )
    ).toMatchObject({ kind: "counterspell", within: 30, upTo: 3 });
  });

  it("reads a reaction that protects an ally: its AC raised, or disadvantage", () => {
    expect(
      reactionFrom(
        "Protector's Parry",
        "When a friendly creature the guard can see within 5 feet of it is the target of an attack, the guard can interpose its weapon between the creature and the attacker. The friendly creature adds 2 to its AC against that attack."
      )
    ).toMatchObject({ kind: "protect", within: 5, ac: 2 });
    const spoil = reactionFrom(
      "Protective Interference",
      "When a friendly creature the shadow fey guardian can see within 5 feet of it is the target of an attack, the guardian can impose disadvantage on the attack roll."
    );
    expect(spoil).toMatchObject({ kind: "protect", within: 5 });
    expect(spoil?.ac).toBeUndefined();
  });

  it("reads a reaction that moves: away when missed or hurt, toward an enemy that moves", () => {
    expect(
      reactionFrom(
        "Nimble Dodge",
        "When a creature the musculi can see misses it with an attack, the musculi can move up to half its speed without provoking opportunity attacks."
      )
    ).toMatchObject({ kind: "move", trigger: "missed" });
    expect(
      reactionFrom(
        "Rescue Step",
        "When Mott takes damage from an attack, he can teleport up to 30 feet to an unoccupied space he can see."
      )
    ).toMatchObject({ kind: "move", trigger: "damaged", feet: 30 });
    expect(
      reactionFrom(
        "Slithering Pursuit",
        "When a hostile creature the spawn can see within 30 feet of it moves, the spawn can move up to half its speed toward that creature. This movement doesn't provoke opportunity attacks."
      )
    ).toMatchObject({ kind: "move", trigger: "approached", toward: true, within: 30 });
    // A move to guard its ward is not a move of its own.
    expect(
      reactionFrom(
        "Defensive Transport",
        "When the barquil's ward takes damage from an attack or effect the barquil can see, the barquil can teleport up to 30 feet toward the ward into an unoccupied space."
      )?.kind
    ).not.toBe("move");
  });

  it("leaves out a reaction that halves only some damage", () => {
    expect(
      reactionFrom(
        "Energy Absorption",
        "Whenever the trail snail takes acid, cold, fire, lightning, or thunder damage, it can halve the damage taken."
      )
    ).toBeUndefined();
    expect(
      reactionFrom(
        "Self-Destruct",
        "If the servant takes damage that would reduce its HP to 0, it can explode. Each creature within 15 feet must make a DEX save; on a success, a creature takes only half damage."
      )?.kind
    ).not.toBe("halve");
  });
});
