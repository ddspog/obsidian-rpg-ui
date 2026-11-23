import { describe, expect, it } from "vitest";

import {
  appendToLog,
  catalogRefOf,
  currentScene,
  encounterTagsIn,
  foeLines,
  foesText,
  formatEncounterTag,
  parseEncounterTag,
  preparedEncounters,
  removePrepared,
} from "./prepared-encounter";

const LINK = "[[gm-tools/encounter-catalog/ashen-four#^forests-t1-9-8-baboon|8 Baboons]]";
const PREPARED = `[Enc:${LINK}|8 [[Baboon]]|prepared]`;

describe("the [Enc:] tag", () => {
  it("reads and writes the link, the foes and the state", () => {
    const tag = parseEncounterTag(`${LINK}|8 [[Baboon]]; [[Wolf, Dire]]|fought S02`);
    expect(tag).toEqual({
      link: LINK,
      target: "gm-tools/encounter-catalog/ashen-four#^forests-t1-9-8-baboon",
      name: "8 Baboons",
      foes: "8 [[Baboon]]; [[Wolf, Dire]]",
      state: "fought",
      scene: "S02",
    });
    expect(formatEncounterTag(tag!)).toBe(`[Enc:${LINK}|8 [[Baboon]]; [[Wolf, Dire]]|fought S02]`);
    expect(formatEncounterTag({ link: LINK, foes: "8 [[Baboon]]", state: "prepared" })).toBe(PREPARED);
    expect(parseEncounterTag("no link here")).toBeNull();
  });

  it("finds the catalog note and entry a link points at", () => {
    expect(catalogRefOf("gm-tools/encounter-catalog/ashen-four#^forests-t1-9-8-baboon")).toEqual({
      note: "gm-tools/encounter-catalog/ashen-four",
      id: "forests-t1-9-8-baboon",
    });
    expect(catalogRefOf("Baboon")).toBeNull();
  });
});

describe("preparedEncounters", () => {
  it("lists what was prepared, marking those a later fight used", () => {
    const wolf = "[Enc:[[c#^wolf|Dire Wolf]]|[[Wolf, Dire]]|prepared]";
    const log = [
      PREPARED,
      wolf,
      "Some prose.",
      `? Combat begins with no one surprised. [F:[[Baboon]] 1|HP 9] [Enc:${LINK}|8 [[Baboon]]|fought S02]`,
    ].join("\n");
    expect(encounterTagsIn(log)).toHaveLength(3);
    const found = preparedEncounters(log);
    expect(found.map((p) => [p.name, p.fought, p.foughtIn])).toEqual([
      ["8 Baboons", true, "S02"],
      ["Dire Wolf", false, undefined],
    ]);
  });
});

describe("foes", () => {
  it("expands counts into one numbered line a foe, and writes a catalog entry's monsters", () => {
    expect(foeLines("3 [[Baboon]]; [[Wolf, Dire]]")).toEqual([
      "[[Baboon]] 1",
      "[[Baboon]] 2",
      "[[Baboon]] 3",
      "[[Wolf, Dire]]",
    ]);
    expect(
      foesText([
        { link: "Baboon", count: 8 },
        { link: "Wolf, Dire", count: 1 },
      ])
    ).toBe("8 [[Baboon]]; [[Wolf, Dire]]");
  });
});

describe("writing the log", () => {
  const note = ["---", "pcs: []", "---", "```rpg log", "=> S01 Road", "Prose.", "", "```", "after"].join("\n");

  it("appends a line at the end of the rpg log block, before trailing blanks", () => {
    expect(appendToLog(note, PREPARED)).toBe(
      ["---", "pcs: []", "---", "```rpg log", "=> S01 Road", "Prose.", PREPARED, "", "```", "after"].join("\n")
    );
    expect(appendToLog("no log here", PREPARED)).toBeNull();
  });

  it("takes a prepared line back out", () => {
    const withIt = appendToLog(note, PREPARED)!;
    expect(removePrepared(withIt, "gm-tools/encounter-catalog/ashen-four#^forests-t1-9-8-baboon")).toBe(note);
    expect(removePrepared(note, "x#^y")).toBeNull();
  });
});

describe("currentScene", () => {
  it("is the last scene line's number", () => {
    expect(currentScene("=> S01 Road\nProse\n=> S02 Ambush\nmore")).toBe("S02");
    expect(currentScene("no scene")).toBeUndefined();
  });
});

describe("a fight started from a prepared encounter", () => {
  it("carries the fought tag on its opening line, and the prose shows the prepared line as fought", async () => {
    const { startCombatText } = await import("./start-combat");
    const { assembleProse } = await import("./prose-model");
    const { groupIntoProse } = await import("./prose-grouper");
    const { parseLonelog } = await import("../lonelog/parser");
    const fought = formatEncounterTag({ link: LINK, foes: "8 [[Baboon]]", state: "fought", scene: "S02" });
    const block = startCombatText({
      question: "Combat begins with no one surprised.",
      combatants: [{ name: "[[Baboon]] 1", foe: true, hp: 9, face: 10, modifier: 2 }],
      encounter: fought,
    });
    expect(block.split("\n")[0]).toBe(`? Combat begins with no one surprised. [F:[[Baboon]] 1|HP 9] ${fought}`);
    const scenes = assembleProse(groupIntoProse(parseLonelog(`=> S02 Ambush\n${PREPARED}\n${block}`)));
    const nodes = scenes.flatMap((s) => s.nodes);
    expect(nodes.find((n) => n.kind === "prepared")).toMatchObject({
      kind: "prepared",
      name: "8 Baboons",
      fought: true,
      foughtIn: "S02",
    });
  });
});
