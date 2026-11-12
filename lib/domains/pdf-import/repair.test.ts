import { describe, expect, it } from "vitest";
import { dieFor, repairTables, rowsFromText } from "./repair";
import type { Block } from "./types";

type TableBlock = Extract<Block, { type: "table" }>;

const table = (rows: string[][], caption?: string, page = 1): TableBlock => ({ type: "table", rows, caption, page });
const para = (text: string, page = 1): Block => ({ type: "para", spans: [{ text, bold: false, italic: false }], page });
const numbers = (b: Block) => (b as TableBlock).rows.slice(1).map((r) => r[0]);

describe("repair", () => {
  it("reads rows set as a paragraph, the number opening them or set against their middle", () => {
    expect(rowsFromText("**4** A cult of the deity has developed.", 4)).toEqual([
      ["4", "A cult of the deity has developed."],
    ]);
    expect(rowsFromText("It was driven here 5 just a moment ago.", 5)).toEqual([
      ["5", "It was driven here just a moment ago."],
    ]);
    expect(rowsFromText("**30** Sudden change **31** Abandoned mine", 30)).toEqual([
      ["30", "Sudden change"],
      ["31", "Abandoned mine"],
    ]);
    // Another table named in the text is not a row's number; a number out of the count is not one either.
    expect(rowsFromText("Deity + Situation. Refer to Tables 7-32 and 7-33: Deity 10 Activity", 10)?.[0][0]).toBe("10");
    expect(rowsFromText("Roll 3 times on it.", 5)).toBeNull();
  });

  it("knows the die from the header, else from the numbers", () => {
    expect(
      dieFor(
        table([
          ["Die Roll", "Mission (d100)"],
          ["01-50", "a"],
          ["51-75", "b"],
        ])
      )
    ).toBe(100);
    expect(
      dieFor(
        table([
          ["#", "Thing"],
          ["1", "a"],
          ["2", "b"],
          ["5", "c"],
        ])
      )
    ).toBe(6);
  });

  it("puts a table's rest back from further on: a table without a caption, and rows read as text", () => {
    const blocks: Block[] = [
      table(
        [
          ["d6", "Activity"],
          ["1", "a"],
          ["2", "b"],
          ["3", "c"],
        ],
        "Table 7-5: Deity Activity",
        1
      ),
      para("Table 7-5: Deity Activity continued", 2),
      para("**4** d", 2),
      table(
        [
          ["d6", "Activity"],
          ["5", "e"],
          ["6", "f"],
        ],
        undefined,
        2
      ),
      table(
        [
          ["d4", "Other"],
          ["1", "x"],
          ["2", "y"],
          ["3", "z"],
        ],
        "Table 7-6: Other",
        2
      ),
    ];
    const report = repairTables(blocks);
    expect(numbers(blocks[0])).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(blocks.filter((b) => b.type === "table")).toHaveLength(2);
    expect(report.joined).toBe(2);
  });

  it("reads a table's first rows back from short lines above it, and names it by the caption over them", () => {
    const blocks: Block[] = [
      { type: "heading", level: 9, text: "Table 14-19: Iconic Humanoid Species", page: 3, style: "c", caption: true },
      { type: "heading", level: 4, text: "1 Goblin", page: 3, style: "h" },
      para("2 Kobold", 3),
      table(
        [
          ["d4", "Iconic Species"],
          ["3", "Orc"],
          ["4", "Gnoll"],
        ],
        "1 Goblin",
        3
      ),
    ];
    repairTables(blocks);
    const t = blocks.find((b) => b.type === "table") as TableBlock;
    expect(t.rows.slice(1)).toEqual([
      ["1", "Goblin"],
      ["2", "Kobold"],
      ["3", "Orc"],
      ["4", "Gnoll"],
    ]);
    expect(t.caption).toBe("Table 14-19: Iconic Humanoid Species");
    expect(blocks).toHaveLength(2);
  });

  it("folds a wrapped cell's lines back into their row, and widens a row over a number the book skips", () => {
    const t = table([
      ["d10", "Result"],
      ["1-4", "Small dungeon"],
      ["", "found."],
      ["5-8", "Camp"],
      ["10", "Storm"],
    ]);
    const report = repairTables([t]);
    expect(t.rows.slice(1)).toEqual([
      ["1-4", "Small dungeon found."],
      ["5-9", "Camp"],
      ["10", "Storm"],
    ]);
    expect(report).toMatchObject({ joined: 0, folded: 1, widened: 1 });
    expect(report.changes).toEqual([
      expect.objectContaining({ kind: "widened", from: "5-8", to: "5-9", text: expect.stringContaining("no row 9") }),
    ]);
  });
});
