import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseSourceDoc, parseSourceDocs } from "./parse-source-doc";

const CLERIC_BODY = `
# Cleric

Full-caster divine class.

## Level 1

\`\`\`rpg feature.details
name: Hit Points
tag: hp
level: 1
value: "+8 +CON mod"
\`\`\`

\`\`\`rpg feature.details
name: Armor Proficiency
tag: armor
level: 1
values: [Light Armor, Medium Armor, Shields]
\`\`\`

\`\`\`rpg feature.details
name: Skill Proficiencies
tag: skill_proficiency
level: 1
pick: 2
\`\`\`

\`\`\`rpg feature.choice
parent: Skill Proficiencies
value: History
\`\`\`

\`\`\`rpg feature.choice
parent: Skill Proficiencies
value: Insight
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
    expect(hp).toMatchObject({ tag: "hp", level: 1, value: "+8 +CON mod" });
    const armor = doc.details.find((d) => d.name === "Armor Proficiency");
    expect(armor?.values).toEqual(["Light Armor", "Medium Armor", "Shields"]);
  });

  it("pulls FeatureChoiceOption out of feature.choice code blocks and links by parent name", () => {
    const doc = parseSourceDoc({ $name: "Cleric", $contents: CLERIC_BODY }, "class");
    expect(doc.options).toHaveLength(2);
    expect(doc.options.every((o) => o.parent === "Skill Proficiencies")).toBe(true);
    expect(doc.options.map((o) => o.value)).toEqual(["History", "Insight"]);
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
tag: hp
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
