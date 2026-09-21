import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { resolveListOps } from "lib/domains/lonelog/list-ops";
import {
  assembleProse,
  buildSidebarItems,
  laneForSpeaker,
  reconstructScene,
  applySceneEdits,
  applyTokenEdits,
  dieEditKey,
} from "./prose-model";
import type { ProseScene } from "./prose-model";

function prose(body: string): ProseScene[] {
  return assembleProse(groupIntoProse(parseLonelog(body)));
}

describe("assembleProse", () => {
  it("shows only the => conclusion of an action, hiding the @/d: machinery", () => {
    const scenes = prose(`@(Talon) Checking if the Kobold is lying
d: d20+5=11 vs DC 10 -> Success
=> I watched him. There was no lie in his voice.`);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].head).toBeNull();
    expect(scenes[0].nodes).toHaveLength(1);
    const node = scenes[0].nodes[0];
    expect(node.kind).toBe("paragraph");
    if (node.kind === "paragraph") {
      expect(node.fragments).toHaveLength(1);
      expect(node.fragments[0].text).toBe("I watched him. There was no lie in his voice.");
      expect(node.fragments[0].sourceId).toBe(0); // the action's index
    }
  });

  it("joins two conclusions across ++ into one paragraph, each keeping its dot", () => {
    const scenes = prose(`@(Talon) Checking if the Kobold is lying
d: d20+5=11 vs DC 10 -> Success
=> I watched him. There was no lie in his voice.
++
@(Talon) Received Kowyn's Bag from Kobold.
=> And I began to think of what we might gain by keeping him close.`);
    expect(scenes).toHaveLength(1);
    const nodes = scenes[0].nodes;
    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    if (node.kind === "paragraph") {
      expect(node.fragments.map((f) => f.text)).toEqual([
        "I watched him. There was no lie in his voice.",
        "And I began to think of what we might gain by keeping him close.",
      ]);
      // Distinct provenance ids — two dots, two source actions.
      expect(node.fragments[0].sourceId).toBe(0);
      expect(node.fragments[1].sourceId).toBe(4);
    }
  });

  it("opens a new scene from a => S## conclusion and carries a dot", () => {
    const scenes = prose(`? [CF:5] Does the scene occur?
gen: Testing the Expected Scene
  Alterations: d10=8 vs CF 5 -> Expected Scene
=> S01 After the Landslide

Our final lesson behind us, we were no longer students.`);
    expect(scenes).toHaveLength(1);
    const scene = scenes[0];
    expect(scene.head).not.toBeNull();
    expect(scene.head?.number).toBe("S01");
    expect(scene.head?.context).toBe("After the Landslide");
    expect(scene.head?.fromConsequence).toBe(true);
    expect(scene.head?.sourceId).toBe(0); // the oracle block that yielded the scene
    // Only the narration reaches prose — the oracle / gen / working line do not.
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0]).toMatchObject({
      kind: "narration",
      text: "Our final lesson behind us, we were no longer students.",
    });
  });

  it("opens a scene from a standalone S## marker without a dot", () => {
    const scenes = prose(`S2 The Crossroads
The road forked beneath a grey sky.`);
    expect(scenes[0].head).toMatchObject({ number: "S2", context: "The Crossroads", fromConsequence: false });
    expect(scenes[0].head?.sourceId).toBeUndefined();
  });

  it("renders dialogue as nodes with speaker and type", () => {
    const scenes = prose(`PC(Lilith): Where in the hells did he come from?
N(Kobold): I snuck in. I had to!
PC(Jacqui): Running from who?`);
    const nodes = scenes[0].nodes;
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ kind: "dialogue", speaker: "Lilith", speakerType: "pc" });
    expect(nodes[1]).toMatchObject({ kind: "dialogue", speaker: "Kobold", speakerType: "npc" });
    expect(nodes[2]).toMatchObject({ kind: "dialogue", speaker: "Jacqui", speakerType: "pc" });
  });

  it("drops tag-only consequences from prose", () => {
    const scenes = prose(`[PC:Elara|HP-5]
=> She winces but stays standing.`);
    const nodes = scenes[0].nodes;
    expect(nodes).toHaveLength(1);
    if (nodes[0].kind === "paragraph") {
      expect(nodes[0].fragments[0].text).toBe("She winces but stays standing.");
    }
  });

  it("dialogue breaks paragraph flow so a later ++ does not bleed across it", () => {
    const scenes = prose(`=> First.
PC(Kael): A word between.
=> Second.`);
    const kinds = scenes[0].nodes.map((n) => n.kind);
    expect(kinds).toEqual(["paragraph", "dialogue", "paragraph"]);
  });
});

describe("laneForSpeaker", () => {
  it("is deterministic per speaker", () => {
    expect(laneForSpeaker("Lilith")).toBe(laneForSpeaker("Lilith"));
    expect(laneForSpeaker("Talon")).not.toBe(laneForSpeaker("Lilith"));
  });

  it("stays within the usable lane range", () => {
    for (const name of ["Lilith", "Talon", "Kobold", "Jacqui", "A", ""]) {
      const lane = laneForSpeaker(name);
      expect(lane).toBeGreaterThanOrEqual(0.08);
      expect(lane).toBeLessThan(0.92);
    }
  });
});

describe("buildSidebarItems", () => {
  it("lists the mechanical entries and excludes prose (dialogue, narration, scenes)", () => {
    const items = buildSidebarItems(
      groupIntoProse(
        parseLonelog(`S1 Opening
@(Talon) Checks the lock
d: d20+5=11 -> Success
=> The lock clicks open.
? [CF:5] Is anyone watching?
N(Kobold): Hello there.
The wind picks up.`)
      )
    );
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain("action");
    expect(kinds).toContain("oracle");
    expect(kinds).not.toContain("dialogue");
    expect(kinds).not.toContain("narration");
    // Provenance ids match the segment anchors.
    const action = items.find((i) => i.kind === "action");
    expect(action?.id).toBe(1); // S1 is index 0, action is index 1
    expect(action?.rows[0].content).toContain("Talon");
    const oracle = items.find((i) => i.kind === "oracle");
    expect(oracle?.rows.some((r) => r.pills.some((p) => p.name === "CF" && p.value === "5"))).toBe(true);
  });

  it("renders each source line of an entry as its own row with an icon", () => {
    const items = buildSidebarItems(
      groupIntoProse(
        parseLonelog(`? [CF:5] Does the scene occur?
gen: Testing the Expected Scene
  Alterations: d10=8 vs CF 5 -> Expected Scene
=> S01 After the Landslide`)
      )
    );
    expect(items).toHaveLength(1);
    const oracle = items[0];
    expect(oracle.kind).toBe("oracle");
    // ? question (with CF pill), gen, the working line, and the => result.
    expect(oracle.rows).toHaveLength(4);
    expect(oracle.rows[0].icon).toEqual({ glyph: "?" });
    expect(oracle.rows[0].pills).toEqual([{ name: "CF", value: "5", kind: "cf" }]);
    expect(oracle.rows[1].icon).toEqual({ lucide: "Sprout" });
    expect(oracle.rows[2].icon).toBeNull(); // the indented working line — no icon, rendered as a bullet
    expect(oracle.rows[2].detail).toBe(true);
    expect(oracle.rows[2].label).toBe("Alterations");
    expect(oracle.rows[2].content).toBe("d10=8 vs CF 5 -> Expected Scene");
    expect(oracle.rows[3].icon).toEqual({ lucide: "CornerDownRight" });
    // A scene-shaped consequence becomes an editable scene row.
    expect(oracle.rows[3].scene).toEqual({
      original: "S01 After the Landslide",
      number: "01",
      name: "After the Landslide",
      hadS: true,
    });
    expect(oracle.rows[3].content).toBe('Start Scene(01): "After the Landslide"');
  });

  it("treats a non-scene consequence as a plain row (no scene inputs)", () => {
    const items = buildSidebarItems(groupIntoProse(parseLonelog("=> The lock clicks open. [N:Door|opened]")));
    expect(items[0].rows[0].scene).toBeUndefined();
    expect(items[0].rows[0].content).toBe("The lock clicks open.");
  });

  it("reconstructs an edited scene's => text", () => {
    expect(reconstructScene("02", "With Kowyn", true)).toBe("S02 With Kowyn");
    expect(reconstructScene("1a", "Flashback", true)).toBe("S1a Flashback");
    expect(reconstructScene("T1-S1", "Meanwhile", false)).toBe("T1-S1 Meanwhile");
  });

  it("attaches indented continuation lines to the preceding entry", () => {
    const items = buildSidebarItems(
      groupIntoProse(
        parseLonelog(`gen: Testing the Expected Scene
  Alterations: d10=8 vs CF 5 -> Expected Scene`)
      )
    );
    const gen = items.find((i) => i.kind === "generator");
    expect(
      gen?.rows.some((r) => r.detail && r.label === "Alterations" && r.content === "d10=8 vs CF 5 -> Expected Scene")
    ).toBe(true);
  });
});

describe("consecutive concat tokens", () => {
  it("handles consecutive concat tokens without crashing", () => {
    const scenes = prose(`=> First.
++
++
=> Second.`);
    expect(scenes).toHaveLength(1);
    const node = scenes[0].nodes[0];
    if (node.kind === "paragraph") {
      expect(node.fragments).toHaveLength(2);
      expect(node.fragments[0].text).toBe("First.");
      expect(node.fragments[1].text).toBe("Second.");
    }
  });

  it("handles concat after dialogue without effect", () => {
    const scenes = prose(`=> First.
PC(Speaker): Some dialogue.
++
=> Second.`);
    const kinds = scenes[0].nodes.map((n) => n.kind);
    expect(kinds).toEqual(["paragraph", "dialogue", "paragraph"]);
  });
});

describe("applySceneEdits", () => {
  it("rewrites a scene line in a header-less rpg log block (note frontmatter intact)", () => {
    const content = [
      "---",
      "title: Journal",
      "---",
      "",
      "# Heading",
      "",
      "```rpg log",
      "=> S01 After the Landslide",
      "",
      "Our final lesson behind us.",
      "=> S02 With Kowyn",
      "```",
      "",
      "Footer prose.",
    ].join("\n");

    const out = applySceneEdits(content, [{ from: "S01 After the Landslide", to: "S01 After the Rockfall" }]);
    expect(out).toContain("=> S01 After the Rockfall");
    expect(out).not.toContain("=> S01 After the Landslide");
    expect(out).toContain("title: Journal");
    expect(out).toContain("=> S02 With Kowyn");
    expect(out).toContain("Our final lesson behind us.");
    expect(out).toContain("Footer prose.");
  });

  it("rewrites a scene line in a block that has a YAML header, preserving indentation", () => {
    const content = ["```rpg log", "state_key: x", "---", "  => S03 The Crossroads", "```"].join("\n");
    const out = applySceneEdits(content, [{ from: "S03 The Crossroads", to: "S03 The Fork" }]);
    expect(out).toContain("  => S03 The Fork");
    expect(out).toContain("state_key: x");
  });

  it("returns content unchanged when nothing matches", () => {
    const content = "```rpg log\n=> S01 Here\n```";
    expect(applySceneEdits(content, [{ from: "S99 Nope", to: "S99 X" }])).toBe(content);
    expect(applySceneEdits(content, [])).toBe(content);
  });
});

describe("applyTokenEdits", () => {
  it("swaps a die token on a matched line, preserving indentation and the rest", () => {
    const content = [
      "```rpg log",
      "? [CF:5] Does it open?",
      "  Alterations: d10=8 vs CF 5 -> Expected Scene",
      "```",
    ].join("\n");
    const out = applyTokenEdits(content, [
      { line: "Alterations: d10=8 vs CF 5 -> Expected Scene", from: "d10=8", to: "d10=9" },
    ]);
    expect(out).toContain("  Alterations: d10=9 vs CF 5 -> Expected Scene");
    expect(out).not.toContain("d10=8");
  });

  it("only replaces the first occurrence and leaves non-matching lines alone", () => {
    const content = ["```rpg log", "  Check: d20=15 -> Pass", "  Other: d20=15 -> Pass", "```"].join("\n");
    const out = applyTokenEdits(content, [{ line: "Check: d20=15 -> Pass", from: "d20=15", to: "d20=18" }]);
    expect(out).toContain("  Check: d20=18 -> Pass");
    expect(out).toContain("  Other: d20=15 -> Pass");
  });

  it("applies several token swaps on the same line (e.g. a die and its threshold)", () => {
    const content = ["```rpg log", "  Roll: d10=8 vs CF 5 -> Expected Scene", "```"].join("\n");
    const out = applyTokenEdits(content, [
      { line: "Roll: d10=8 vs CF 5 -> Expected Scene", from: "d10=8", to: "d10=9" },
      { line: "Roll: d10=8 vs CF 5 -> Expected Scene", from: "CF 5", to: "CF 6" },
    ]);
    expect(out).toContain("  Roll: d10=9 vs CF 6 -> Expected Scene");
  });

  it("returns content unchanged when nothing matches or the edit list is empty", () => {
    const content = "```rpg log\n  Check: d6=4\n```";
    expect(applyTokenEdits(content, [{ line: "Nope: d6=4", from: "d6=4", to: "d6=5" }])).toBe(content);
    expect(applyTokenEdits(content, [])).toBe(content);
  });
});

describe("dieEditKey", () => {
  it("is stable per source line + raw + slot and differs otherwise", () => {
    expect(dieEditKey("Alterations: d10=8", "d10=8", 0)).toBe(dieEditKey("Alterations: d10=8", "d10=8", 0));
    expect(dieEditKey("Alterations: d10=8", "d10=8", 0)).not.toBe(dieEditKey("Alterations: d10=8", "d10=8", 1));
    expect(dieEditKey("Alterations: d10=8", "d10=8", 0)).not.toBe(dieEditKey("Likely: d10=8", "d10=8", 0));
  });
});

describe("continuation rows — word-pair table refs are hidden", () => {
  const rowsFor = (body: string) =>
    buildSidebarItems(groupIntoProse(parseLonelog(body)))
      .flatMap((i) => i.rows)
      .filter((r) => r.detail);

  it("shows just the die + result, keeping the raw ref in `source`", () => {
    const body = [
      "? A Random Event fires — what is it?",
      "gen: Random Event",
      "  + Actions 1: @[[Actions Meaning]]#action-01 d100=13 -> Betray",
    ].join("\n");
    const [row] = rowsFor(body);
    expect(row.label).toBe("Actions 1");
    expect(row.content).toBe("d100=13 -> Betray"); // ref stripped from display
    expect(row.source).toContain("@[[Actions Meaning]]#action-01"); // ref kept for resolution
  });

  it("leaves a line that merely links (no die after the ref) untouched", () => {
    const body = ["gen: G", "  + Generate a Random Event: @[[Random Event]]#random-event (roll it)"].join("\n");
    expect(rowsFor(body)[0].content).toBe("@[[Random Event]]#random-event (roll it)");
  });
});

describe("verbatim-repeated lines are edited by occurrence", () => {
  const line = "? Rolling on the List [Characters@ r1=3 r2=1]";
  const content = ["```rpg log", line, line, "```"].join("\n");

  it("numbers each row against its source text", () => {
    const rows = buildSidebarItems(groupIntoProse(parseLonelog([line, line].join("\n"))))
      .flatMap((i) => i.rows)
      .filter((r) => r.source);
    expect(rows.map((r) => r.sourceNth)).toEqual([0, 1]);
  });

  it("edits ONLY the named occurrence, leaving its twin alone", () => {
    // Without `nth` a text match would rewrite both lines, so the two draws'
    // dice moved in lockstep.
    const out = applyTokenEdits(content, [
      { line, from: "[Characters@ r1=3 r2=1]", to: "[Characters@ r1=9 r2=1]", nth: 1 },
    ]);
    expect(out.split("\n")[1]).toContain("r1=3");
    expect(out.split("\n")[2]).toContain("r1=9");
  });

  it("defaults to the first occurrence when `nth` is omitted", () => {
    const out = applyTokenEdits(content, [{ line, from: "r1=3", to: "r1=9" }]);
    expect(out.split("\n")[1]).toContain("r1=9");
    expect(out.split("\n")[2]).toContain("r1=3");
  });
});

describe("list draw pills — each roll says what it selects", () => {
  const decls = (n: number) => ({
    Threads: { name: "Threads", default: "Any Thread", entries: Array.from({ length: n }, (_, i) => `T${i + 1}`) },
  });
  const dice = (body: string, n: number) => {
    const entries = parseLonelog(body);
    return buildSidebarItems(groupIntoProse(entries), undefined, resolveListOps(entries, decls(n)))
      .flatMap((i) => i.rows)
      .flatMap((r) => r.pills)
      .find((p) => p.dice)?.dice;
  };

  it("labels a lone roll as the ROW, not the section", () => {
    // A list inside one section needs no section roll — mislabelling it "sec"
    // would tell the reader to roll something the sheet never asks for.
    expect(dice("? Rolling [Threads@ r1=3]", 3)).toEqual([{ sides: 10, value: 3, label: "row" }]);
  });

  it("labels a two-roll draw section-then-row", () => {
    expect(dice("? Rolling [Threads@ r1=3 r2=1]", 8)).toEqual([
      { sides: 4, value: 3, label: "sec" },
      { sides: 10, value: 1, label: "row" },
    ]);
  });
});
