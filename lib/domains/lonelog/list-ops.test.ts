import { describe, it, expect } from "vitest";
import {
  collectLists,
  consultDice,
  consultEntry,
  consultName,
  consultSlot,
  listSheet,
  pairedIndex,
  resolveConsult,
  resolveListOps,
} from "./list-ops";
import { parseLonelog } from "./parser";
import type { GMFeature } from "../features/types";

describe("collectLists", () => {
  it("registers each feature's `list:` aspect by name, first wins", () => {
    const features: GMFeature[] = [
      { name: "Characters", list: { default: "a new NPC" } },
      { name: "Threads", list: { name: "Threads", default: "a fresh thread", entries: ["Escape the island"] } },
      { name: "Characters (dup)", list: { name: "Characters", default: "OTHER" } }, // loses to the first
      { name: "Not a list", oracle: { question: "?", roll: "d100" } as GMFeature["oracle"] },
    ];
    const lists = collectLists(features);
    expect(Object.keys(lists).sort()).toEqual(["Characters", "Threads"]);
    expect(lists.Characters).toMatchObject({ name: "Characters", default: "a new NPC", entries: [] });
    // Sheet geometry defaults to Mythic's 25 slots in sections of 5.
    expect(lists.Characters).toMatchObject({ section: 5, max: 25 });
    expect(lists.Threads.entries).toEqual(["Escape the island"]);
  });

  it("falls back to the feature name when `list.name` is absent", () => {
    expect(collectLists([{ name: "Factions", list: { default: "a rival faction" } }]).Factions.name).toBe("Factions");
  });
});

describe("consultName", () => {
  it("extracts the list name from either read token", () => {
    expect(consultName("[Characters?]")).toBe("Characters"); // inspect
    expect(consultName("[Characters@]")).toBe("Characters"); // roll
    expect(consultName("[Long Threads?]")).toBe("Long Threads");
  });

  it("returns null for non-consult refs", () => {
    expect(consultName("@[[Characters]]")).toBeNull();
    expect(consultName("[Characters+ Bertha]")).toBeNull();
    expect(consultName("just text")).toBeNull();
  });
});

describe("resolveConsult", () => {
  const lists = { Characters: { name: "Characters", default: "Any Character", entries: [] } };

  it("resolves a consult to the list's default line body", () => {
    expect(resolveConsult("[Characters?]", lists)).toBe("Characters: Any Character");
  });

  it("returns null when the ref isn't a consult or the list is unknown", () => {
    expect(resolveConsult("@[[Characters]]", lists)).toBeNull();
    expect(resolveConsult("[Threads?]", lists)).toBeNull();
    expect(resolveConsult("[Characters?]", undefined)).toBeNull();
  });
});

describe("resolveListOps — running entries", () => {
  const decls = {
    Characters: { name: "Characters", default: "Any Character", entries: [] as string[] },
    Threads: { name: "Threads", default: "Any Thread", entries: ["Find the stone"] },
  };
  const fold = (body: string) => resolveListOps(parseLonelog(body), decls);

  it("adds entries and reports the running count", () => {
    const ops = fold(["=> A rat. [Characters+ Giant rats]", "=> Bertha. [Characters+ Bertha]"].join("\n"));
    const flat = [...ops.values()].flat();
    expect(flat).toHaveLength(2);
    expect(flat[0]).toMatchObject({ name: "Characters", op: "add", entry: "Giant rats", count: 1 });
    expect(flat[1]).toMatchObject({ name: "Characters", op: "add", entry: "Bertha", count: 2 });
  });

  it("removes an entry, and a remove of an absent entry is a no-op", () => {
    const ops = fold(["=> Found. [Threads- Find the stone]", "=> Nothing. [Threads- Not there]"].join("\n"));
    expect([...ops.values()].flat().map((o) => o.count)).toEqual([0, 0]);
  });

  it("rolls a live entry, and falls back to the default once emptied", () => {
    const ops = fold(
      [
        "=> A rat. [Characters+ Giant rats]",
        "? Who? [Characters@]",
        "=> Found. [Threads- Find the stone]",
        "? Which? [Threads@]",
      ].join("\n")
    );
    const rolls = [...ops.values()].flat().filter((o) => o.op === "roll");
    expect(rolls[0].entry).toBe("Giant rats"); // a live entry
    expect(rolls[1].entry).toBe("Any Thread"); // seeded entry removed → default
  });

  it("`[Name?]` INSPECTS — the whole list, not one entry", () => {
    const ops = fold(
      ["=> A rat. [Characters+ Giant rats]", "=> Bertha. [Characters+ Bertha]", "? Who's around? [Characters?]"].join(
        "\n"
      )
    );
    const inspect = [...ops.values()].flat().find((o) => o.op === "inspect");
    expect(inspect).toMatchObject({ op: "inspect", entry: "Giant rats, Bertha", count: 2 });
  });

  it("ignores ops naming an undeclared list", () => {
    expect([...fold("=> x. [Factions+ The Guild]").values()].flat()).toEqual([]);
  });

  it("does not confuse a resource op for a list op", () => {
    expect([...fold("=> Chaos rises. [CF+1]").values()].flat()).toEqual([]);
  });
});

describe("consultEntry", () => {
  const decl = { name: "Characters", default: "Any Character", entries: [] as string[] };

  it("returns the declared default when the list is empty", () => {
    expect(consultEntry(decl, [])).toBe("Any Character");
  });

  it("indexes the 1-based SHEET SLOT; a slot past the last entry is void", () => {
    const live = ["A", "B", "C"];
    expect(consultEntry(decl, live, 1)).toBe("A");
    expect(consultEntry(decl, live, 3)).toBe("C");
    expect(consultEntry(decl, live, 4)).toBe("Any Character"); // void cell, not a wrap
  });
});

describe("rolled selection — `[Name@ …]`", () => {
  const decls = { Characters: { name: "Characters", default: "Any Character", entries: ["Bertha", "Tocky"] } };
  const fold = (body: string) => [...resolveListOps(parseLonelog(body), decls).values()].flat();

  it("bakes the picked entry and keeps it across re-resolves", () => {
    const [op] = fold("? And now? [Characters@ Tocky]");
    expect(op).toMatchObject({ name: "Characters", op: "roll", entry: "Tocky", rolled: true });
  });

  it("offers the live entries as picker options", () => {
    expect(fold("? Who acts? [Characters@]")[0].options).toEqual(["Bertha", "Tocky"]);
  });

  it("offers the default as the only option when the list is empty", () => {
    const empty = { Threads: { name: "Threads", default: "Any Thread", entries: [] as string[] } };
    const op = [...resolveListOps(parseLonelog("? Which? [Threads@]"), empty).values()].flat()[0];
    expect(op.options).toEqual(["Any Thread"]);
    expect(op.entry).toBe("Any Thread");
  });

  it("a bare `[Name@]` is unrolled — it shows a live entry, not a blank", () => {
    expect(fold("? Who? [Characters@]")[0].entry).toBe("Bertha");
  });
});

describe("Mythic list sheet — sectioned consult rolls", () => {
  const decl = { name: "Characters", default: "Any Character", entries: [] as string[] };

  it("scales the section die to the entry count (sheet: d4/d6/d8/d10)", () => {
    const dice = (n: number) => consultDice(decl, n).section;
    expect([1, 5].map(dice)).toEqual([null, null]); // one section → no section roll
    expect([6, 10].map(dice)).toEqual([4, 4]);
    expect([11, 15].map(dice)).toEqual([6, 6]);
    expect([16, 20].map(dice)).toEqual([8, 8]);
    expect([21, 25].map(dice)).toEqual([10, 10]);
  });

  it("always rows with a d10 (five rows read in pairs)", () => {
    expect(consultDice(decl, 25).row).toBe(10);
    expect([1, 2, 9, 10].map(pairedIndex)).toEqual([1, 1, 5, 5]);
  });

  it("addresses a slot as (section-1)×5 + row", () => {
    expect(consultSlot(decl, 3, 7)).toBe(9); // §2, row 4
    expect(consultSlot(decl, 1, 1)).toBe(1);
    expect(consultSlot(decl, 9, 9)).toBe(25); // last cell
    expect(consultSlot(decl, null, 10)).toBe(5); // single section → row only
  });

  it("returns the default when the roll lands on a VOID cell", () => {
    const live = ["A", "B", "C"];
    expect(consultEntry({ ...decl, entries: live }, live, 9)).toBe("Any Character");
    expect(consultEntry({ ...decl, entries: live }, live, 2)).toBe("B");
  });

  it("resolves `[Name@ r1=3 r2=7]` through the fold to the slot's entry", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `E${i + 1}`);
    const decls = { Characters: { ...decl, entries: nine } };
    const op = [...resolveListOps(parseLonelog("? Who? [Characters@ r1=3 r2=7]"), decls).values()].flat()[0];
    expect(op).toMatchObject({ entry: "E9", slot: 9, rolls: [3, 7] });
  });

  it("an explicit `@ entry` pick still overrides the dice", () => {
    const decls = { Characters: { ...decl, entries: ["A", "B"] } };
    const op = [...resolveListOps(parseLonelog("? Who? [Characters@ Tocky]"), decls).values()].flat()[0];
    expect(op.entry).toBe("Tocky");
  });
});

describe("same-line list ops — `;` shorthand + merging", () => {
  const decls = {
    Characters: { name: "Characters", default: "Any Character", entries: [] as string[] },
    Threads: { name: "Threads", default: "Any Thread", entries: [] as string[] },
  };
  const fold = (body: string) => [...resolveListOps(parseLonelog(body), decls).values()].flat();

  it("merges repeated same-list ops on one line into a single change", () => {
    const ops = fold("? Adding a value [Characters+ A Mouse][Characters+ Brian]");
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ name: "Characters", op: "add", entries: ["A Mouse", "Brian"], count: 2 });
  });

  it("treats `[Name+ a; b]` as EXACTLY equivalent to two separate ops", () => {
    expect(fold("? Adding a value [Characters+ A Mouse; Brian]")).toEqual(
      fold("? Adding a value [Characters+ A Mouse][Characters+ Brian]")
    );
  });

  it("keeps DIFFERENT lists apart", () => {
    const ops = fold("? Mixed [Characters+ A Mouse][Threads+ Escape the island]");
    expect(ops.map((o) => o.name)).toEqual(["Characters", "Threads"]);
  });

  it("keeps different OPS on the same list apart", () => {
    const ops = fold("? Add then draw [Characters+ A Mouse][Characters@]");
    expect(ops.map((o) => o.op)).toEqual(["add", "roll"]);
  });

  it("merges removals too, reporting the count after all of them", () => {
    const seeded = { Characters: { ...decls.Characters, entries: ["A", "B", "C"] } };
    const ops = [...resolveListOps(parseLonelog("=> Gone. [Characters- A][Characters- B]"), seeded).values()].flat();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "remove", entries: ["A", "B"], count: 1 });
  });
});

describe("entry separator — `;` not `,`", () => {
  const decls = { Characters: { name: "Characters", default: "Any Character", entries: [] as string[] } };
  const fold = (body: string) => [...resolveListOps(parseLonelog(body), decls).values()].flat();

  it("keeps a comma INSIDE an entry intact", () => {
    // The whole reason the separator is `;`: names carry commas.
    const [op] = fold("=> A new ally. [Characters+ Bertha, the Angry Avian]");
    expect(op.entry).toBe("Bertha, the Angry Avian");
    expect(op.count).toBe(1);
  });

  it("splits on `;`, trimming each entry", () => {
    const [op] = fold("=> Two allies. [Characters+ Bertha, the Avian;  Ricky No-Thumb ]");
    expect(op.entries).toEqual(["Bertha, the Avian", "Ricky No-Thumb"]);
    expect(op.count).toBe(2);
  });
});

describe("positional rolls — the log records values, the list picks the dice", () => {
  const mk = (n: number) => ({
    Characters: {
      name: "Characters",
      default: "Any Character",
      entries: Array.from({ length: n }, (_, i) => `E${i + 1}`),
    },
  });
  const fold = (body: string, n: number) => [...resolveListOps(parseLonelog(body), mk(n)).values()].flat()[0];

  it("uses ONE roll when a single section covers the list", () => {
    const op = fold("? Who? [Characters@ r1=7]", 3);
    expect(op).toMatchObject({ slot: 4, rolls: [7] });
    expect(op.dice).toEqual({ section: null, row: 10 }); // no section die offered
  });

  it("uses section-then-row once the list spans several sections", () => {
    expect(fold("? Who? [Characters@ r1=3 r2=1]", 6)).toMatchObject({ slot: 6, entry: "E6" });
  });

  it("re-interprets the SAME recorded rolls as the list grows", () => {
    // The whole point of `r1`/`r2` over `d4`/`d10`: a draw logged at 6 entries
    // still addresses slot 6 at 12 entries — only the die SHAPE changes (d4→d6).
    const small = fold("? Who? [Characters@ r1=3 r2=1]", 6);
    const grown = fold("? Who? [Characters@ r1=3 r2=1]", 12);
    expect(grown.slot).toBe(small.slot);
    expect(grown.entry).toBe(small.entry);
    expect(small.dice?.section).toBe(4);
    expect(grown.dice?.section).toBe(6);
  });
});

describe("duplicate entries weight the draw", () => {
  const decls = { Characters: { name: "Characters", default: "Any Character", entries: [] as string[] } };
  const fold = (body: string) => [...resolveListOps(parseLonelog(body), decls).values()].flat();

  it("keeps every copy — a name written twice takes two slots", () => {
    const [add] = fold("? Stocking [Characters+ Wolf; Wolf; Wolf; Bear]");
    expect(add.count).toBe(4);
    expect(add.sheet?.entries).toEqual(["Wolf", "Wolf", "Wolf", "Bear"]);
  });

  it("removes exactly ONE copy per remove, so removes undo adds one-for-one", () => {
    const ops = fold(
      ["? Stock [Characters+ Wolf; Wolf; Wolf; Bear]", "? Thin [Characters- Wolf]", "? Thin [Characters- Wolf]"].join(
        "\n"
      )
    );
    expect(ops.map((o) => o.count)).toEqual([4, 3, 2]);
    expect(ops[2].sheet?.entries).toEqual(["Wolf", "Bear"]);
  });

  it("a weighted entry occupies several sheet slots", () => {
    const [add] = fold("? Stock [Characters+ Wolf; Wolf; Bear]");
    const slots = listSheet(decls.Characters, add.sheet!.entries)[0].rows;
    expect(slots.slice(0, 3).map((r) => r.entry)).toEqual(["Wolf", "Wolf", "Bear"]);
  });
});

describe("listSheet — the printed page", () => {
  const decl = { name: "Characters", default: "Any Character", entries: [] as string[] };

  it("lays out max/section sections of `section` rows", () => {
    const sheet = listSheet(decl, []);
    expect(sheet).toHaveLength(5);
    expect(sheet.every((s) => s.rows.length === 5)).toBe(true);
    const lastRows = sheet[sheet.length - 1].rows;
    expect(lastRows[lastRows.length - 1].slot).toBe(25);
  });

  it("labels each section with its die and paired range (first needs no roll)", () => {
    const sheet = listSheet(decl, []);
    expect(sheet.map((s) => s.die)).toEqual([null, 4, 6, 8, 10]);
    expect(sheet.map((s) => s.range)).toEqual(["1-2", "3-4", "5-6", "7-8", "9-10"]);
  });

  it("maps rows to paired ranges and marks unfilled slots void", () => {
    const sheet = listSheet(decl, ["A", "B"]);
    expect(sheet[0].rows.map((r) => r.range)).toEqual(["1-2", "3-4", "5-6", "7-8", "9-10"]);
    expect(sheet[0].rows[0]).toMatchObject({ slot: 1, entry: "A" });
    expect(sheet[0].rows[2].entry).toBeUndefined(); // void cell
  });

  it("agrees with the roll math — the sheet slot a roll addresses holds that entry", () => {
    const live = Array.from({ length: 9 }, (_, i) => `E${i + 1}`);
    const slot = consultSlot(decl, 3, 1); // §2, row 1 → slot 6
    const all = listSheet(decl, live).flatMap((s) => s.rows);
    expect(all.find((r) => r.slot === slot)!.entry).toBe("E6");
  });
});
