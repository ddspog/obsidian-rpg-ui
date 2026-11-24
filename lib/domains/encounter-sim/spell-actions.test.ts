import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SKIP_REASONS } from "./types";
import {
  resolveSpellOption,
  spellReach,
  spellReactionOf,
  type SpellNumbers,
  type SpellOptionInput,
} from "./spell-actions";

/** Kowyn-shaped numbers: proficiency +2, casting modifier +4, level 3. */
const NUMBERS: SpellNumbers = { proficiencyBonus: 2, castingModifier: 4, characterLevel: 3 };
const OWNER = "Kowyn";

/** Each fixture is the `rpg spell` fence of the vault note, trimmed to what the resolver reads. */
function spellFrom(yaml: string, text: string): SpellOptionInput {
  const fence = parse(yaml) as Record<string, unknown>;
  const circleLabel = String(fence.circle ?? "");
  return {
    name: String(fence.name),
    roll: fence.roll as Record<string, unknown> | undefined,
    summary: fence.summary as string | undefined,
    text,
    circle: /cantrip/i.test(circleLabel) ? 0 : parseInt(circleLabel, 10),
  };
}

const THUNDERWAVE = spellFrom(
  `
name: Thunderwave
circle: 1st-Circle
summary: Push and damage foes.
roll:
  form: save
  circle: 1
  range: Self (15-ft cube)
  save:
    ability: CON
    on_success: "half damage"
  damage:
    roll: 2d8
    type: thunder
  effects:
    - push
  notes: pushes foes 10 ft on fail
  upcast:
    2: { damage: { roll: 3d8, type: thunder } }
    3: { damage: { roll: 4d8, type: thunder } }
`,
  "A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a CON save. On a failed save, a creature takes 2d8 thunder damage and is pushed 10 feet away from you. On a successful save, the creature takes half as much damage and isn’t pushed."
);

const CREATE_BONFIRE = spellFrom(
  `
name: Create Bonfire ᴰ
circle: Cantrip
summary: Make a bonfire on the ground.
roll:
  form: save
  circle: 0
  range: 60 ft.
  save:
    ability: DEX
    on_success: "no damage"
  damage:
    roll: 1d8
    type: fire
  notes: 5-ft cube, ignites flammables
  leveled:
    at:
      5:  { damage: { roll: 2d8, type: fire } }
      11: { damage: { roll: 3d8, type: fire } }
      17: { damage: { roll: 4d8, type: fire } }
`,
  "You create a bonfire on ground that you can see within range. Until the spell ends, the magic bonfire fills a 5-foot cube. Any creature in the bonfire’s space when you cast the spell must succeed on a Dexterity saving throw or take 1d8 fire damage."
);

const MAGNETOBOLT = spellFrom(
  `
name: Magnetobolt º
circle: Cantrip
summary: Pull a creature to the ground.
roll:
  form: spell
  circle: 0
  range: 90 ft.
  damage:
    roll: 1d6
    type: force
  save:
    ability: STR
    on_success: "negates prone"
  effects:
    - prone
  notes: knocked prone on failed save
  leveled:
    at:
      5:  { damage: { roll: 2d6, type: force } }
      11: { damage: { roll: 3d6, type: force } }
      17: { damage: { roll: 4d6, type: force } }
`,
  "Make a ranged spell attack against the target. On a hit, the target takes 1d6 force damage and must succeed on a Strength saving throw or be knocked prone."
);

const ICICLE_JAVELIN = spellFrom(
  `
name: Icicle Javelin º
circle: 1st-Circle
summary: Hurl an ice lance that can pin target.
roll:
  form: spell
  circle: 1
  range: 60 ft.
  damage:
    roll: 3d8
    type: cold
  effects:
    - pin
  inflicts:
    condition: pinned
    save: STR
    when: at the start of its turn
    fail: its speed is 0 until the start of its next turn
    optional: true
  notes: may pin target adjacent to large surface
  upcast:
    2: { damage: { roll: 4d8, type: cold } }
    3: { damage: { roll: 5d8, type: cold } }
`,
  "You fling a massive icicle toward a target of your choice within range. Make a ranged spell attack against the target. On a hit, the target takes 3d8 cold damage."
);

const TOXIC_PLUME = spellFrom(
  `
name: Toxic Plume º
circle: 1st-Circle
summary: Give poisoned to creatures on a cone.
roll:
  form: save
  circle: 1
  range: Self (15-foot cone)
  save:
    ability: CON
    on_success: "no damage"
  damage:
    roll: 2d6
    type: poison
  effects:
    - poisoned
  notes: poisoned (1m) on failed save
  upcast:
    2: { damage: { roll: 3d6, type: poison } }
    3: { damage: { roll: 4d6, type: poison } }
`,
  "A cloud of noxious gas spews forth in a 15-foot cone. Each creature in the area must make a Constitution saving throw or take 2d6 poison damage and become poisoned for 1 minute."
);

const CURE_WOUNDS = spellFrom(
  `
name: Cure Wounds
circle: 1st-Circle
summary: Average heal to ally.
roll:
  form: healing
  circle: 1
  range: Touch
  damage:
    roll: 1d8
    type: healing
  notes: no effect on Constructs or Undead
  upcast:
    2: { damage: { roll: 2d8, type: healing } }
    3: { damage: { roll: 3d8, type: healing } }
`,
  "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier."
);

const ENTANGLE = spellFrom(
  `
name: Entangle
circle: 1st-Circle
summary: Restrains targets in 20-ft. square.
roll:
  form: save
  circle: 1
  range: 90 ft.
  save:
    ability: STR
    on_success: "negates restrained"
  effects:
    - restrained
  notes: 20-ft square of grasping weeds; restrained on fail
`,
  "Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. A creature in the area when you cast the spell must succeed on a STR save or be restrained by the entangling plants until the spell ends."
);

const SANCTUARY = spellFrom(
  `
name: Sanctuary
circle: 1st-Circle
summary: Ward a creature against attacks.
roll:
  form: save
  circle: 1
  range: 30 ft.
  save:
    ability: WIS
    on_success: "attack proceeds"
  notes: ward target; attackers WIS save or lose attack/harmful effect
`,
  "You ward a creature within range against attack. Until the spell ends, any creature who targets the warded creature with an attack or a harmful spell must first make a WIS save."
);

const BLESS = spellFrom(
  `
name: Bless
circle: 1st-Circle
summary: Allies add d4 to rolls.
`,
  "You bless up to three creatures of your choice within range. When a target makes an attack roll or a save before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or save."
);

const GUIDANCE = spellFrom(
  `
name: Guidance
circle: Cantrip
summary: Adds d4 to ally ability check.
`,
  "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice."
);

const SPEAK_WITH_ANIMALS = spellFrom(
  `
name: Speak with Animals
circle: 1st-Circle
summary: Understand and speak with animals for a while.
`,
  "You gain the ability to understand and verbally communicate with Beasts and creatures with the Animal tag for the duration."
);

const LUMINOUS_BOLT = spellFrom(
  `
name: Luminous Bolt ᴷ
circle: Cantrip
summary: Shoot a blinding light.
roll:
  form: spell
  circle: 0
  range: 60 ft.
  damage:
    roll: 1d6
    type: radiant
  save:
    ability: CON
    on_success: "negates blinded"
  effects:
    - blinded
  notes: blinded until end of its next turn on failed save
  leveled:
    at:
      5:  { damage: { roll: 2d6, type: radiant } }
      11: { damage: { roll: 3d6, type: radiant } }
      17: { damage: { roll: 4d6, type: radiant } }
`,
  "A ray of sunlight shoots out at a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d6 radiant damage, and it must succeed on a Constitution saving throw or become blinded until the end of its next turn."
);

const LUNARBOLT_WAXING = spellFrom(
  `
name: Lunarbolt Waxing ᴷ
circle: 1st-Circle
summary: Bolt that hits more by distance.
roll:
  form: spell
  circle: 1
  range: ≤30 ft.
  damage:
    - { roll: 1d10, type: cold }
  notes: radiant scales with distance; upcast increases cold dice (see spell text)
  swapOn:
    field: range
    options:
      - value: ≤30 ft.
        damage:
          - { roll: 1d10, type: cold }
      - value: 35–60 ft.
        damage:
          - { roll: 1d10, type: cold }
          - { roll: 1d4, type: radiant }
  upcast:
    2: { damage: [{ roll: 2d10, type: cold }, { roll: 3d4, type: radiant }] }
    3: { damage: [{ roll: 2d10, type: cold }, { roll: 3d6, type: radiant }] }
`,
  "You hurl a bolt of concentrated moonlight at a creature you can see within range. Make a ranged spell attack against the target. On a hit, a target takes 1d10 cold damage."
);

describe("resolveSpellOption: spell attacks", () => {
  it("models form spell with damage as a spell attack at pb + casting modifier, rider ignored (Icicle Javelin)", () => {
    const result = resolveSpellOption(ICICLE_JAVELIN, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "spell-attack",
      name: "Icicle Javelin º",
      hitBonus: 6,
      damage: { expr: "3d8", type: "cold" },
      circle: 1,
      spell: 1,
      upcast: {
        2: { expr: "4d8", type: "cold" },
        3: { expr: "5d8", type: "cold" },
      },
    });
    expect(result.fidelity).toEqual({ name: "Icicle Javelin º", owner: OWNER, status: "modelled" });
    expect(result.needsCastingModifier).toBeUndefined();
  });

  it("carries the note's upcast: each higher circle's damage (the engine picks where to cast it)", () => {
    const action = resolveSpellOption(ICICLE_JAVELIN, NUMBERS, OWNER).action;
    expect(action).toMatchObject({ kind: "spell-attack", damage: { expr: "3d8" }, circle: 1 });
    expect(action && "upcast" in action ? action.upcast : undefined).toEqual({
      2: { expr: "4d8", type: "cold" },
      3: { expr: "5d8", type: "cold" },
    });
  });

  it("models a cantrip with circle 0 (Magnetobolt), its save rider as the condition a hit brings", () => {
    const result = resolveSpellOption(MAGNETOBOLT, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "spell-attack",
      name: "Magnetobolt º",
      hitBonus: 6,
      damage: { expr: "1d6", type: "force" },
      circle: 0,
      spell: 0,
      inflicts: { condition: "prone", lasts: "start", save: { ability: "str", dc: 14 } },
    });
  });

  it("applies the leveled.at override only when the character level reaches it (Luminous Bolt)", () => {
    const at = (characterLevel: number) =>
      resolveSpellOption(LUMINOUS_BOLT, { ...NUMBERS, characterLevel }, OWNER).action;
    expect(at(4)).toMatchObject({ kind: "spell-attack", damage: { expr: "1d6", type: "radiant" } });
    expect(at(5)).toMatchObject({ damage: { expr: "2d6" } });
    expect(at(10)).toMatchObject({ damage: { expr: "2d6" } });
    expect(at(11)).toMatchObject({ damage: { expr: "3d6" } });
    expect(at(20)).toMatchObject({ damage: { expr: "4d6", type: "radiant" } });
  });

  it("reads Luminous Bolt's save-and-effects rider as the condition its hit brings: a spell attack, not a save", () => {
    const result = resolveSpellOption(LUMINOUS_BOLT, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "spell-attack",
      name: "Luminous Bolt ᴷ",
      hitBonus: 6,
      damage: { expr: "1d6", type: "radiant" },
      circle: 0,
      spell: 0,
      inflicts: { condition: "blinded", lasts: "end", save: { ability: "con", dc: 14 } },
    });
    expect(result.fidelity.status).toBe("modelled");
  });

  it("uses the first entry of a list-form damage and ignores swapOn (Lunarbolt Waxing)", () => {
    const result = resolveSpellOption(LUNARBOLT_WAXING, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "spell-attack",
      name: "Lunarbolt Waxing ᴷ",
      hitBonus: 6,
      damage: { expr: "1d10", type: "cold" },
      circle: 1,
      spell: 1,
      upcast: {
        2: { expr: "2d10", type: "cold" },
        3: { expr: "2d10", type: "cold" },
      },
    });
  });

  it("uses a plain-number to_hit instead of pb + casting modifier", () => {
    const spell = { ...ICICLE_JAVELIN, roll: { ...ICICLE_JAVELIN.roll, to_hit: 9 } };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ hitBonus: 9 });
  });

  it("falls back to pb + casting modifier when to_hit is not a plain number", () => {
    const spell = { ...ICICLE_JAVELIN, roll: { ...ICICLE_JAVELIN.roll, to_hit: "spell attack" } };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ hitBonus: 6 });
  });

  it("models melee and ranged forms as spell attacks too", () => {
    for (const form of ["melee", "ranged"]) {
      const spell = { ...ICICLE_JAVELIN, roll: { ...ICICLE_JAVELIN.roll, form } };
      expect(resolveSpellOption(spell, NUMBERS, OWNER).action?.kind).toBe("spell-attack");
    }
  });
});

describe("resolveSpellOption: save actions", () => {
  it("models Thunderwave as an area CON save, half on success, DC 8 + pb + casting modifier", () => {
    const result = resolveSpellOption(THUNDERWAVE, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "save",
      name: "Thunderwave",
      dc: 14,
      ability: "con",
      damage: { expr: "2d8", type: "thunder" },
      onSuccess: "half",
      area: true,
      targets: 3,
      circle: 1,
      spell: 1,
      upcast: {
        2: { expr: "3d8", type: "thunder" },
        3: { expr: "4d8", type: "thunder" },
      },
    });
    expect(result.fidelity).toEqual({ name: "Thunderwave", owner: OWNER, status: "modelled" });
  });

  it("models Toxic Plume as an area save with no damage on success", () => {
    const result = resolveSpellOption(TOXIC_PLUME, NUMBERS, OWNER);
    expect(result.action).toMatchObject({
      kind: "save",
      ability: "con",
      damage: { expr: "2d6", type: "poison" },
      onSuccess: "none",
      area: true,
      circle: 1,
    });
  });

  it('models Create Bonfire as a single-target save ("Any creature" is not an area)', () => {
    const result = resolveSpellOption(CREATE_BONFIRE, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "save",
      name: "Create Bonfire ᴰ",
      dc: 14,
      ability: "dex",
      damage: { expr: "1d8", type: "fire" },
      onSuccess: "none",
      area: false,
      circle: 0,
      spell: 0,
    });
  });

  it("applies Create Bonfire's leveled.at override from level 5", () => {
    const result = resolveSpellOption(CREATE_BONFIRE, { ...NUMBERS, characterLevel: 5 }, OWNER);
    expect(result.action).toMatchObject({ damage: { expr: "2d8", type: "fire" } });
  });

  it("flags an area for 'all creatures' and not for a lone 'creature'", () => {
    const all = { ...CREATE_BONFIRE, text: "All creatures in the cube must make a saving throw." };
    expect(resolveSpellOption(all, NUMBERS, OWNER).action).toMatchObject({ area: true });
    const lone = { ...CREATE_BONFIRE, text: "A creature in the area must make a saving throw." };
    expect(resolveSpellOption(lone, NUMBERS, OWNER).action).toMatchObject({ area: false });
  });

  it("reads the area wording from the summary as well as the text", () => {
    const spell = { ...CREATE_BONFIRE, summary: "Each creature in the cube burns.", text: "" };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ area: true });
  });

  it("uses a plain-number save.dc instead of 8 + pb + casting modifier", () => {
    const spell = {
      ...THUNDERWAVE,
      roll: { ...THUNDERWAVE.roll, save: { ...(THUNDERWAVE.roll?.save as object), dc: 17 } },
    };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ dc: 17 });
  });

  it("normalises the save ability from a long name", () => {
    const spell = {
      ...THUNDERWAVE,
      roll: { ...THUNDERWAVE.roll, save: { ability: "Constitution", on_success: "half" } },
    };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ ability: "con", onSuccess: "half" });
  });

  it("does not model a save whose ability cannot be read", () => {
    const spell = { ...THUNDERWAVE, roll: { ...THUNDERWAVE.roll, save: { on_success: "half damage" } } };
    const result = resolveSpellOption(spell, NUMBERS, OWNER);
    expect(result.action).toBeUndefined();
    expect(result.fidelity).toMatchObject({ status: "skipped", reason: "control-spell" });
  });
});

describe("resolveSpellOption: healing", () => {
  it("models Cure Wounds as a heal: dice plus the casting modifier", () => {
    const result = resolveSpellOption(CURE_WOUNDS, NUMBERS, OWNER);
    expect(result.action).toEqual({ kind: "heal", name: "Cure Wounds", expr: "1d8+4", circle: 1, spell: 1 });
    expect(result.fidelity).toEqual({ name: "Cure Wounds", owner: OWNER, status: "modelled" });
  });

  it("leaves a roll that carries its own flat bonus alone", () => {
    const spell = { ...CURE_WOUNDS, roll: { ...CURE_WOUNDS.roll, damage: { roll: "2d4+2", type: "healing" } } };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ expr: "2d4+2" });
  });

  it("writes a negative casting modifier as a subtraction and a zero one as no bonus", () => {
    expect(resolveSpellOption(CURE_WOUNDS, { ...NUMBERS, castingModifier: -1 }, OWNER).action).toMatchObject({
      expr: "1d8-1",
    });
    expect(resolveSpellOption(CURE_WOUNDS, { ...NUMBERS, castingModifier: 0 }, OWNER).action).toMatchObject({
      expr: "1d8",
    });
  });

  it("treats a healing damage type as a heal whatever the form", () => {
    const spell = { ...CURE_WOUNDS, roll: { ...CURE_WOUNDS.roll, form: "spell" } };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ kind: "heal", expr: "1d8+4" });
  });

  it("treats form healing with a non-healing damage type as a heal", () => {
    const spell = { ...CURE_WOUNDS, roll: { ...CURE_WOUNDS.roll, damage: { roll: "1d8", type: "radiant" } } };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action?.kind).toBe("heal");
  });
});

describe("resolveSpellOption: skipped classifications", () => {
  it("models Entangle (save and a condition, no damage) as a save that deals nothing and restrains", () => {
    const result = resolveSpellOption(ENTANGLE, NUMBERS, OWNER);
    expect(result.action).toMatchObject({
      kind: "save",
      ability: "str",
      damage: { expr: "0" },
      inflicts: { condition: "restrained" },
    });
    expect(result.fidelity).toEqual({ name: "Entangle", owner: OWNER, status: "modelled" });
  });

  it("models Sanctuary as a ward on an ally: attackers save first, or lose the attack", () => {
    const result = resolveSpellOption(SANCTUARY, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "buff",
      name: "Sanctuary",
      circle: 1,
      spell: 1,
      on: "allies",
      targets: 1,
      ward: { ability: "wis", dc: 14 },
    });
    expect(result.fidelity).toEqual({ name: "Sanctuary", owner: OWNER, status: "modelled" });
  });

  it("skips an effects-only roll as control-spell", () => {
    const spell = { name: "Fear", roll: { form: "spell", effects: ["frightened"] }, text: "Targets flee." };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).fidelity.reason).toBe("control-spell");
  });

  it("models Bless as a buff: a d4 on the attacks and saves of up to three allies", () => {
    const result = resolveSpellOption(BLESS, NUMBERS, OWNER);
    expect(result.action).toEqual({
      kind: "buff",
      name: "Bless",
      circle: 1,
      spell: 1,
      on: "allies",
      targets: 3,
      attackDie: "+1d4",
      saveDie: "+1d4",
    });
    expect(result.fidelity).toEqual({ name: "Bless", owner: OWNER, status: "modelled" });
  });

  it("models Bane as a debuff on enemies that a save keeps off, and Shield of Faith as +2 AC", () => {
    expect(
      resolveSpellOption(
        {
          name: "Bane",
          circle: 1,
          text: "Up to three creatures of your choice that you can see within range must succeed on a CHA save or become cursed. When a cursed target makes an attack roll or a save before the spell ends, the target must roll a d4 and subtract the number rolled from the attack roll or save.",
        },
        NUMBERS,
        OWNER
      ).action
    ).toMatchObject({
      kind: "buff",
      on: "enemies",
      targets: 3,
      attackDie: "-1d4",
      saveDie: "-1d4",
      save: { ability: "cha", dc: 14 },
    });
    expect(
      resolveSpellOption(
        {
          name: "Shield of Faith",
          circle: 1,
          text: "A shimmering field surrounds a creature, granting it a +2 bonus to AC for the duration.",
        },
        NUMBERS,
        OWNER
      ).action
    ).toMatchObject({ kind: "buff", on: "allies", targets: 1, ac: 2 });
  });

  it("recognises armor class and AC wording as buff", () => {
    expect(
      resolveSpellOption({ name: "Shield", text: "You gain +5 to Armor Class." }, NUMBERS, OWNER).fidelity.reason
    ).toBe("buff");
    expect(resolveSpellOption({ name: "Ward", text: "Your AC rises by 2." }, NUMBERS, OWNER).fidelity.reason).toBe(
      "buff"
    );
  });

  it("skips roll-less spells without combat references (Guidance, Speak with Animals) as utility-spell", () => {
    for (const spell of [GUIDANCE, SPEAK_WITH_ANIMALS]) {
      const result = resolveSpellOption(spell, NUMBERS, OWNER);
      expect(result.action).toBeUndefined();
      expect(result.fidelity).toEqual({
        name: spell.name,
        owner: OWNER,
        status: "skipped",
        reason: "utility-spell",
      });
    }
  });

  it("falls to the text rules for a roll with no damage, save or effects", () => {
    const spell = { name: "Light", roll: { form: "utility", notes: "sheds light" }, text: "An object glows." };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).fidelity.reason).toBe("utility-spell");
  });

  it("does not model a rider form with damage (Zephir Strike shape)", () => {
    const spell = {
      name: "Zephir Strike ᴰ",
      roll: { form: "rider", circle: 1, damage: { roll: "1d8", type: "force" } },
      text: "You can give yourself advantage on one weapon attack roll on your turn.",
    };
    const result = resolveSpellOption(spell, NUMBERS, OWNER);
    expect(result.action).toBeUndefined();
    expect(result.fidelity).toMatchObject({ status: "skipped", reason: "buff" });
  });

  it("only ever reports reasons from the fixed vocabulary", () => {
    for (const spell of [GUIDANCE, SPEAK_WITH_ANIMALS]) {
      const reason = resolveSpellOption(spell, NUMBERS, OWNER).fidelity.reason;
      expect(SKIP_REASONS).toContain(reason);
    }
  });
});

describe("resolveSpellOption: without casting-modifier numbers", () => {
  it("still classifies skipped spells", () => {
    expect(resolveSpellOption(ENTANGLE, undefined, OWNER).needsCastingModifier).toBe(true);
    expect(resolveSpellOption(SANCTUARY, undefined, OWNER).needsCastingModifier).toBe(true);
    expect(resolveSpellOption(BLESS, undefined, OWNER).needsCastingModifier).toBe(true);
    expect(resolveSpellOption(GUIDANCE, undefined, OWNER).fidelity.reason).toBe("utility-spell");
    expect(resolveSpellOption(SPEAK_WITH_ANIMALS, undefined, OWNER).needsCastingModifier).toBeUndefined();
  });

  it("reports needsCastingModifier, with no action, for every modelled form", () => {
    for (const spell of [
      ICICLE_JAVELIN,
      MAGNETOBOLT,
      LUMINOUS_BOLT,
      LUNARBOLT_WAXING,
      THUNDERWAVE,
      CREATE_BONFIRE,
      TOXIC_PLUME,
      CURE_WOUNDS,
    ]) {
      const result = resolveSpellOption(spell, undefined, OWNER);
      expect(result.needsCastingModifier).toBe(true);
      expect(result.action).toBeUndefined();
      expect(result.fidelity).toEqual({ name: spell.name, owner: OWNER, status: "modelled" });
    }
  });
});

describe("resolveSpellOption: circle", () => {
  it("defaults to 0 when neither the input nor the roll carries a circle", () => {
    const spell = { name: "Spark", roll: { form: "spell", damage: { roll: "1d4", type: "fire" } } };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ circle: 0 });
  });

  it("takes the input circle over the roll's", () => {
    const spell = { ...ICICLE_JAVELIN, circle: 2 };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ circle: 2 });
  });

  it("falls back to the roll's circle when the input has none", () => {
    const spell = { ...ICICLE_JAVELIN, circle: undefined };
    expect(resolveSpellOption(spell, NUMBERS, OWNER).action).toMatchObject({ circle: 1 });
  });
});

describe("a heal its text gives", () => {
  it("reads Healing Word as a bonus-action heal with the casting modifier", () => {
    const result = resolveSpellOption(
      {
        name: "Healing Word",
        casting: "1 bonus action",
        circle: 1,
        text: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier.",
      },
      NUMBERS,
      "Jacqui"
    );
    expect(result.action).toEqual({
      kind: "heal",
      name: "Healing Word",
      expr: "1d4+4",
      circle: 1,
      spell: 1,
      bonus: true,
    });
    expect(result.fidelity.status).toBe("modelled");
  });
});

describe("a spell read from its prose", () => {
  const read = (name: string, text: string, extra: Partial<SpellOptionInput> = {}) =>
    resolveSpellOption({ name, text, ...extra }, NUMBERS, "Caster").action;

  it("reads a spell attack and scales a cantrip by level", () => {
    expect(
      read(
        "Fire Bolt",
        "Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.\n\nThis spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
        { circle: 0 }
      )
    ).toEqual({
      kind: "spell-attack",
      name: "Fire Bolt",
      hitBonus: 6,
      damage: { expr: "1d10", type: "fire" },
      circle: 0,
      spell: 0,
    });
    expect(
      resolveSpellOption(
        {
          name: "Fire Bolt",
          circle: 0,
          text: "Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10).",
        },
        { ...NUMBERS, characterLevel: 11 },
        "Caster"
      ).action
    ).toMatchObject({ damage: { expr: "3d10" } });
  });

  it("reads an area save with half damage", () => {
    expect(
      read(
        "Burning Hands",
        "Each creature in a 15-foot cone must make a DEX save. A creature takes 3d6 fire damage on a failed save, or half as much damage on a successful one.",
        { circle: 1 }
      )
    ).toEqual({
      kind: "save",
      name: "Burning Hands",
      dc: 14,
      ability: "dex",
      damage: { expr: "3d6", type: "fire" },
      onSuccess: "half",
      area: true,
      targets: 2,
      circle: 1,
      spell: 1,
    });
  });

  it("reads a save that only hinders, for as long as the spell lasts", () => {
    expect(
      read(
        "Hold",
        "Choose a Humanoid that you can see within range. The target must succeed on a WIS save or be paralyzed for the duration.",
        { circle: 2, duration: "Concentration, up to 1 minute" }
      )
    ).toMatchObject({
      kind: "save",
      ability: "wis",
      damage: { expr: "0" },
      inflicts: { condition: "paralyzed", lasts: "fight" },
    });
  });

  it("takes no debuff die for damage", () => {
    expect(
      read(
        "Bane",
        "Each target must make a CHA save. Whenever a target that fails this save makes an attack roll, it must roll a d4 and subtract the number rolled."
      )
    ).toBeUndefined();
  });
});

describe("spell reach and concentration", () => {
  it("reads a spell's range as its reach", () => {
    expect(spellReach("60 feet")).toEqual({ range: 60 });
    expect(spellReach("Touch")).toEqual({ melee: 5 });
    expect(spellReach("Self (15-foot cone)")).toEqual({ range: 15 });
    expect(spellReach("Self")).toBeUndefined();
    expect(spellReach("Self", "Each creature in a 15-foot cone must make a CON save.")).toEqual({ range: 15 });
    expect(spellReach(undefined)).toBeUndefined();
  });

  it("marks a concentration spell's action, and gives it the spell's reach", () => {
    const hold = resolveSpellOption(
      {
        name: "Hold Person",
        circle: 2,
        range: "60 feet",
        duration: "Concentration, up to 1 minute",
        text: "Choose a Humanoid that you can see within range. The target must succeed on a WIS save or be paralyzed for the duration.",
      },
      { proficiencyBonus: 2, castingModifier: 3, characterLevel: 3 },
      "Caster"
    );
    expect(hold.action).toMatchObject({ kind: "save", reach: { range: 60 }, concentration: true });
  });
});

describe("Haste, Slow and reaction spells", () => {
  const HASTE =
    "Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC, it has advantage on DEX saves, and it gains an additional action on each of its turns. That action can be used only to take the Attack (one weapon attack only), Dash, Disengage, Hide, or Use an Object action. When the spell ends, the target can't move or take actions until after its next turn, as a wave of lethargy sweeps over it.";
  const SLOW =
    "You alter time around up to six creatures of your choice in a 40-foot cube within range. Each target must succeed on a WIS save or be affected by this spell for the duration. An affected target's speed is halved, it takes a −2 penalty to AC and DEX saves, and it can't use reactions. On its turn, it can use either an action or a bonus action, not both. It can't make more than one melee or ranged attack during its turn. A creature affected by this spell makes another WIS save at the end of its turn, ending the effect on itself on a success.";

  it("reads Haste and Slow as buffs of what they do", () => {
    const haste = resolveSpellOption(
      { name: "Haste", circle: 3, text: HASTE, duration: "Concentration, up to 1 minute" },
      NUMBERS,
      OWNER
    );
    expect(haste.action).toMatchObject({
      kind: "buff",
      on: "allies",
      targets: 1,
      ac: 2,
      speedFactor: 2,
      dexAdvantage: true,
      extraAttack: true,
      lethargy: true,
      concentration: true,
    });
    const slow = resolveSpellOption(
      { name: "Slow", circle: 3, text: SLOW, duration: "Concentration, up to 1 minute" },
      NUMBERS,
      OWNER
    );
    expect(slow.action).toMatchObject({
      kind: "buff",
      on: "enemies",
      targets: 6,
      ac: -2,
      dexSave: -2,
      speedFactor: 0.5,
      noReactions: true,
      oneAttack: true,
      repeatSave: true,
      save: { ability: "wis" },
    });
  });

  it("reads Hellish Rebuke and Counterspell as reactions", () => {
    const rebuke = spellReactionOf(
      {
        name: "Hellish Rebuke",
        circle: 1,
        casting: "1 reaction, when damaged by a creature within 60 feet of you that you can see",
        text: "The creature must make a DEX save. It takes 2d10 fire damage on a failed save, or half as much damage on a successful one.",
      },
      NUMBERS
    );
    expect(rebuke).toMatchObject({
      kind: "retaliate",
      circle: 1,
      within: 60,
      save: { ability: "dex", dc: 14 },
      onSuccess: "half",
      damage: { expr: "2d10", type: "fire" },
    });
    const counter = spellReactionOf(
      {
        name: "Counterspell",
        circle: 3,
        casting: "1 reaction, when you see a creature within 60 feet of you casting a spell",
        text: "",
      },
      NUMBERS
    );
    expect(counter).toEqual({ kind: "counterspell", name: "Counterspell", circle: 3, upTo: 3, within: 60 });
    expect(spellReactionOf({ name: "Fire Bolt", circle: 0, casting: "1 action", text: "" }, NUMBERS)).toBeUndefined();
  });
});
