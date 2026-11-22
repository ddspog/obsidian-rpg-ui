import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { parseMonsterTemplate } from "./monster-template";
import {
  applyTemplateBlock,
  changesOfLine,
  choosesHumanoid,
  describeChange,
  parseTemplateBlock,
  templateBlockData,
  templateBlockOf,
  type TemplateBlock,
} from "./template-block";

describe("changesOfLine", () => {
  it("reads the book's Statistics lines into changes", () => {
    expect(changesOfLine("Hit Points", "The creature’s hit points are reduced by 10 percent (rounded up).")).toEqual([
      { stat: "hp", percent: -10 },
    ]);
    expect(
      changesOfLine(
        "Hit Points",
        "If the creature’s CR is 19 or lower, its hit points are reduced by 5 percent (rounded up)."
      )
    ).toEqual([{ stat: "hp", percent: -5, upToCr: 19 }]);
    expect(changesOfLine("Hit Points", "The dragon’s hit points are increased by 168.")).toEqual([
      { stat: "hp", flat: 168 },
    ]);
    expect(changesOfLine("CR", "The dragon’s challenge rating increases by 5, up to CR 30.")).toEqual([
      { stat: "cr", plus: 5, max: 30 },
    ]);
    expect(
      changesOfLine(
        "Speed",
        "All the creature’s movement speeds are reduced by 10 feet. This never reduces a movement speed below 10 feet."
      )
    ).toEqual([{ stat: "speed", delta: -10, floor: 10 }]);
    expect(changesOfLine("Senses", "The bramble beast has tremorsense out to 30 feet.")).toEqual([
      { stat: "senses", add: "tremorsense", range: 30 },
    ]);
    expect(
      changesOfLine(
        "Resistant",
        "The fey champion is resistant to the type of damage you didn’t choose. In addition, it is resistant to the charmed condition."
      )
    ).toEqual([
      { stat: "resistant", choice: "other" },
      { stat: "resistant", conditions: ["charmed"] },
    ]);
    expect(changesOfLine("Languages", "The fey champion learns one language known by the archfey.")).toEqual([
      { stat: "note", label: "Languages", text: "The fey champion learns one language known by the archfey." },
    ]);
  });

  it("words each change for the sheet", () => {
    expect(describeChange({ stat: "hp", percent: -10 })).toEqual({
      label: "Hit Points",
      text: "−10%",
      tone: "down",
      note: "rounded up",
    });
    expect(describeChange({ stat: "abilities", atMost: { dex: -2, int: -4 } }).text).toBe("DEX ≤ −2, INT ≤ −4");
    expect(describeChange({ stat: "immune", choice: "chosen" }).text).toBe("+ the damage you choose");
  });
});

describe("template blocks", () => {
  const note = [
    "# Zombie",
    "This template can be applied to any Beast. The creature loses all traits and actions that assume it has a living body, such as Amphibious.",
    "## Statistics",
    "**Type.** The creature’s type changes to Undead.",
    "",
    "**Hit Points.** The creature’s hit points are reduced by 10 percent (rounded up).",
    "## Traits",
    "***Undead Resilience.*** The zombie is immune to poison damage.",
    "",
    "***Groan.*** Each creature within 5 feet of the zombie must succeed on a DC # [10 + the creature’s CON modifier] WIS save.",
  ].join("\n");

  it("survives being written as YAML and read back, and applies the same", () => {
    const block = templateBlockOf(parseMonsterTemplate("Zombie", note), "Monster Template Traits");
    const back = parseTemplateBlock(parse(stringify(templateBlockData(block))) as Record<string, unknown>);
    expect(back).toEqual({ ...block, features: block.features.map(({ text: _t, ...f }) => f) });
    expect(back.features.map((f) => f.id)).toEqual(["Zombie: Undead Resilience", "Zombie: Groan"]);

    const r = applyTemplateBlock(
      {
        type: "Medium Beast",
        stats: { hp: "70", senses: "—" },
        abilities: { str: 2, dex: 2, con: 2, int: -4, wis: 1, cha: -3 },
        features: [],
      },
      back,
      { cr: 1, baseFeatures: [{ name: "Amphibious", text: "" }] }
    );
    expect(r.data.type).toBe("Medium Undead");
    expect(r.data.stats).toMatchObject({ hp: "63", immune: "Undead Resilience" });
    expect(r.data.features).toEqual([
      { ref: "@[[Monster Template Traits]]#Zombie: Undead Resilience" },
      { ref: "@[[Monster Template Traits]]#Zombie: Groan", f1: 12 },
    ]);
    expect(r.changed).toEqual(expect.arrayContaining(["hp", "immune", "type"]));
    expect(r.manual.join(" ")).toMatch(/It loses Amphibious/);
  });
});

describe("a chosen Humanoid", () => {
  it("applies a lineage where the template asks for one (the Lycanthrope)", () => {
    const lycan = parseMonsterTemplate(
      "Lycanthrope",
      [
        "# Lycanthrope",
        "This template can be applied to any Beast.",
        "## Statistics",
        "Choose a Humanoid, then make the following adjustments to the Beast’s statistics.",
        "",
        "**Size and Type.** Its type changes to Humanoid, and it has the Shapechanger tag.",
        "",
        "**Senses.** If the chosen Humanoid has a special sense, such as darkvision, the creature gains that sense.",
        "",
        "**Abilities.** Replace the creature’s existing INT, WIS, and CHA modifiers with the chosen Humanoid’s INT, WIS, and CHA modifiers or with +0, if the chosen Humanoid is a PC lineage.",
        "## Bonus Actions",
        "***Change Shape.*** The lycanthrope transforms into a [Size] [Beast], or back into its true form.",
      ].join("\n")
    );
    const block = templateBlockOf(lycan, "Monster Template Traits");
    expect(choosesHumanoid(block)).toBe(true);
    const dwarf: TemplateBlock = {
      name: "Dwarf",
      kind: "lineage",
      appliesText: "",
      applies: { types: ["humanoid"], other: [], anyLineage: true },
      changes: [
        { stat: "tag", remove: "Any Lineage", add: "Dwarf" },
        { stat: "senses", add: "darkvision", range: 60, atLeast: true },
        { stat: "resistant", damage: ["poison"] },
      ],
      features: [{ id: "Dwarf: Dwarven Resilience", name: "Dwarven Resilience", type: "trait" }],
      featureNote: "Lineage NPC Traits",
    };
    const r = applyTemplateBlock(
      {
        name: "Elk, Giant",
        type: "Huge Beast",
        stats: { hp: "60", senses: "—" },
        abilities: { int: -2, wis: 1, cha: -2 },
      },
      block,
      { cr: 2, baseFeatures: [], lineage: dwarf, baseName: "Elk, Giant" }
    );
    expect(r.data.type).toBe("Huge Humanoid (Shapechanger, Dwarf)");
    expect(r.data.stats).toMatchObject({ senses: "darkvision 60 ft.", resistant: "poison" });
    expect(r.data.abilities).toMatchObject({ int: 0, wis: 1, cha: 0 });
    expect(r.data.features).toEqual([
      { ref: "@[[Monster Template Traits]]#Lycanthrope: Change Shape", f1: "Huge", f2: "giant elk" },
      { ref: "@[[Lineage NPC Traits]]#Dwarf: Dwarven Resilience" },
    ]);
    expect(r.manual.join(" ")).not.toMatch(/Senses:|Abilities:|Choose a Humanoid/);
  });
});
