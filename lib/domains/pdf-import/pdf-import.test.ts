import { describe, expect, it } from "vitest";
import { toBlocks } from "./blocks";
import { emitBook, mender, spansToMd, wordsOf, type EmitContext } from "./emit";
import { fontName, isBold, isItalic } from "./extract";
import { layoutPage, findFurniture } from "./layout";
import { parseLooks } from "./llm";
import { lookFor } from "./looks";
import { ocrToRuns } from "./ocr";
import { readStyles } from "./styles";
import { isCatalog, planFromOutline, titleCase, toSections } from "./structure";
import {
  DEFAULT_OPTIONS,
  type Block,
  type Chapter,
  type FillRect,
  type RawPage,
  type Section,
  type TextRun,
} from "./types";

const BODY = "Verdigris-Rg";

/** A line of text as one run, about half an em a letter. */
function run(str: string, x: number, y: number, size = 10, font = BODY): TextRun {
  return { str, x, y, w: str.length * size * 0.5, size, font, bold: isBold(font), italic: isItalic(font) };
}

function page(runs: TextRun[], rects: FillRect[] = [], num = 1): RawPage {
  return { num, width: 612, height: 792, runs, images: [], rects };
}

/** Two columns of body text, `rows` lines each, from `top`. */
function twoColumns(rows: number, top = 100): TextRun[] {
  const runs: TextRun[] = [];
  for (let i = 0; i < rows; i++) {
    runs.push(run(`left column line number ${i} goes on a while`, 72, top + i * 12));
    runs.push(run(`right column line number ${i} goes on as well`, 324, top + i * 12));
  }
  return runs;
}

const texts = (p: RawPage) =>
  layoutPage(p).elements.flatMap((el) =>
    el.kind === "line" ? [el.line.cells.map((c) => c.spans.map((s) => s.text).join("")).join(" | ")] : [`<${el.kind}>`]
  );

describe("fonts", () => {
  it("reads weight and slant from a font's name", () => {
    expect(fontName("QVFYSW+VerdigrisMVBProText-Bd")).toBe("VerdigrisMVBProText-Bd");
    expect(isBold("VerdigrisMVBProText-Bd")).toBe(true);
    expect(isBold("SegoeUI-Semilight")).toBe(false);
    expect(isItalic("VerdigrisMVBProText-It")).toBe(true);
    expect(isItalic("SegoeUI-SemiboldItalic")).toBe(true);
    expect(isItalic("ModestoCondensed-Light")).toBe(false);
  });
});

describe("layout", () => {
  it("reads the left column before the right", () => {
    const out = texts(page(twoColumns(8)));
    expect(out[0]).toContain("left column line number 0");
    expect(out[7]).toContain("left column line number 7");
    expect(out[8]).toContain("right column line number 0");
  });

  it("lets a line across both columns split the page into bands", () => {
    const runs = [
      ...twoColumns(7, 100),
      run("A HEADING THAT RUNS ACROSS THE WHOLE WIDTH OF THE PAGE, GUTTER AND ALL", 72, 200, 14),
      ...twoColumns(7, 230),
    ];
    const out = texts(page(runs));
    const heading = out.findIndex((t) => t.startsWith("A HEADING"));
    expect(out.slice(0, heading).some((t) => t.includes("right column line number 6"))).toBe(true);
    expect(out[heading + 1]).toContain("left column line number 0");
  });

  it("keeps shaded rows together as a box, in the column they sit in", () => {
    const runs = twoColumns(8);
    const rects: FillRect[] = [
      { x: 72, y: 220, w: 228, h: 13, dark: true },
      { x: 72, y: 233, w: 228, h: 42, dark: false },
    ];
    runs.push(run("SCORE", 76, 230, 8), run("COST", 180, 230, 8));
    for (let i = 0; i < 3; i++)
      runs.push(run(String(8 + i), 76, 244 + i * 14, 8), run(String(i), 180, 244 + i * 14, 8));
    const out = texts(page(runs, rects));
    const box = out.indexOf("<box>");
    expect(box).toBe(8);
    expect(out[box + 1]).toContain("right column");
  });

  it("drops running heads and page numbers", () => {
    const pages = Array.from({ length: 6 }, (_, i) =>
      page([...twoColumns(8), run("PLAYER'S GUIDE", 72, 775, 12), run(String(i + 1), 40, 775, 12)], [], i + 1)
    );
    const furniture = findFurniture(pages);
    const { elements } = layoutPage(pages[2], { furniture });
    const all = elements.flatMap((el) => (el.kind === "line" ? el.line.cells.map((c) => c.spans[0].text) : []));
    expect(all).not.toContain("PLAYER'S GUIDE");
    expect(all).not.toContain("3");
  });
});

describe("blocks", () => {
  const blocksOf = (runs: TextRun[], rects: FillRect[] = []): Block[] => {
    const { elements } = layoutPage(page(runs, rects));
    return toBlocks(elements, { styles: readStyles(elements) });
  };
  const filler = (top: number, n: number) =>
    Array.from({ length: n }, (_, i) =>
      run("Plain body text that fills the line all the way across it.", 72, top + i * 12)
    );

  it("types headings, paragraphs and lists", () => {
    const runs = [
      run("Leveling Up", 72, 100, 26, "Modesto-Light"),
      ...filler(120, 3),
      run("A new paragraph starts with an indent and runs", 77, 156),
      run("on to a second line at the margin.", 72, 168),
      run("• First thing to do", 77, 190),
      run("• Second thing, which is long enough to wrap onto", 77, 202),
      run("another line", 86, 214),
      run("Awarding XP", 72, 250, 26, "Modesto-Light"),
      ...filler(270, 3),
    ];
    const blocks = blocksOf(runs);
    expect(blocks.map((b) => b.type)).toEqual(["heading", "para", "para", "list", "heading", "para"]);
    const list = blocks[3] as Extract<Block, { type: "list" }>;
    expect(list.items).toHaveLength(2);
    expect(list.items[1].map((s) => s.text).join("")).toBe(
      "Second thing, which is long enough to wrap onto another line"
    );
  });

  it("reads a shaded box of aligned cells as a table with its caption", () => {
    const rects: FillRect[] = [
      { x: 72, y: 220, w: 228, h: 13, dark: true },
      { x: 72, y: 233, w: 228, h: 42, dark: false },
    ];
    const runs = [...filler(100, 6), run("POINT-BUY COST", 72, 214, 7, "Segoe")];
    runs.push(run("SCORE", 76, 230, 8), run("COST", 180, 230, 8));
    for (let i = 0; i < 3; i++)
      runs.push(run(String(8 + i), 76, 244 + i * 14, 8), run(String(i), 180, 244 + i * 14, 8));
    const table = blocksOf(runs, rects).find((b) => b.type === "table") as Extract<Block, { type: "table" }>;
    expect(table.caption).toBe("POINT-BUY COST");
    expect(table.rows).toEqual([
      ["SCORE", "COST"],
      ["8", "0"],
      ["9", "1"],
      ["10", "2"],
    ]);
  });

  it("reads a shaded box of prose as a sidebar with its title", () => {
    const rects: FillRect[] = [{ x: 72, y: 200, w: 228, h: 80, dark: false }];
    const runs = [
      ...filler(100, 6),
      run("ABOUT THOSE DICE", 80, 216, 12, "Modesto"),
      run("The game uses polyhedral dice to resolve", 80, 232, 9, "Segoe-Semilight"),
      run("actions. These dice are abbreviated in game text.", 80, 244, 9, "Segoe-Semilight"),
    ];
    const side = blocksOf(runs, rects).find((b) => b.type === "side") as Extract<Block, { type: "side" }>;
    expect(side.title).toBe("ABOUT THOSE DICE");
    expect(side.blocks).toHaveLength(1);
  });
});

describe("structure", () => {
  it("title-cases headings set in capitals and leaves the rest", () => {
    expect(titleCase("STEP 2. CHOOSE A CLASS")).toBe("Step 2. Choose a Class");
    expect(titleCase("CALCULATING ARMOR CLASS (AC)")).toBe("Calculating Armor Class (AC)");
    expect(titleCase("What Is a Spell?")).toBe("What Is a Spell?");
  });

  it("plans chapters from bookmarks, numbering from 00 for an introduction", () => {
    const plans = planFromOutline(
      [
        { title: "Introduction", page: 9, depth: 0 },
        { title: "How to Play", page: 10, depth: 1 },
        { title: "Character Classes", page: 22, depth: 0 },
        { title: "Appendix A: Conditions", page: 300, depth: 0 },
        { title: "Index", page: 310, depth: 0 },
        { title: "Blank Page", page: 2, depth: 0 },
      ],
      1,
      320
    );
    expect(plans.map((p) => `${p.number}|${p.title}|${p.firstPage}-${p.lastPage}${p.skip ? "|skip" : ""}`)).toEqual([
      "|Front Matter|1-8",
      "00|Introduction|9-21",
      "01|Character Classes|22-299",
      "|Appendix A: Conditions|300-309",
      "|Index|310-320|skip",
    ]);
  });

  it("nests headings by rank and knows a list of entries from a run of steps", () => {
    const h = (text: string, level: number): Block => ({ type: "heading", level, text, page: 1, style: `s${level}` });
    const p: Block = { type: "para", spans: [{ text: "x", bold: false, italic: false }], page: 1 };
    const names = ["Acid Arrow", "Aid", "Bane", "Bless", "Charm", "Dispel", "Fly", "Gust"];
    const root = toSections([h("Spells", 1), p, ...names.flatMap((n) => [h(n, 2), p]), h("Rituals", 1), p], "Magic", 1);
    expect(root.children.map((c) => c.title)).toEqual(["Spells", "Rituals"]);
    expect(isCatalog(root.children[0], 8)).toBe(true);
    const steps = toSections(
      ["Gather", "Concept", "Class", "Abilities", "Lineage", "Heritage", "Background", "Equipment"].flatMap((n, i) => [
        h(`Step ${i}. ${n}`, 2),
        p,
      ]),
      "Creation",
      1
    );
    expect(isCatalog({ ...steps, children: [...steps.children].reverse() }, 8)).toBe(false);
  });
});

describe("emit", () => {
  const para = (text: string): Block => ({ type: "para", spans: [{ text, bold: false, italic: false }], page: 1 });
  const section = (title: string, level: number, blocks: Block[], children: Section[] = []): Section => ({
    title,
    level,
    style: `s${level}`,
    page: 1,
    blocks,
    children,
  });
  const ctxFor = (maxLines: number): EmitContext => ({
    book: "Book",
    source: "From **Book**.",
    options: { ...DEFAULT_OPTIONS, title: "Book", maxLines },
    look: lookFor,
    mend: (t) => t,
    files: [],
    tableIds: new Set(),
    names: new Set(),
  });
  const chapter = (root: Section): Chapter => ({ title: root.title, number: "01", firstPage: 1, lastPage: 9, root });

  it("writes emphasis and mends words broken across lines", () => {
    const words = new Set<string>();
    wordsOf("A character is note-taking here", words);
    const mend = mender(words);
    expect(mend("char­acter and note­taking")).toBe("character and note-taking");
    expect(
      spansToMd(
        [
          { text: "Range: ", bold: true, italic: false },
          { text: "30 feet of ", bold: false, italic: false },
          { text: "Monster Vault", bold: false, italic: true },
        ],
        mend
      )
    ).toBe("**Range:** 30 feet of *Monster Vault*");
  });

  it("keeps a short chapter in one note, its sections as tabs with a table inside", () => {
    const many = Array.from({ length: 14 }, (_, i) => para(`Paragraph ${i}.`));
    const table: Block = {
      type: "table",
      caption: "COSTS",
      rows: [
        ["A", "B"],
        ["1", "2"],
      ],
      page: 1,
    };
    const root = section(
      "Rules",
      0,
      [para("Intro.")],
      [section("Dice", 1, [...many, table]), section("Checks", 1, many)]
    );
    const files = emitBook([chapter(root)], ctxFor(300), []);
    const note = files.find((f) => f.path === "01. Rules.md")?.text ?? "";
    expect(files.map((f) => f.path).sort()).toEqual(["01. Rules.md", "Book.md"]);
    expect(note).toContain("````rpg rule.tab\nname: Dice");
    expect(note).toContain("```rpg table.costs\n|A|B|\n|---|---|\n|1|2|\n[COSTS]\n```");
  });

  it("splits a long chapter into a folder of tab notes, and entries of a kind into a folder of their own", () => {
    const long = Array.from({ length: 30 }, (_, i) => para(`Paragraph ${i}.`));
    const spells = ["Acid Arrow", "Aid", "Bane", "Bless", "Charm", "Dispel", "Fly", "Gust", "Haste"].map((n) =>
      section(n, 2, long)
    );
    const root = section(
      "Magic",
      0,
      [para("Intro.")],
      [section("What Is a Spell?", 1, long), section("Spell Descriptions", 1, [], spells)]
    );
    const files = emitBook([chapter(root)], ctxFor(120), []);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("01. Magic/01. What Is a Spell.md");
    expect(paths).toContain("01. Magic/02. Spell Descriptions/Acid Arrow.md");
    expect(files.find((f) => f.path === "01. Magic.md")?.text).toContain("`@[[Book/01. Magic/]].shallow().tab()`");
    expect(files.find((f) => f.path === "01. Magic/02. Spell Descriptions.md")?.text).toContain(
      "`@[[Book/01. Magic/02. Spell Descriptions/]].shallow().tab()`"
    );
  });
});

describe("model step and OCR", () => {
  it("keeps only the picks a model got right", () => {
    const titles = ["Spellcasting", "Equipment", "Odd"];
    const looks = parseLooks('Sure: {"1":"sparkles purple","2":"backpack teal","3":"nope red","9":"map red"}', titles);
    expect([...looks.entries()]).toEqual([["Spellcasting", { icon: "sparkles", color: "var(--color-purple)" }]]);
  });

  it("turns OCR's words into runs in page points", () => {
    const word = (text: string, x0: number, confidence = 95) => ({
      text,
      confidence,
      bbox: { x0, y0: 100, x1: x0 + 50, y1: 125 },
    });
    const runs = ocrToRuns(
      {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [word("Safety", 250), word("tools", 320), word("x", 400, 20)],
                    bbox: { x0: 250, y0: 100, x1: 370, y1: 125 },
                    baseline: { x0: 250, y0: 120, x1: 370, y1: 120 },
                  },
                ],
              },
            ],
          },
        ],
      },
      2.5
    );
    expect(runs.map((r) => r.str)).toEqual(["Safety", "tools"]);
    expect(runs[0].x).toBe(100);
    expect(runs[0].y).toBe(48);
  });
});
