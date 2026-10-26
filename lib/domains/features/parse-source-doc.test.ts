import { describe, it, expect, vi } from "vitest";
import { parseSourceDoc, parseSourceDocs, parseSourceDocShared, parseGMFeatureBlock } from "./parse-source-doc";

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
    const doc = parseSourceDoc({ $name: "Cleric", $contents: CLERIC_BODY, ".CLASS": { hit_die: "d8" } }, "class");
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
    const doc = parseSourceDoc({ $name: "Human", $contents: "", ".LINEAGE": { size: "medium", speed: 30 } }, "lineage");
    expect(doc.kind).toBe("lineage");
    expect(doc.meta).toEqual({ size: "medium", speed: 30 });
  });

  it("propagates parent_class for subclasses", () => {
    const doc = parseSourceDoc(
      { $name: "Life Domain", $contents: "", ".SUBCLASS": { parent_class: "Cleric" } },
      "subclass"
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
      "class"
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
      "class"
    );
    expect(doc.details.map((d) => d.name).sort()).toEqual(["From Body", "From Frontmatter"]);
  });
});

describe("parseSourceDocs", () => {
  it("collects multiple docs into a name-keyed map", () => {
    const map = parseSourceDocs(
      [
        { $name: "Cleric", $contents: CLERIC_BODY },
        { $name: "Fighter", $contents: "" },
      ],
      "class"
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

const GM_SCREEN_BODY = `
# Mythic GME

A GM Screen of solo-play oracles.

\`\`\`rpg feature.gm
name: Scene Check
oracle:
  question: "Does {{scene}} occur?"
  chaos: true
generator:
  name: Testing the Expected Scene
  roll: d10
  vs: CF
  work: Alterations
  interpret:
    ">CF": Expected Scene
    "<=CF, even": Altered Scene
    "<=CF, odd": Interrupt Scene
scene:
  opens: "S{{n}} {{title}}"
---
Test whether the expected scene plays out as imagined.
\`\`\`

\`\`\`rpg feature.gm
name: Fate Question
oracle:
  question: "Is the door locked?"
  chaos: true
  likelihood: likely
  roll: d100
\`\`\`
`;

describe("parseSourceDoc — feature.gm blocks", () => {
  it("pulls GMFeatures out of feature.gm code blocks with nested aspects", () => {
    const doc = parseSourceDoc({ $name: "Mythic GME", $contents: GM_SCREEN_BODY }, "class");
    expect(doc.gmFeatures).toHaveLength(2);

    const sceneCheck = doc.gmFeatures?.find((g) => g.name === "Scene Check");
    expect(sceneCheck).toMatchObject({
      name: "Scene Check",
      oracle: { question: "Does {{scene}} occur?", chaos: true },
      generator: { name: "Testing the Expected Scene", roll: "d10", vs: "CF", work: "Alterations" },
      scene: { opens: "S{{n}} {{title}}" },
    });
    // interpret keys preserve authored order
    expect(Object.keys(sceneCheck!.generator!.interpret!)).toEqual([">CF", "<=CF, even", "<=CF, odd"]);
    // body after `---` folds into the GM block's `body` (log content), not `text`
    expect(sceneCheck?.body).toContain("Test whether the expected scene");

    const fate = doc.gmFeatures?.find((g) => g.name === "Fate Question");
    expect(fate?.oracle).toMatchObject({ likelihood: "likely", roll: "d100", chaos: true });
  });

  it("leaves gmFeatures empty for ordinary docs and keeps feature.details unaffected", () => {
    const doc = parseSourceDoc({ $name: "Cleric", $contents: CLERIC_BODY }, "class");
    expect(doc.gmFeatures).toEqual([]);
    expect(doc.details).toHaveLength(3);
  });

  it("round-trips a `dial:` aspect and a `reads:` resource list", () => {
    const body = `# Chaos Factor

\`\`\`rpg feature.gm
name: Chaos Factor
dial:
  abbr: CF
  min: 1
  max: 9
  default: 5
\`\`\`

\`\`\`rpg feature.gm
name: Scene Check
reads: ["@[[Chaos Factor]]"]
generator:
  name: Testing the Expected Scene
  roll: d10
  vs: CF
\`\`\`
`;
    const doc = parseSourceDoc({ $name: "Chaos Factor", $contents: body }, "class");
    const dial = doc.gmFeatures?.find((g) => g.name === "Chaos Factor");
    expect(dial?.dial).toEqual({ abbr: "CF", min: 1, max: 9, default: 5 });
    // a head-only block (no `---`) has no body
    expect(dial?.body).toBeUndefined();

    const sceneCheck = doc.gmFeatures?.find((g) => g.name === "Scene Check");
    expect(sceneCheck?.reads).toEqual(["@[[Chaos Factor]]"]);
  });

  it("parses `id` and `heading` and folds the body as log content", () => {
    const body = [
      "```rpg feature.gm",
      "id: scene-check",
      "heading: 2",
      "name: Scene Check",
      "generator: { name: Testing the Expected Scene, roll: d10, vs: CF }",
      "---",
      "When a scene ends, test it.",
      "",
      "? [CF:5] Does it happen?",
      "  Scene: d10=3 vs CF 5 -> Altered Scene",
      "```",
    ].join("\n");
    const doc = parseSourceDoc({ $name: "Scene Check", $contents: body }, "class");
    const f = doc.gmFeatures?.find((g) => g.name === "Scene Check");
    expect(f?.id).toBe("scene-check");
    expect(f?.heading).toBe(2);
    expect(f?.body).toContain("? [CF:5] Does it happen?");
    expect(f?.body).toContain("When a scene ends, test it.");
    // the log body is NOT folded into `text` (which stays the tooltip slot)
    expect(f?.text).toBeUndefined();
  });

  it("accepts `heading: none` to suppress the name heading", () => {
    const body = ["```rpg feature.gm", "name: Bare Tool", "heading: none", "---", "Just prose.", "```"].join("\n");
    const doc = parseSourceDoc({ $name: "Bare Tool", $contents: body }, "class");
    expect(doc.gmFeatures?.[0]?.heading).toBe("none");
  });

  it("still folds a feature.details body into `text` (not `body`)", () => {
    const body = ["```rpg feature.details", "name: Second Wind", "---", "Regain HP as a bonus action.", "```"].join(
      "\n"
    );
    const doc = parseSourceDoc({ $name: "Fighter", $contents: body }, "class");
    expect(doc.details?.[0]?.text).toContain("Regain HP as a bonus action.");
  });
});

describe("parseGMFeatureBlock", () => {
  it("parses a single feature.gm fence body and folds trailing markdown into body", () => {
    const body = [
      "name: Scene Check",
      "oracle:",
      '  question: "Does {{scene}} occur?"',
      "  chaos: true",
      "scene:",
      '  opens: "S{{n}} {{title}}"',
      "---",
      "Test whether the expected scene plays out.",
    ].join("\n");
    const f = parseGMFeatureBlock(body);
    expect(f).toMatchObject({
      name: "Scene Check",
      oracle: { question: "Does {{scene}} occur?", chaos: true },
      scene: { opens: "S{{n}} {{title}}" },
    });
    expect(f?.body).toContain("Test whether the expected scene");
  });

  it("returns null for an empty body", () => {
    expect(parseGMFeatureBlock("")).toBeNull();
  });
});

describe("parseSourceDocShared", () => {
  const text = "```rpg table.Loot\n| d4 | Result |\n|----|--------|\n| 1 | Coin |\n| 2 | Gem |\n```\n";

  it("hands back the same parse for the same text", () => {
    const a = parseSourceDocShared({ $name: "Loot", $contents: text }, "class");
    const b = parseSourceDocShared({ $name: "Loot", $contents: text }, "class");
    expect(b).toBe(a);
    expect(a.tables).toEqual(parseSourceDoc({ $name: "Loot", $contents: text }, "class").tables);
  });

  it("parses again when the text, the name or the kind differs", () => {
    const a = parseSourceDocShared({ $name: "Loot", $contents: text }, "class");
    expect(parseSourceDocShared({ $name: "Loot", $contents: text + "\n" }, "class")).not.toBe(a);
    expect(parseSourceDocShared({ $name: "Other", $contents: text }, "class")).not.toBe(a);
    expect(parseSourceDocShared({ $name: "Loot", $contents: text }, "background")).not.toBe(a);
  });

  it("leaves a doc with frontmatter to be parsed afresh", () => {
    const raw = { $name: "Loot", $contents: text, level: 3 };
    expect(parseSourceDocShared(raw, "class")).not.toBe(parseSourceDocShared(raw, "class"));
  });
});
