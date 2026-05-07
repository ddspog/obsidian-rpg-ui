import { describe, it, expect, vi } from "vitest";
import { parseSourceDoc, parseSourceDocs } from "./parse-source-doc";

const CLERIC_BODY = `
# Cleric

Full-caster divine class.

## Level 1

\`\`\`rpg feature.details
name: Hit Points
level: 1
text: |
  **Hit Dice:** 1d8 per cleric level
traits:
  Hit Dice: "+8 +CON mod"
\`\`\`

\`\`\`rpg feature.details
name: Armor Proficiency
level: 1
traits:
  Armor Proficiency: "Light Armor, Medium Armor, Shields"
\`\`\`

\`\`\`rpg feature.details
name: Skill Proficiencies
level: 1
pick: 2
text: Choose two skills.
\`\`\`

\`\`\`rpg feature.choice
parent: Skill Proficiencies
name: History
traits:
  Skill Proficiency: "+History"
\`\`\`

\`\`\`rpg feature.choice
parent: Skill Proficiencies
name: Insight
traits:
  Skill Proficiency: "+Insight"
\`\`\`

## Level 3

\`\`\`rpg feature.unlock
kind: subclass
level: 3
\`\`\`
`;

describe("parseSourceDoc", () => {
  it("pulls FeatureDetails out of feature.details code blocks", () => {
    const doc = parseSourceDoc(
      { $name: "Cleric", $contents: CLERIC_BODY, ".CLASS": { hit_die: "d8" } },
      "class",
    );
    expect(doc.name).toBe("Cleric");
    expect(doc.kind).toBe("class");
    expect(doc.details).toHaveLength(3);
    const hp = doc.details.find((d) => d.name === "Hit Points");
    expect(hp).toMatchObject({
      name: "Hit Points",
      level: 1,
      traits: { "Hit Dice": "+8 +CON mod" },
    });
    const armor = doc.details.find((d) => d.name === "Armor Proficiency");
    expect(armor?.traits?.["Armor Proficiency"]).toBe("Light Armor, Medium Armor, Shields");
  });

  it("pulls FeatureChoiceOption out of feature.choice code blocks and links by parent name", () => {
    const doc = parseSourceDoc({ $name: "Cleric", $contents: CLERIC_BODY }, "class");
    expect(doc.options).toHaveLength(2);
    expect(doc.options.every((o) => o.parent === "Skill Proficiencies")).toBe(true);
    expect(doc.options.map((o) => o.name)).toEqual(["History", "Insight"]);
    expect(doc.options[0].traits?.["Skill Proficiency"]).toBe("+History");
  });

  it("pulls UnlockBlock out of feature.unlock code blocks", () => {
    const doc = parseSourceDoc({ $name: "Cleric", $contents: CLERIC_BODY }, "class");
    expect(doc.unlocks).toEqual([{ kind: "subclass", level: 3 }]);
  });

  it("captures the per-kind metadata block", () => {
    const doc = parseSourceDoc(
      { $name: "Human", $contents: "", ".LINEAGE": { size: "medium", speed: 30 } },
      "lineage",
    );
    expect(doc.kind).toBe("lineage");
    expect(doc.meta).toEqual({ size: "medium", speed: 30 });
  });

  it("propagates parent_class for subclasses", () => {
    const doc = parseSourceDoc(
      { $name: "Life Domain", $contents: "", ".SUBCLASS": { parent_class: "Cleric" } },
      "subclass",
    );
    expect(doc.parent_class).toBe("Cleric");
  });

  it("surfaces malformed code blocks via console.warn but does not crash", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = `
\`\`\`rpg feature.details
name: Good
\`\`\`

\`\`\`rpg feature.details
name: "Broken
  oops: [unbalanced
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Test", $contents: body }, "class");
    expect(doc.details).toHaveLength(1);
    expect(doc.details[0].name).toBe("Good");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns empty arrays for a doc with no rpg code blocks", () => {
    const doc = parseSourceDoc({ $name: "Bare", $contents: "Just prose, nothing else." }, "class");
    expect(doc.details).toEqual([]);
    expect(doc.options).toEqual([]);
    expect(doc.unlocks).toEqual([]);
  });

  it("accepts feature.details blocks without a `name:` field and synthesizes a stable key", () => {
    const body = `
\`\`\`rpg feature.details
text: Hardcoded + a pick with no declared feature name.
traits:
  Tools:
    - "[[Artist Tools]]"
\`\`\`

\`\`\`rpg feature.details
name: Talent
text: Second block keeps its authored name.
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Adherent", $contents: body }, "background");
    expect(doc.details).toHaveLength(2);
    // Positional synthetic name — starts with the sentinel prefix so the UI
    // can recognise it and substitute a prettier label.
    expect(doc.details[0].name).toBe("__auto_0");
    expect(doc.details[0].traits?.["Tools"]).toEqual(["[[Artist Tools]]"]);
    expect(doc.details[1].name).toBe("Talent");
  });

  it("reads features from frontmatter `.features` for pure-markdown docs", () => {
    const doc = parseSourceDoc(
      {
        $name: "Cleric",
        $contents: "Pure markdown body, no rpg blocks.",
        ".features": {
          details: [
            {
              name: "Hit Points",
              level: 1,
              traits: { "Hit Dice": "+8 +CON mod" },
            },
            {
              name: "Manifestation of Faith",
              subtitle: "1st-Level Cleric Feature",
              level: 1,
              pick: 1,
            },
          ],
          choices: [
            {
              parent: "Manifestation of Faith",
              name: "Manifest Might",
              traits: { "Armor Proficiency": "+Heavy Armor" },
            },
          ],
          unlocks: [{ kind: "subclass", level: 3 }],
        },
      },
      "class",
    );
    expect(doc.details).toHaveLength(2);
    expect(doc.details[0]).toMatchObject({ name: "Hit Points", level: 1 });
    expect(doc.options).toHaveLength(1);
    expect(doc.options[0]).toMatchObject({ parent: "Manifestation of Faith", name: "Manifest Might" });
    expect(doc.unlocks).toEqual([{ kind: "subclass", level: 3 }]);
  });

  it("merges code-block features and frontmatter features when both are present", () => {
    const doc = parseSourceDoc(
      {
        $name: "Mixed",
        $contents: "```rpg feature.details\nname: From Body\n```",
        ".features": {
          details: [{ name: "From Frontmatter" }],
        },
      },
      "class",
    );
    expect(doc.details.map((d) => d.name).sort()).toEqual([
      "From Body",
      "From Frontmatter",
    ]);
  });
});

describe("parseSourceDocs", () => {
  it("collects multiple docs into a name-keyed map", () => {
    const map = parseSourceDocs(
      [
        { $name: "Cleric", $contents: CLERIC_BODY },
        { $name: "Fighter", $contents: "" },
      ],
      "class",
    );
    expect(Object.keys(map).sort()).toEqual(["Cleric", "Fighter"]);
    expect(map.Cleric.details.length).toBeGreaterThan(0);
  });
});

describe("parseSourceDoc — feature.level attachment", () => {
  it("attaches feature.level blocks to the most recent feature.details", () => {
    const body = `
\`\`\`rpg feature.details
name: Spellcasting
level: 1
traits:
  Spellcasting: "WIS Divine: 3 Cantrips"
\`\`\`

\`\`\`rpg feature.level
level: 3
traits:
  Spellcasting: "2º Ritual"
\`\`\`

\`\`\`rpg feature.level
level: 4
traits:
  Spellcasting: "4th Cantrip"
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Cleric", $contents: body }, "class");
    expect(doc.details).toHaveLength(1);
    const spell = doc.details[0];
    expect(spell.name).toBe("Spellcasting");
    expect(spell.levels).toEqual([
      { level: 3, traits: { Spellcasting: "2º Ritual" } },
      { level: 4, traits: { Spellcasting: "4th Cantrip" } },
    ]);
  });

  it("re-targets `levels` when a new feature.details appears", () => {
    const body = `
\`\`\`rpg feature.details
name: A
\`\`\`
\`\`\`rpg feature.level
level: 2
traits: { A: "+a2" }
\`\`\`
\`\`\`rpg feature.details
name: B
\`\`\`
\`\`\`rpg feature.level
level: 5
traits: { B: "+b5" }
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Test", $contents: body }, "class");
    const a = doc.details.find((d) => d.name === "A")!;
    const b = doc.details.find((d) => d.name === "B")!;
    expect(a.levels).toEqual([{ level: 2, traits: { A: "+a2" } }]);
    expect(b.levels).toEqual([{ level: 5, traits: { B: "+b5" } }]);
  });

  it("skips a dangling feature.level that has no preceding feature.details", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = `
\`\`\`rpg feature.level
level: 2
traits: { Orphan: "+x" }
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Test", $contents: body }, "class");
    expect(doc.details).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("parseSourceDoc — resource-typed details", () => {
  it("parses max and recovery alongside the standard details fields", () => {
    const body = `
\`\`\`rpg feature.details
name: Channel Divinity
type: resource
level: 2
max:
  2: 1
  6: 2
recovery: short or long rest
text: A pool of divine energy.
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Cleric", $contents: body }, "class");
    expect(doc.details).toHaveLength(1);
    expect(doc.details[0]).toMatchObject({
      name: "Channel Divinity",
      type: "resource",
      level: 2,
      max: { 2: 1, 6: 2 },
      recovery: "short or long rest",
    });
  });
});
