import { describe, expect, it } from "vitest";
import {
  appliesOf,
  choicesOf,
  evaluateFormula,
  parseMonsterTemplate,
  templateFeaturesNote,
  templateFits,
  templateNouns,
  type FormulaContext,
} from "./monster-template";

const tab = (name: string, body: string) =>
  ["```rpg rule.tab", `name: ${name}`, "icon: bookmark", "---", `## ${name}`, body, "```"].join("\n");

const ZOMBIE = [
  "---",
  "source: test",
  "---",
  "# Zombie",
  "Zombies are the animated corpses of deceased creatures.",
  "",
  "This template can be applied to any Aberration, Beast, Giant, Humanoid, or Monstrosity with a physical form. When a creature becomes a zombie, it retains its statistics, except as described here. The creature loses all traits and actions that assume it has a living body, such as Amphibious.",
  tab(
    "Statistics",
    [
      "Make the following adjustments to the creature’s statistics.",
      "",
      "**Type.** The creature’s type changes to Undead.",
      "",
      "**Hit Points.** The creature’s hit points are reduced by 10 percent (rounded up).",
    ].join("\n")
  ),
  tab(
    "Traits",
    [
      "The creature gains the following traits.",
      "",
      "***Undead Fortitude.*** If damage reduces the zombie to 0 HP, it must make a CON save.",
      "",
      "***Overdrive ([55 percent of HP maximum] HP or Fewer).*** The zombie rages until its HP is higher than [55 percent of its HP maximum].",
    ].join("\n")
  ),
  tab(
    "Bonus Actions",
    [
      "The creature gains the following bonus action.",
      "",
      "***Groan.*** The zombie groans at one creature it can see.",
      "",
      "The target must succeed on a DC # [10 + the creature’s CON modifier or matches the save DC of the creature’s other features, whichever is higher] WIS save or be frightened.",
    ].join("\n")
  ),
  tab(
    "Actions",
    [
      "***Bite.*** If the zombie dealt any damage type in addition to piercing with its Bite attack, that damage type changes to necrotic.",
      "",
      "When the zombie deals damage, it can choose for any amount of that damage to be necrotic.",
    ].join("\n")
  ),
  tab("Example Monster: Owlbear Zombie", "### Bonus Actions\n***Rend.*** Not the template's."),
  "",
].join("\n");

describe("parseMonsterTemplate", () => {
  const t = parseMonsterTemplate("Zombie", ZOMBIE);

  it("reads what it applies to, its statistics and what the creature loses", () => {
    expect(t.appliesTo.types).toEqual(["aberration", "beast", "giant", "humanoid", "monstrosity"]);
    expect(t.appliesTo.other).toEqual(["with a physical form"]);
    expect(t.stats.map((s) => s.label)).toEqual(["Type", "Hit Points"]);
    expect(t.stats[0].text).toBe("The creature's type changes to Undead.");
    expect(t.losesText).toMatch(/living body/);
  });

  it("reads the features, its formulas as parameters and its own name as the creature's", () => {
    expect(t.features.map((f) => [f.type, f.key])).toEqual([
      ["trait", "Undead Fortitude"],
      ["trait", "Overdrive"],
      ["bonus", "Groan"],
      ["action", "Bite"],
    ]);
    const overdrive = t.features[1];
    expect(overdrive.name).toBe("Overdrive ({{f1}} HP or Fewer)");
    expect(overdrive.formulas).toEqual({ f1: "55 percent of HP maximum", f2: "55 percent of its HP maximum" });
    expect(overdrive.text).toBe("The {{ self.name() }} rages until its HP is higher than {{f2}}.");
    // A paragraph that goes on ("The target must…") stays with its feature.
    expect(t.features[2].text).toMatch(
      /at one creature it can see\.\n\nThe target must succeed on a DC \{\{f1\}\} WIS/
    );
    expect(t.features[3].alters).toBe(true);
    // The example monster's statblock is not the template's.
    expect(t.features.some((f) => f.key === "Rend")).toBe(false);
    expect(t.rules).toEqual([
      "When the zombie deals damage, it can choose for any amount of that damage to be necrotic.",
    ]);
  });

  it("reads a note written with headings and list items to choose from", () => {
    const note = [
      "# Caller",
      "This template can be applied to any Humanoid that has an INT of −2 or higher and that has a CR of 1 or higher.",
      "### Traits",
      "*Manifestation.* The caller gains two of the following traits:",
      "- **Stench.** A creature within 10 feet of the caller must succeed on a DC # [10 + the creature’s CON modifier] CON save.",
      "- **Spider Climb.** The caller can climb difficult surfaces.",
      "",
      "*Resilience.* The caller is resistant to cold damage.",
    ].join("\n");
    const c = parseMonsterTemplate("Caller", note);
    expect(c.appliesTo).toMatchObject({ types: ["humanoid"], minInt: -2, minCr: 1 });
    expect(c.features.map((f) => [f.key, f.optional ?? false])).toEqual([
      ["Stench", true],
      ["Spider Climb", true],
      ["Resilience", false],
    ]);
    expect(c.rules[0]).toMatch(/gains two of the following/);
  });

  it("knows which choice gives a feature, from the rules that say so", () => {
    const note = [
      "# Champion",
      "This template can be applied to any Beast.",
      "## Statistics",
      "Pick a season and one type of damage associated with it: spring (poison or thunder), summer (fire or lightning).",
      "## Traits",
      "All champions gain Camouflage and one other trait based on the chosen season: Woodland Walk (spring).",
      "",
      "***Camouflage.*** The champion hides.",
      "",
      "***Woodland Walk.*** The champion walks.",
      "## Reactions",
      "Summer champions gain the Summer's Excitement reaction.",
      "",
      "***Summer's Excitement.*** The champion moves.",
    ].join("\n");
    const c = parseMonsterTemplate("Champion", note);
    expect(c.choices).toEqual([
      { key: "spring", damage: ["poison", "thunder"] },
      { key: "summer", damage: ["fire", "lightning"] },
    ]);
    expect(c.features.map((f) => [f.key, f.choice ?? null])).toEqual([
      ["Camouflage", null],
      ["Woodland Walk", "spring"],
      ["Summer's Excitement", "summer"],
    ]);
  });
});

describe("template terms", () => {
  it("reads true dragons, sizes and CR bounds", () => {
    expect(appliesOf("This template can be applied to any legendary (adult or ancient) true dragon.")).toMatchObject({
      types: ["dragon"],
      trueDragon: true,
      ages: ["adult", "ancient"],
    });
    expect(
      appliesOf("This template can be applied only to Small or smaller Beasts with a CR no higher than 1.")
    ).toMatchObject({ types: ["beast"], maxSize: "small", maxCr: 1 });
    expect(
      appliesOf("This template can be applied to any creature, except for a creature native to the Void.")
    ).toMatchObject({
      types: [],
      other: ["except for a creature native to the void"],
    });
  });

  it('keeps a condition after "but" whole', () => {
    expect(
      appliesOf(
        "This template can be applied to any creature, but a leader must be able to communicate with its allies."
      )
    ).toMatchObject({ types: [], other: ["a leader must be able to communicate with its allies"] });
  });

  it("checks a creature against them", () => {
    const dragon = appliesOf("This template can be applied to any ancient true dragon.");
    expect(templateFits(dragon, { name: "Ancient Red Dragon", type: "Gargantuan Dragon", cr: 24, int: 4 }).fits).toBe(
      true
    );
    expect(templateFits(dragon, { name: "Young Red Dragon", type: "Large Dragon", cr: 10, int: 2 }).unmet).toEqual([
      "an ancient dragon",
    ]);
    const small = appliesOf("This template can be applied only to Small or smaller Beasts with a CR no higher than 1.");
    expect(templateFits(small, { name: "Raven", type: "Tiny [[Beast]]", cr: 0, int: -4 }).fits).toBe(true);
    expect(templateFits(small, { name: "Bear", type: "Large Beast", cr: 2, int: -4 }).unmet).toEqual([
      "CR 1 or lower",
      "small or smaller",
    ]);
  });

  it("reads choices and the nouns a template calls the creature by", () => {
    expect(choicesOf("Choose the source: tainted nature magic (poison), Void magic (necrotic).")).toEqual([
      { key: "tainted nature magic", damage: ["poison"] },
      { key: "void magic", damage: ["necrotic"] },
    ]);
    const nouns = templateNouns("Skeleton (Dragon)");
    expect(nouns[0]).toBe("dragon skeleton");
    expect([...nouns].sort()).toEqual(["creature", "dragon", "dragon skeleton", "skeleton"]);
  });
});

describe("evaluateFormula", () => {
  const ctx: FormulaContext = {
    cr: 9,
    pb: 4,
    hp: 120,
    abilities: { con: 3, int: 1, wis: 2, cha: -1 },
    dcs: [14, 16],
    dcOf: (w) => (w === "breath" ? 17 : undefined),
    perception: 13,
  };
  it("works out the book's formulas", () => {
    const f = (s: string) => evaluateFormula(s, ctx);
    expect(
      f("10 + the creature's CON modifier or matches the save DC of the creature's other features, whichever is higher")
    ).toBe(16);
    expect(f("10 + the cultist's CON modifier")).toBe(13);
    expect(f("55 percent of HP maximum")).toBe(66);
    expect(f("half the dragon's CR, rounded down")).toBe(4);
    expect(f("40 percent of the dragon lich's CR, rounded up")).toBe(4);
    expect(f("base + 5")).toBe(18);
    expect(f("base − 5")).toBe(8);
    expect(f("PB + the creature's INT or WIS, whichever is higher")).toBe(6);
    expect(f("PB + the creature's CHA modifier")).toBe(3);
    expect(f("same as the dragon's normal breath weapon save DC")).toBe(17);
    expect(f("the same DC as its Frightful Presence or similar feature")).toBe(16);
    expect(f("creature's PB")).toBe(4);
    expect(f("Size")).toBeUndefined();
    expect(f("a number of d4s equal to one half the leader's CR, rounded down, minimum of 1")).toBe("10 (4d4)");
    expect(f("damage of the attack's type")).toBe("damage of the attack's type");
    expect(f("a number of d6s equal to the creature's PB")).toBe("14 (4d6)");
    expect(f("a number of d8s equal to half the creature's PB, rounded up")).toBe("9 (2d8)");
    expect(f("the creature's CR times 5, minimum of 5")).toBe(45);
    expect(evaluateFormula("half the damage of its own breath weapon", { ...ctx, diceOf: () => "18d10" })).toBe(
      "49 (9d10)"
    );
  });
});

describe("templateFeaturesNote", () => {
  it("writes each feature the template gives as a feature.details block, its formulas as tiers", () => {
    const note = templateFeaturesNote([parseMonsterTemplate("Zombie", ZOMBIE)], "test");
    expect(note).toContain(
      '## Zombie\n```rpg feature.details\nname: "Undead Fortitude"\nid: "Zombie: Undead Fortitude"\ntype: trait'
    );
    expect(note).toContain('id: "Zombie: Overdrive"');
    expect(note).toContain(
      'tiers:\n  default: { f1: "[55 percent of HP maximum]", f2: "[55 percent of its HP maximum]" }'
    );
    // A feature it changes is not one it gives.
    expect(note).not.toContain("Zombie: Bite");
  });
});
