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
        traits: { Saves: ["WIS", "CHA"] },
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
    // Fixed Saves trait still aggregates
    expect(view.traits["Saves"]).toEqual(["WIS", "CHA"]);
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

// ─── Tag / folder reference expansion in choose.options ─────────────────────

describe("resolveFeatures: #Tag / @folder expansion in choose.options", () => {
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
          options: ["#Martial", "@compendium/weapons/simple", "[[Shield]]"],
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

  it("expands #Tag refs and @folder refs to concrete wikilinks, preserves literals", () => {
    const view = resolveFeatures({ classes: [{ name: "Fighter", level: 1 }] }, lib);
    const pending = view.pendingChoices.find((p) => p.feature.name === "Weapon Mastery");
    expect(pending).toBeDefined();
    const names = pending!.options.map((o) => o.name);
    expect(names).toEqual(["[[Warhammer]]", "[[Longsword]]", "[[Dagger]]", "[[Club]]", "[[Shield]]"]);
  });

  it("leaves literal options untouched when no indexes are provided", () => {
    const libNoIdx: CompendiumLib = { ...lib, tagIndex: undefined, folderIndex: undefined };
    const view = resolveFeatures({ classes: [{ name: "Fighter", level: 1 }] }, libNoIdx);
    const pending = view.pendingChoices.find((p) => p.feature.name === "Weapon Mastery");
    expect(pending).toBeDefined();
    const names = pending!.options.map((o) => o.name);
    // Unknown refs collapse to [] so only the literal survives.
    expect(names).toEqual(["[[Shield]]"]);
  });
});
