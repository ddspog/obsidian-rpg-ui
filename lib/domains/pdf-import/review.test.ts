import { describe, expect, it } from "vitest";
import {
  buildReview,
  ranges,
  renderReview,
  reviewBlocks,
  reviewCounts,
  tableReviews,
  type ReviewInput,
} from "./review";
import type { Block, OutFile } from "./types";

const note = (path: string, ...tables: string[]): OutFile => ({ path, text: `# ${path}\n\n${tables.join("\n\n")}\n` });
const table = (id: string, rows: string[], caption?: string) =>
  ["```rpg table." + id, rows[0], "|---|---|", ...rows.slice(1), ...(caption ? [`[${caption}]`] : []), "```"].join(
    "\n"
  );

const input = (files: OutFile[], more: Partial<ReviewInput> = {}): ReviewInput => ({
  files,
  root: "Book",
  tablePages: new Map([
    ["monsters", 12],
    ["piece", 13],
  ]),
  textItems: [],
  contentsMissing: [],
  ocrPages: [],
  kept: [],
  chapters: { count: 3, from: "bookmarks", pages: 100 },
  ...more,
});

describe("review", () => {
  it("writes runs of numbers short", () => {
    expect(ranges([1, 2, 3, 5, 8, 9])).toBe("1–3, 5, 8–9");
  });

  it("writes into a table what keeps it from being rolled, and a piece of one", () => {
    const gaps = tableReviews(
      [
        ["d6", "Monster"],
        ["1", "Orc"],
        ["2", "Ogre"],
        ["3", "Troll"],
        ["5", "Hag"],
        ["6", "Lich"],
      ],
      12,
      "Table 2-1: Monsters"
    );
    expect(gaps).toEqual([expect.objectContaining({ severity: "fix", kind: "table-numbers", off: ["roll"] })]);
    expect(gaps[0].message).toContain("no row for 4 of the d6 (the book's PDF page 12)");
    const piece = tableReviews(
      [
        ["4", "Goblin"],
        ["5", "Kobold"],
      ],
      13
    );
    expect(piece).toEqual([expect.objectContaining({ severity: "fix", kind: "table-fragment" })]);
    expect(
      tableReviews(
        [
          ["d4", "M"],
          ["1", "a"],
          ["2", "b"],
          ["3", "c"],
          ["4", "d"],
        ],
        1
      )
    ).toEqual([]);
  });

  it("gathers the review from the lines in the blocks, with their note, table and page", () => {
    const files = [
      note(
        "01. Monsters.md",
        table(
          "monsters",
          ["# @review fix/table-numbers roll: No row for 4 of the d6.", "|d6*|Monster|", "|1|Orc|"],
          "Table 2-1: Monsters"
        ),
        "```rpg stat.monster\n# @review fix/entity-incomplete: The ability scores could not be read.\nname: Orc\n```"
      ),
    ];
    const items = buildReview(input(files));
    expect(items.map((i) => [i.kind, i.severity, i.note, i.table ?? i.block, i.page])).toEqual([
      ["table-numbers", "fix", "Book/01. Monsters", "monsters", 12],
      ["entity-incomplete", "fix", "Book/01. Monsters", "stat.monster", undefined],
    ]);
  });

  it("lists contents not found, OCR pages and a book with no chapters, worst first", () => {
    const files = [
      note(
        "01. Monsters.md",
        table(
          "monsters",
          ["# @review check/row-widened: Row 2 was widened to 2-3.", "|d4*|Monster|", "|1|Orc|"],
          "Table 2-1: Monsters"
        )
      ),
    ];
    const items = buildReview(
      input(files, {
        contentsMissing: [{ title: "Lost Section", page: 40 }],
        ocrPages: [3, 4, 5, 9],
        chapters: { count: 1, from: "one", pages: 300 },
      })
    );
    expect(items[0]).toMatchObject({ kind: "chapters", severity: "fix" });
    expect(items.find((i) => i.kind === "row-widened")).toMatchObject({
      note: "Book/01. Monsters",
      table: "monsters",
      page: 12,
    });
    expect(items.find((i) => i.kind === "ocr-page")?.message).toContain("3–5, 9");
    expect(reviewCounts(items)).toMatchObject({ fix: 1, check: 3 });
    const md = renderReview(items, "Book", "From **Book**.");
    expect(md).toContain("- [ ] [[Book/01. Monsters|01. Monsters]] · p. 12:");
    expect(md).toContain("## Contents entries not found (1)");
  });

  it("finds text that counts up like a table, and a heading that opens with a number", () => {
    const para = (text: string): Block => ({ type: "para", spans: [{ text, bold: false, italic: false }], page: 7 });
    const blocks: Block[] = [
      para("1 Orc"),
      para("2 Ogre"),
      para("3 Troll"),
      { type: "heading", level: 3, text: "4 Goblin chief", page: 7, style: "h" },
    ];
    expect(reviewBlocks(blocks, "Monsters").map((i) => i.kind)).toEqual(["text-like-table", "row-as-heading"]);
  });
});
