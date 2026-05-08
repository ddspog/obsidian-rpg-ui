import { describe, it, expect } from "vitest";
import { resolveFeatures, normalizeTraitValue } from "./resolver";
import type { CompendiumLib, SourceDoc } from "./types";

// ─── Hand-rolled fixtures (new shape: text + traits) ────────────────────────

const cleric: SourceDoc = {
  name: "Cleric",
  kind: "class",
  meta: { hit_die: "d8" },
  details: [
    {
      name: "Hit Points",
      level: 1,
      traits: { "Hit Dice": "+8 +CON mod" },
    },
    {
      name: "Armor Proficiency",
      level: 1,
      traits: { "Armor Proficiency": "Light Armor, Medium Armor, Shields" },
    },
    { name: "Spellcasting", type: "passive", level: 1, text: "Divine power conduit." },
    {
      name: "Skill Proficiencies",
      level: 1,
      pick: 2,
      text: "Pick two skills from the cleric list.",
    },
    { name: "Divine Order", level: 1, pick: 1, text: "Pick a divine path." },
    {
      name: "Channel Divinity",
      type: "free_action",
      level: 2,
      uses: 1,
      text: "Channel deity's energy.",
      traits: { "Channel Divinity": "1/short rest" },
    },
    { name: "Way of the Mountain", level: 5, text: "A high-level feature." },
  ],
  options: [
    { parent: "Skill Proficiencies", name: "History", traits: { "Skill Proficiency": "+History" } },
    { parent: "Skill Proficiencies", name: "Insight", traits: { "Skill Proficiency": "+Insight" } },
    { parent: "Skill Proficiencies", name: "Medicine", traits: { "Skill Proficiency": "+Medicine" } },
    { parent: "Skill Proficiencies", name: "Religion", traits: { "Skill Proficiency": "+Religion" } },
    {
      parent: "Divine Order",
      name: "Protector",
      text: "Heavy armor and martial weapons.",
      traits: { "Armor Proficiency": "+Heavy Armor" },
      features: [
        {
          name: "Manifestation of Faith",
          type: "passive",
          text: "Faith made flesh.",
        },
      ],
    },
    {
      parent: "Divine Order",
      name: "Thaumaturge",
      text: "Extra cantrip.",
      features: [{ name: "Extra Cantrip", type: "passive" }],
    },
  ],
  unlocks: [{ kind: "subclass", level: 3 }],
  tables: [],
};

const lifeDomain: SourceDoc = {
  name: "Life Domain",
  kind: "subclass",
  meta: {},
  parent_class: "Cleric",
  details: [
    {
      name: "Disciple of Life",
      type: "passive",
      level: 3,
      text: "Heal more.",
      traits: { "Healing Bonus": "+2 + spell circle" },
    },
  ],
  options: [],
  unlocks: [],
  tables: [],
};

const human: SourceDoc = {
  name: "Human",
  kind: "lineage",
  meta: { size: "medium", speed: 30 },
  details: [
    { name: "Speed", traits: { Speed: "30 ft." } },
    { name: "Skill Versatility", pick: 1, text: "Choose one extra skill." },
  ],
  options: [
    { parent: "Skill Versatility", name: "Acrobatics", traits: { "Skill Proficiency": "+Acrobatics" } },
    { parent: "Skill Versatility", name: "Stealth", traits: { "Skill Proficiency": "+Stealth" } },
  ],
  unlocks: [],
  tables: [],
};

const greatHouse: SourceDoc = {
  name: "Great House",
  kind: "heritage",
  meta: {},
  details: [{ name: "Noble Connections", type: "passive", text: "You know nobles." }],
  options: [],
  unlocks: [],
  tables: [],
};

const fighter: SourceDoc = {
  name: "Fighter",
  kind: "class",
  meta: {},
  details: [
    {
      name: "Armor Proficiency",
      level: 1,
      traits: { "Armor Proficiency": "Light, Medium, Heavy, Shields" },
    },
    { name: "Fighting Style", level: 1, pick: 1, text: "Choose a combat specialization." },
    {
      name: "Hit Points",
      level: 1,
      traits: { "Hit Dice": "+10 +CON mod" },
    },
  ],
  options: [
    {
      parent: "Fighting Style",
      name: "Defense",
      text: "+1 AC while wearing armor.",
      traits: { AC: "+1 (while wearing armor)" },
    },
    {
      parent: "Fighting Style",
      name: "Dueling",
      text: "+2 damage one-handed.",
      traits: { Damage: "+2 one-handed melee" },
    },
  ],
  unlocks: [{ kind: "subclass", level: 3 }],
  tables: [],
};

const lib: CompendiumLib = {
  classes: { Cleric: cleric, Fighter: fighter },
  subclasses: { "Life Domain": lifeDomain },
  lineages: { Human: human },
  heritages: { "Great House": greatHouse },
  backgrounds: {},
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveFeatures", () => {
  it("resolves details up to the declared level only", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 3 }],
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    const c = view.sources.find((s) => s.source === "Cleric")!;
    const featNames = c.features.map((f) => f.name);
    expect(featNames).toContain("Spellcasting");
    expect(featNames).toContain("Channel Divinity");
    expect(featNames).not.toContain("Way of the Mountain");
  });

  it("aggregates traits across features into the top-level view.traits map", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 3 }],
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    expect(view.traits["Hit Dice"]).toEqual(["+8 +CON mod"]);
    expect(view.traits["Channel Divinity"]).toEqual(["1/short rest"]);
    // Skill picks contribute their own trait values
    expect(view.traits["Skill Proficiency"]).toEqual(["+Medicine", "+Insight"]);
    // Picked rich option contributes its traits
    expect(view.traits["Armor Proficiency"]).toEqual([
      "Light Armor, Medium Armor, Shields",
      "+Heavy Armor",
    ]);
  });

  it("applies a single picked option (Skill Proficiencies pick: 2)", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        choices: { Cleric: { "Skill Proficiencies": ["Medicine", "Insight"] } },
      },
      lib,
    );
    const c = view.sources.find((s) => s.source === "Cleric")!;
    // Two skill traits aggregated globally
    expect(view.traits["Skill Proficiency"]).toEqual(["+Medicine", "+Insight"]);
    // No pending choice for skills
    expect(c.pendingChoices.find((p) => p.feature.name === "Skill Proficiencies")).toBeUndefined();
  });

  it("applies a complex picked option with nested features (Divine Order: Protector)", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    expect(view.traits["Armor Proficiency"]).toContain("+Heavy Armor");
    const c = view.sources.find((s) => s.source === "Cleric")!;
    expect(c.features.map((f) => f.name)).toContain("Manifestation of Faith");
  });

  it("surfaces unresolved details in pendingChoices with the right remaining count", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        choices: { Cleric: { "Skill Proficiencies": ["Medicine"] } }, // only 1 of 2 picked
      },
      lib,
    );
    const c = view.sources.find((s) => s.source === "Cleric")!;
    const skills = c.pendingChoices.find((p) => p.feature.name === "Skill Proficiencies")!;
    expect(skills.remaining).toBe(1);
    expect(skills.picked).toEqual(["Medicine"]);
    expect(skills.options.length).toBe(4);
    expect(view.pendingChoices).toContain(skills);
  });

  it("nests subclass under the class once the unlock level is met", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 3, subclass: "Life Domain" }],
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    const sources = view.sources.map((s) => s.source);
    expect(sources).toContain("Life Domain");
    const subclass = view.sources.find((s) => s.source === "Life Domain")!;
    expect(subclass.kind).toBe("subclass");
    expect(subclass.features.map((f) => f.name)).toContain("Disciple of Life");
    // Subclass traits aggregated too
    expect(view.traits["Healing Bonus"]).toEqual(["+2 + spell circle"]);
  });

  it("does not include subclass before its unlock level", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1, subclass: "Life Domain" }],
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    const sources = view.sources.map((s) => s.source);
    expect(sources).not.toContain("Life Domain");
  });

  it("handles missing lineage/heritage/background gracefully", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        lineage: "Nonexistent",
        heritage: undefined,
        background: undefined,
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    expect(view.sources.find((s) => s.source === "Nonexistent")).toBeUndefined();
    // The class still resolves
    expect(view.sources.find((s) => s.source === "Cleric")).toBeDefined();
  });

  it("appends lineage and heritage sources after the class", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        lineage: "Human",
        heritage: "Great House",
        choices: {
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
          Human: { "Skill Versatility": ["Stealth"] },
        },
      },
      lib,
    );
    const sources = view.sources.map((s) => s.source);
    expect(sources).toEqual(["Cleric", "Human", "Great House"]);
    // Human's trait contribution is in the global traits map
    expect(view.traits["Skill Proficiency"]).toContain("+Stealth");
  });

  it("multiclass: combines two class entries and aggregates their traits", () => {
    const view = resolveFeatures(
      {
        classes: [
          { name: "Fighter", level: 2 },
          { name: "Cleric", level: 1 },
        ],
        choices: {
          Fighter: { "Fighting Style": "Defense" },
          Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" },
        },
      },
      lib,
    );
    const sources = view.sources.map((s) => s.source);
    expect(sources).toEqual(["Fighter", "Cleric"]);

    // Hit Dice aggregated from both classes (Fighter +10, Cleric +8)
    expect(view.traits["Hit Dice"]).toEqual(["+10 +CON mod", "+8 +CON mod"]);
    // Defense pick contributes AC trait
    expect(view.traits["AC"]).toEqual(["+1 (while wearing armor)"]);
  });

  it("flat pendingChoices aggregates pendings from every source", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        lineage: "Human",
        // No choices at all → both Cleric and Human have unresolved picks
      },
      lib,
    );
    const featureNames = view.pendingChoices.map((p) => p.feature.name);
    expect(featureNames).toContain("Skill Proficiencies");
    expect(featureNames).toContain("Divine Order");
    expect(featureNames).toContain("Skill Versatility");
  });

  it("skips classes/lineages that don't exist in the compendium", () => {
    const view = resolveFeatures(
      { classes: [{ name: "Bard", level: 1 }], lineage: "Tiefling" },
      lib,
    );
    expect(view.sources).toEqual([]);
  });
});

// ─── normalizeTraitValue ─────────────────────────────────────────────────────

describe("normalizeTraitValue", () => {
  it("returns plain strings as a single-element array", () => {
    expect(normalizeTraitValue("+8 +CON mod")).toEqual(["+8 +CON mod"]);
  });

  it("flattens an array of plain strings", () => {
    expect(normalizeTraitValue(["WIS", "CHA"])).toEqual(["WIS", "CHA"]);
  });

  it("reconstructs unquoted [[wikilink]] (parsed as nested arrays)", () => {
    // YAML `[[Heavy Armor]]` parses as [["Heavy Armor"]]
    expect(normalizeTraitValue([["Heavy Armor"]])).toEqual(["[[Heavy Armor]]"]);
  });

  it("walks a list of unquoted wikilinks element-by-element", () => {
    // YAML
    //   - [[Light Armor]]
    //   - [[Medium Armor]]
    // parses as [[["Light Armor"]], [["Medium Armor"]]]
    const parsed = [[["Light Armor"]], [["Medium Armor"]], [["Shields"]]];
    expect(normalizeTraitValue(parsed)).toEqual([
      "[[Light Armor]]",
      "[[Medium Armor]]",
      "[[Shields]]",
    ]);
  });

  it("returns empty array for null/undefined/objects", () => {
    expect(normalizeTraitValue(null)).toEqual([]);
    expect(normalizeTraitValue(undefined)).toEqual([]);
    expect(normalizeTraitValue({ unexpected: "shape" })).toEqual([]);
  });
});

// ─── choose spec (inline pick → trait category) ──────────────────────────────

describe("resolveFeatures: inline `choose` spec", () => {
  const proficiencies: SourceDoc = {
    name: "Proficiencies",
    kind: "class",
    meta: {},
    details: [
      {
        name: "Skills",
        traits: { "Save P.": ["WIS", "CHA"] },
        choose: {
          type: "traits",
          category: "Skill P.",
          number: 2,
          options: ["[[History]]", "[[Insight]]", "[[Medicine]]", "[[Religion]]"],
        },
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };
  const profLib: CompendiumLib = {
    classes: { Proficiencies: proficiencies },
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: {},
  };

  it("aggregates fixed traits and surfaces the choose pick as pending when unset", () => {
    const view = resolveFeatures(
      { classes: [{ name: "Proficiencies", level: 1 }] },
      profLib,
    );
    // Fixed Save P. trait still aggregates
    expect(view.traits["Save P."]).toEqual(["WIS", "CHA"]);
    // Skill P. has no values yet
    expect(view.traits["Skill P."]).toBeUndefined();
    // Pending: 2 picks for the Skills feature
    const pending = view.pendingChoices.find((p) => p.feature.name === "Skills");
    expect(pending?.remaining).toBe(2);
    // The synthetic options carry the wikilink-wrapped option strings
    expect(pending?.options.map((o) => o.name)).toEqual([
      "[[History]]",
      "[[Insight]]",
      "[[Medicine]]",
      "[[Religion]]",
    ]);
  });

  it("collects picked choose values into the named trait category", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Proficiencies", level: 1 }],
        choices: { Proficiencies: { Skills: ["[[Medicine]]", "[[Insight]]"] } },
      },
      profLib,
    );
    expect(view.traits["Skill P."]).toEqual(["[[Medicine]]", "[[Insight]]"]);
    // Picks fully satisfied → no pending
    expect(view.pendingChoices.find((p) => p.feature.name === "Skills")).toBeUndefined();
  });

  it("partial picks leave the right `remaining` count", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Proficiencies", level: 1 }],
        choices: { Proficiencies: { Skills: ["[[Medicine]]"] } },
      },
      profLib,
    );
    const pending = view.pendingChoices.find((p) => p.feature.name === "Skills")!;
    expect(pending.remaining).toBe(1);
    expect(pending.picked).toEqual(["[[Medicine]]"]);
    expect(view.traits["Skill P."]).toEqual(["[[Medicine]]"]);
  });
});

// ─── array-form choose (multiple independent picks per block) ────────────────

describe("resolveFeatures: array-form `choose` spec", () => {
  const adherent: SourceDoc = {
    name: "Adherent",
    kind: "background",
    meta: {},
    details: [
      {
        name: "Proficiencies",
        traits: { Tools: "[[Artist Tools]]" },
        choose: [
          {
            type: "traits",
            category: "Skill P.",
            number: 2,
            options: ["[[History]]", "[[Investigation]]", "[[Religion]]"],
          },
          {
            type: "traits",
            category: "Tools",
            number: 1,
            options: ["[[Smith's Tools]]", "[[Thieves' Tools]]"],
          },
        ],
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };
  const lib: CompendiumLib = {
    classes: {},
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: { Adherent: adherent },
  };

  it("surfaces one pending choice per spec with distinct composite keys", () => {
    const view = resolveFeatures({ classes: [], background: "Adherent" }, lib);
    const skill = view.pendingChoices.find(
      (p) => p.feature.name === "Proficiencies:Skill P.",
    );
    const tool = view.pendingChoices.find(
      (p) => p.feature.name === "Proficiencies:Tools",
    );
    expect(skill?.remaining).toBe(2);
    expect(tool?.remaining).toBe(1);
    // Each synthetic feature carries its own single-spec choose so the UI
    // can read the category straight off it.
    expect(Array.isArray(skill?.feature.choose)).toBe(false);
    expect((skill?.feature.choose as { category: string }).category).toBe("Skill P.");
    // Fixed trait from the same block still aggregates independently.
    expect(view.traits["Tools"]).toEqual(["[[Artist Tools]]"]);
  });

  it("records picks separately under each spec's composite key", () => {
    const view = resolveFeatures(
      {
        classes: [],
        background: "Adherent",
        choices: {
          Adherent: {
            "Proficiencies:Skill P.": ["[[History]]", "[[Religion]]"],
            "Proficiencies:Tools": "[[Smith's Tools]]",
          },
        },
      },
      lib,
    );
    expect(view.traits["Skill P."]).toEqual(["[[History]]", "[[Religion]]"]);
    expect(view.traits["Tools"]).toEqual(["[[Artist Tools]]", "[[Smith's Tools]]"]);
    expect(view.pendingChoices).toHaveLength(0);
  });
});

// ─── asi choose type (ability score improvement, duplicates allowed) ─────────

describe("resolveFeatures: `asi` choose type", () => {
  const asiClass: SourceDoc = {
    name: "Fighter",
    kind: "class",
    meta: {},
    details: [
      {
        name: "Improvement",
        pick: 1,
      },
    ],
    options: [
      {
        parent: "Improvement",
        name: "Ability Score Boost",
        choose: {
          type: "asi",
          number: 1,
          quantity: 2,
          options: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
        },
      },
      {
        parent: "Improvement",
        name: "Balanced Growth",
        choose: {
          type: "asi",
          number: 3,
          quantity: 1,
          options: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
        },
      },
    ],
    unlocks: [],
    tables: [],
  };
  const lib: CompendiumLib = {
    classes: { Fighter: asiClass },
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: {},
  };

  it("surfaces a pending sub-choice once the parent option is picked", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Fighter", level: 4 }],
        choices: { Fighter: { Improvement: "Ability Score Boost" } },
      },
      lib,
    );
    const pending = view.pendingChoices.find((p) => p.feature.name === "Ability Score Boost");
    expect(pending?.remaining).toBe(1);
    // The sub-choice exposes the `asi` spec so the UI can render the counter.
    expect((pending?.feature.choose as { type: string }).type).toBe("asi");
  });

  it("accepts duplicate picks and formats each as `+{quantity} Attribute`", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Fighter", level: 4 }],
        choices: {
          Fighter: {
            Improvement: "Balanced Growth",
            // User picked Wisdom twice and Charisma once → total 3 picks.
            "Balanced Growth": ["Wisdom", "Wisdom", "Charisma"],
          },
        },
      },
      lib,
    );
    // All picks consumed — no more pending.
    expect(view.pendingChoices.find((p) => p.feature.name === "Balanced Growth")).toBeUndefined();
    // Ability Scores trait bucket holds each pick as a formatted entry.
    expect(view.traits["Ability Scores"]).toEqual(["+1 Wisdom", "+1 Wisdom", "+1 Charisma"]);
  });

  it("partial duplicate picks leave the right remaining count", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Fighter", level: 4 }],
        choices: {
          Fighter: {
            Improvement: "Balanced Growth",
            "Balanced Growth": ["Wisdom"],
          },
        },
      },
      lib,
    );
    const pending = view.pendingChoices.find((p) => p.feature.name === "Balanced Growth")!;
    expect(pending.remaining).toBe(2);
    expect(pending.picked).toEqual(["Wisdom"]);
    expect(view.traits["Ability Scores"]).toEqual(["+1 Wisdom"]);
  });

  it("defaults asi options to the six core attributes when omitted", () => {
    const doc: SourceDoc = {
      name: "Feat",
      kind: "class",
      meta: {},
      details: [
        {
          name: "Score Boost",
          choose: { type: "asi", number: 1, quantity: 2 },
        },
      ],
      options: [],
      unlocks: [],
      tables: [],
    };
    const libWithFeat: CompendiumLib = {
      classes: { Feat: doc },
      subclasses: {},
      lineages: {},
      heritages: {},
      backgrounds: {},
    };
    const view = resolveFeatures({ classes: [{ name: "Feat", level: 1 }] }, libWithFeat);
    const pending = view.pendingChoices.find((p) => p.feature.name === "Score Boost")!;
    expect(pending.options.map((o) => o.name)).toEqual([
      "Strength",
      "Dexterity",
      "Constitution",
      "Intelligence",
      "Wisdom",
      "Charisma",
    ]);
  });
});

// ─── Spellcasting pool auto-derivation ───────────────────────────────────────

describe("resolveFeatures: spellcasting pool auto-derivation", () => {
  const divineCleric: SourceDoc = {
    name: "Cleric",
    kind: "class",
    meta: {},
    details: [
      {
        name: "Spellcasting",
        level: 1,
        spellcasting: {
          ability: "WIS",
          type: "prepared",
          tier: "full",
          pool: "[[Divine]]",
        },
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };

  const clericWithOverrides: SourceDoc = {
    ...divineCleric,
    name: "ClericOverrides",
    details: [
      {
        name: "Spellcasting",
        level: 1,
        spellcasting: {
          ability: "WIS",
          type: "prepared",
          tier: "full",
          pool: "[[Divine]]",
          cantrip_pool: "@worldbuilding/spells/cantrips",
          ritual_pool: "[[Custom-Ritual-Tag]]",
        },
      },
    ],
  };

  const lib: CompendiumLib = {
    classes: { Cleric: divineCleric, ClericOverrides: clericWithOverrides },
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: {},
  };

  it("derives `[[Magic-Cantrip]]` and `[[Magic-Ritual]]` from pool when omitted", () => {
    const view = resolveFeatures(
      { classes: [{ name: "Cleric", level: 5 }] },
      lib,
    );
    expect(view.casters).toHaveLength(1);
    const caster = view.casters[0];
    expect(caster.pool).toBe("[[Divine]]");
    expect(caster.cantrip_pool).toBe("[[Divine-Cantrip]]");
    expect(caster.ritual_pool).toBe("[[Divine-Ritual]]");
  });

  it("preserves explicit cantrip_pool / ritual_pool overrides", () => {
    const view = resolveFeatures(
      { classes: [{ name: "ClericOverrides", level: 5 }] },
      lib,
    );
    const caster = view.casters[0];
    expect(caster.cantrip_pool).toBe("@worldbuilding/spells/cantrips");
    expect(caster.ritual_pool).toBe("[[Custom-Ritual-Tag]]");
  });

  it("strips wikilink path/alias when deriving the magic stem", () => {
    const aliased: SourceDoc = {
      ...divineCleric,
      name: "AliasedCleric",
      details: [
        {
          name: "Spellcasting",
          level: 1,
          spellcasting: {
            ability: "WIS",
            type: "prepared",
            tier: "full",
            pool: "[[path/to/Divine|Divine magic]]",
          },
        },
      ],
    };
    const view = resolveFeatures(
      { classes: [{ name: "AliasedCleric", level: 5 }] },
      { ...lib, classes: { ...lib.classes, AliasedCleric: aliased } },
    );
    const caster = view.casters[0];
    expect(caster.cantrip_pool).toBe("[[Divine-Cantrip]]");
    expect(caster.ritual_pool).toBe("[[Divine-Ritual]]");
  });
});

// ─── Per-source aggregation (Phase B) ───────────────────────────────────────

describe("resolveFeatures: per-source caster aggregation", () => {
  const cleric: SourceDoc = {
    name: "Cleric",
    kind: "class",
    meta: {},
    details: [
      {
        name: "Spellcasting",
        level: 1,
        spellcasting: {
          ability: "WIS",
          type: "prepared",
          tier: "full",
          pool: "[[Divine]]",
        },
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };

  const acolyte: SourceDoc = {
    name: "Acolyte",
    kind: "heritage",
    meta: {},
    details: [
      {
        name: "Acolyte Features",
        spellcasting: {
          cantrips: 1,
          pool: "[[Arcane]]",
        },
        choose: [
          {
            type: "traits",
            category: "Languages",
            number: 2,
            options: ["[[Elvish]]", "[[Dwarvish]]", "[[Draconic]]"],
          },
          {
            type: "spellcasting",
            category: "ability",
            number: 1,
            options: ["CHA", "INT", "WIS"],
          },
        ],
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };

  const ritualistTalent: SourceDoc = {
    name: "Ritualist",
    kind: "talent",
    meta: {},
    details: [
      {
        name: "Ritualist",
        spellcasting: { rituals_per_circle: 1 },
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };

  const lib: CompendiumLib = {
    classes: { Cleric: cleric },
    subclasses: {},
    lineages: {},
    heritages: { Acolyte: acolyte },
    backgrounds: {},
    talents: { Ritualist: ritualistTalent },
  };

  it("Acolyte heritage becomes its own caster even without ability/type/tier", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 5 }],
        heritage: "Acolyte",
      },
      lib,
    );
    expect(view.casters).toHaveLength(2);
    const [cl, ac] = view.casters;
    expect(cl.source).toBe("Cleric");
    expect(cl.ability).toBe("WIS");
    expect(cl.tier).toBe("full");
    expect(cl.cantrips).toBe(0); // Acolyte no longer bleeds into Cleric
    expect(ac.source).toBe("Acolyte");
    expect(ac.ability).toBe(""); // pending — user hasn't picked
    expect(ac.tier).toBe("none"); // defaulted
    expect(ac.type).toBe("known"); // defaulted
    expect(ac.cantrips).toBe(1);
    expect(ac.cantrip_pool).toBe("[[Arcane-Cantrip]]");
    expect(ac.ritual_pool).toBe("[[Arcane-Ritual]]");
  });

  it("Acolyte's ability pick populates the caster's ability", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 5 }],
        heritage: "Acolyte",
        choices: {
          Acolyte: { "Acolyte Features:ability": "INT" },
        },
      } as any,
      lib,
    );
    const acolyteCaster = view.casters.find((c) => c.source === "Acolyte")!;
    expect(acolyteCaster.ability).toBe("INT");
  });

  it("emits a pendingChoice for an unresolved spellcasting ability pick", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 5 }],
        heritage: "Acolyte",
      },
      lib,
    );
    const pending = view.pendingChoices.find(
      (p) => p.source === "Acolyte" && p.feature.choose &&
        (Array.isArray(p.feature.choose) ? p.feature.choose : [p.feature.choose])
          .some((c) => c?.type === "spellcasting"),
    );
    expect(pending).toBeDefined();
    expect(pending!.options.map((o) => o.name)).toEqual(["CHA", "INT", "WIS"]);
    expect(pending!.remaining).toBe(1);
  });

  it("a pure-augment source (e.g. Ritualist talent picked via background) still merges into class casters", () => {
    // Simulate a background source that pulls in the Ritualist talent.
    const adherent: SourceDoc = {
      name: "Adherent",
      kind: "background",
      meta: {},
      details: [
        {
          name: "Ritualist Grant",
          spellcasting: { rituals_per_circle: 1 },
        },
      ],
      options: [],
      unlocks: [],
      tables: [],
    };
    const libWithAdherent: CompendiumLib = {
      ...lib,
      backgrounds: { Adherent: adherent },
    };
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 5 }],
        background: "Adherent",
      },
      libWithAdherent,
    );
    // Only one caster — the Adherent source augments the Cleric caster.
    expect(view.casters).toHaveLength(1);
    expect(view.casters[0].source).toBe("Cleric");
    expect(view.casters[0].rituals_per_circle).toBe(1);
  });
});

// ─── feature.level augmentations ─────────────────────────────────────────────

describe("resolveFeatures: feature.level (per-level additions)", () => {
  const spellcaster: SourceDoc = {
    name: "Spellcaster",
    kind: "class",
    meta: {},
    details: [
      {
        name: "Spellcasting",
        level: 1,
        traits: { Spellcasting: "WIS Divine: 3 Cantrips, 1 Ritual" },
        levels: [
          { level: 3, traits: { Spellcasting: "2º Ritual" } },
          { level: 4, traits: { Spellcasting: "4th Cantrip" } },
        ],
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };
  const lib: CompendiumLib = {
    classes: { Spellcaster: spellcaster },
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: {},
  };

  it("applies no additions below the threshold", () => {
    const view = resolveFeatures(
      { classes: [{ name: "Spellcaster", level: 1 }] },
      lib,
    );
    expect(view.traits["Spellcasting"]).toEqual([
      "WIS Divine: 3 Cantrips, 1 Ritual",
    ]);
  });

  it("applies one addition at the matching level", () => {
    const view = resolveFeatures(
      { classes: [{ name: "Spellcaster", level: 3 }] },
      lib,
    );
    expect(view.traits["Spellcasting"]).toEqual([
      "WIS Divine: 3 Cantrips, 1 Ritual",
      "2º Ritual",
    ]);
  });

  it("applies every addition up to and including the character's level", () => {
    const view = resolveFeatures(
      { classes: [{ name: "Spellcaster", level: 5 }] },
      lib,
    );
    expect(view.traits["Spellcasting"]).toEqual([
      "WIS Divine: 3 Cantrips, 1 Ritual",
      "2º Ritual",
      "4th Cantrip",
    ]);
  });
});

// ─── Table aggregation ───────────────────────────────────────────────────────

describe("resolveFeatures: tables", () => {
  const clericWithTable: SourceDoc = {
    name: "Cleric",
    kind: "class",
    meta: {},
    details: [],
    options: [],
    unlocks: [],
    tables: [
      {
        name: "progression",
        columns: ["level", "pb"],
        columnLabels: ["LEVEL", "PB"],
        rows: [
          { cells: [{ value: "1" }, { value: "+2" }] },
          { cells: [{ value: "2" }, { value: "+2" }] },
        ],
        headerRows: [{ cells: [{ value: "LEVEL" }, { value: "PB" }] }],
        keyColumn: "level",
        classes: [],
        footerRows: [],
      },
    ],
  };
  const lib: CompendiumLib = {
    classes: { Cleric: clericWithTable },
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: {},
  };

  it("keys tables both by <source>:<name> and by bare <name>", () => {
    const view = resolveFeatures({ classes: [{ name: "Cleric", level: 1 }] }, lib);
    expect(Object.keys(view.tables).sort()).toEqual(["Cleric:progression", "progression"]);
    expect(view.tables["Cleric:progression"].source).toBe("Cleric");
    expect(view.tables.progression.rows).toHaveLength(2);
  });

  it("skips tables from sources the character hasn't taken", () => {
    const emptyView = resolveFeatures({ classes: [] }, lib);
    expect(Object.keys(emptyView.tables)).toEqual([]);
  });
});

// ─── Wikilink / folder reference expansion in choose.options ────────────────

describe("resolveFeatures: [[WikiLink]] / @folder expansion in choose.options", () => {
  const fighter: SourceDoc = {
    name: "Fighter",
    kind: "class",
    meta: {},
    details: [
      {
        name: "Weapon Mastery",
        level: 1,
        choose: {
          type: "traits",
          category: "Weapons",
          number: 1,
          options: ["[[Martial]]", "@compendium/weapons/simple", "[[Shield]]"],
        },
      },
    ],
    options: [],
    unlocks: [],
    tables: [],
  };

  const lib: CompendiumLib = {
    classes: { Fighter: fighter },
    subclasses: {},
    lineages: {},
    heritages: {},
    backgrounds: {},
    tagIndex: {
      Martial: ["[[Warhammer]]", "[[Longsword]]"],
    },
    folderIndex: {
      "compendium/weapons/simple": ["[[Dagger]]", "[[Club]]"],
    },
  };

  it("expands [[Tag]] refs and @folder refs to concrete wikilinks, preserves literals", () => {
    const view = resolveFeatures({ classes: [{ name: "Fighter", level: 1 }] }, lib);
    const pending = view.pendingChoices.find((p) => p.feature.name === "Weapon Mastery");
    expect(pending).toBeDefined();
    const names = pending!.options.map((o) => o.name);
    expect(names).toEqual(["[[Warhammer]]", "[[Longsword]]", "[[Dagger]]", "[[Club]]", "[[Shield]]"]);
  });

  it("passes wikilinks through as literals when the tag isn't indexed", () => {
    const libNoIdx: CompendiumLib = { ...lib, tagIndex: undefined, folderIndex: undefined };
    const view = resolveFeatures({ classes: [{ name: "Fighter", level: 1 }] }, libNoIdx);
    const pending = view.pendingChoices.find((p) => p.feature.name === "Weapon Mastery");
    expect(pending).toBeDefined();
    const names = pending!.options.map((o) => o.name);
    // Wikilinks pass through as literals; @-refs with no folder index collapse.
    expect(names).toEqual(["[[Martial]]", "[[Shield]]"]);
  });
});
