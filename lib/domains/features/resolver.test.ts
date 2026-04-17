import { describe, it, expect } from "vitest";
import { resolveFeatures } from "./resolver";
import type { CompendiumLib, SourceDoc } from "./types";

// ─── Hand-rolled fixtures ─────────────────────────────────────────────────────

const cleric: SourceDoc = {
  name: "Cleric",
  kind: "class",
  meta: { hit_die: "d8" },
  details: [
    { name: "Hit Points", tag: "hp", level: 1, value: "+8 +CON mod" },
    {
      name: "Armor Proficiency",
      tag: "armor",
      level: 1,
      values: ["Light Armor", "Medium Armor", "Shields"],
    },
    { name: "Spellcasting", type: "passive", level: 1, description: "Divine power conduit." },
    { name: "Skill Proficiencies", tag: "skill_proficiency", level: 1, pick: 2 },
    { name: "Divine Order", level: 1, pick: 1, description: "Pick a divine path." },
    { name: "Hit Points", tag: "hp", level: 2, value: "+1d8 +CON mod" },
    {
      name: "Channel Divinity",
      type: "free_action",
      level: 2,
      uses: 1,
      description: "Channel deity's energy.",
    },
    { name: "Hit Points", tag: "hp", level: 3, value: "+1d8 +CON mod" },
    { name: "Way of the Mountain", level: 5, description: "A high-level feature." },
  ],
  options: [
    { parent: "Skill Proficiencies", value: "History" },
    { parent: "Skill Proficiencies", value: "Insight" },
    { parent: "Skill Proficiencies", value: "Medicine" },
    { parent: "Skill Proficiencies", value: "Religion" },
    {
      parent: "Divine Order",
      name: "Protector",
      description: "Heavy armor and martial weapons.",
      tag: "armor",
      values: ["Heavy Armor"],
      features: [
        { name: "Manifestation of Faith", type: "passive", description: "Faith made flesh." },
      ],
    },
    {
      parent: "Divine Order",
      name: "Thaumaturge",
      description: "Extra cantrip.",
      features: [{ name: "Extra Cantrip", type: "passive" }],
    },
  ],
  unlocks: [{ kind: "subclass", level: 3 }],
};

const lifeDomain: SourceDoc = {
  name: "Life Domain",
  kind: "subclass",
  meta: {},
  parent_class: "Cleric",
  details: [{ name: "Disciple of Life", type: "passive", level: 3, description: "Heal more." }],
  options: [],
  unlocks: [],
};

const human: SourceDoc = {
  name: "Human",
  kind: "lineage",
  meta: { size: "medium", speed: 30 },
  details: [
    { name: "Speed", tag: "speed", value: "30 ft." },
    { name: "Skill Versatility", tag: "skill_proficiency", pick: 1 },
  ],
  options: [
    { parent: "Skill Versatility", value: "Acrobatics" },
    { parent: "Skill Versatility", value: "Stealth" },
  ],
  unlocks: [],
};

const greatHouse: SourceDoc = {
  name: "Great House",
  kind: "heritage",
  meta: {},
  details: [{ name: "Noble Connections", type: "passive", description: "You know nobles." }],
  options: [],
  unlocks: [],
};

const fighter: SourceDoc = {
  name: "Fighter",
  kind: "class",
  meta: {},
  details: [
    {
      name: "Armor Proficiency",
      tag: "armor",
      level: 1,
      values: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"],
    },
    { name: "Fighting Style", level: 1, pick: 1 },
    { name: "Hit Points", tag: "hp", level: 1, value: "+10 +CON mod" },
    { name: "Hit Points", tag: "hp", level: 2, value: "+1d10 +CON mod" },
  ],
  options: [
    { parent: "Fighting Style", name: "Defense", description: "+1 AC while wearing armor." },
    { parent: "Fighting Style", name: "Dueling", description: "+2 damage one-handed." },
  ],
  unlocks: [{ kind: "subclass", level: 3 }],
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
        choices: { Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" } },
      },
      lib,
    );
    const cleric = view.sources.find((s) => s.source === "Cleric")!;
    const featNames = cleric.features.map((f) => f.name);
    expect(featNames).toContain("Spellcasting");
    expect(featNames).toContain("Channel Divinity");
    expect(featNames).not.toContain("Way of the Mountain");
  });

  it("merges duplicate-tag grants into one grouped list, preserving order", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 3 }],
        choices: { Cleric: { "Skill Proficiencies": ["Medicine", "Insight"], "Divine Order": "Protector" } },
      },
      lib,
    );
    const cleric = view.sources.find((s) => s.source === "Cleric")!;
    const tags = cleric.grants.map((g) => g.tag);
    // Each tag appears only once after grouping
    expect(tags).toEqual([...new Set(tags)]);
    const hp = cleric.grants.find((g) => g.tag === "hp")!;
    expect(hp.values).toEqual(["+8 +CON mod", "+1d8 +CON mod"]);
  });

  it("applies a single picked option (Skill Proficiencies pick: 2)", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        choices: { Cleric: { "Skill Proficiencies": ["Medicine", "Insight"] } },
      },
      lib,
    );
    const cleric = view.sources.find((s) => s.source === "Cleric")!;
    const skills = cleric.grants.find((g) => g.tag === "skill_proficiency")!;
    expect(skills.values).toEqual(["Medicine", "Insight"]);
    // No pending choice for skills
    expect(cleric.pendingChoices.find((p) => p.feature.name === "Skill Proficiencies")).toBeUndefined();
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
    const cleric = view.sources.find((s) => s.source === "Cleric")!;
    const armor = cleric.grants.find((g) => g.tag === "armor")!;
    expect(armor.values).toContain("Heavy Armor");
    expect(armor.values).toContain("Light Armor");
    expect(cleric.features.map((f) => f.name)).toContain("Manifestation of Faith");
  });

  it("surfaces unresolved details in pendingChoices with the right remaining count", () => {
    const view = resolveFeatures(
      {
        classes: [{ name: "Cleric", level: 1 }],
        choices: { Cleric: { "Skill Proficiencies": ["Medicine"] } }, // only 1 of 2 picked
      },
      lib,
    );
    const cleric = view.sources.find((s) => s.source === "Cleric")!;
    const skills = cleric.pendingChoices.find((p) => p.feature.name === "Skill Proficiencies")!;
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
    const human = view.sources.find((s) => s.source === "Human")!;
    expect(human.grants.find((g) => g.tag === "skill_proficiency")?.values).toEqual(["Stealth"]);
  });

  it("multiclass: combines two class entries (header-driven)", () => {
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

    const fighter = view.sources.find((s) => s.source === "Fighter")!;
    expect(fighter.level).toBe(2);
    const fighterArmor = fighter.grants.find((g) => g.tag === "armor")!;
    expect(fighterArmor.values).toContain("Heavy Armor");

    const cleric = view.sources.find((s) => s.source === "Cleric")!;
    expect(cleric.level).toBe(1);
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
