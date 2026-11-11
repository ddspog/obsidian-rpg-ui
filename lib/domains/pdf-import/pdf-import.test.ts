import { describe, expect, it } from "vitest";
import { toBlocks } from "./blocks";
import { emitBook, mender, spansToMd, wordsOf, type EmitContext } from "./emit";
import { itemsFromTable } from "./entities";
import { placer } from "./organise";
import { fontName, isBold, isItalic } from "./extract";
import { layoutPage, findFurniture } from "./layout";
import { parseLooks } from "./llm";
import { lookFor } from "./looks";
import { inkMeter, invertDarkBars, ocrToRuns } from "./ocr";
import { readStyles } from "./styles";
import {
  isCatalog,
  missingFromContents,
  planFromOutline,
  promoteNames,
  readContents,
  titleCase,
  toSections,
} from "./structure";
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

describe("entities", () => {
  const span = (text: string, bold = false, italic = false) => ({ text, bold, italic });
  const para = (...spans: ReturnType<typeof span>[]): Block => ({ type: "para", spans, page: 1 });
  const section = (title: string, level: number, blocks: Block[], children: Section[] = [], tag?: string): Section => ({
    title,
    tag,
    level,
    style: `s${level}`,
    page: 1,
    blocks,
    children,
  });
  const write = (root: Section) => {
    const ctx: EmitContext = {
      book: "Book",
      source: "From **Book**.",
      options: { ...DEFAULT_OPTIONS, title: "Book" },
      look: lookFor,
      mend: (t) => t,
      files: [],
      tableIds: new Set(),
      names: new Set(),
      kinds: new Map(),
    };
    const chapter: Chapter = { title: root.title, number: "01", firstPage: 1, lastPage: 9, root };
    const files = emitBook([chapter], ctx, []);
    return {
      files,
      kinds: Object.fromEntries(ctx.kinds ?? []),
      note: files.find((f) => f.path === "01. " + root.title + ".md")?.text ?? "",
    };
  };

  it("writes a spell's facts as an rpg spell block", () => {
    const acid = section("Acid Arrow", 2, [
      para(span("2nd-Circle Arcane (Evocation)", false, true)),
      para(span("Casting Time:", true), span(" 1 action")),
      para(span("Range:", true), span(" 90 feet")),
      para(span("Components:", true), span(" V, S, M (powdered rhubarb leaf, and an adder’s stomach)")),
      para(span("Duration:", true), span(" Instantaneous")),
      para(span("You launch a missile of acid toward your target.", false, true)),
      para(span("A shimmering green arrow streaks toward a target.")),
    ]);
    const { note, kinds } = write(section("Magic", 0, [], [section("Spells", 1, [], [acid])]));
    expect(kinds).toEqual({ spell: 1 });
    expect(note).toContain(
      [
        "```rpg spell",
        "circle: 2nd-Circle",
        "source:",
        '  - "[[Arcane]]"',
        "school: Evocation",
        'casting: "1 action"',
        'range: "90 feet"',
        "components:",
        '  - "V"',
        '  - "S"',
        '  - "M (powdered rhubarb leaf, and an adder’s stomach)"',
        'duration: "Instantaneous"',
        'summary: "You launch a missile of acid toward your target."',
        "---",
        "A shimmering green arrow streaks toward a target.",
        "```",
      ].join("\n")
    );
  });

  it("writes a creature as a stat block that refers to a note of its traits and actions", () => {
    const actions = section("Actions", 3, [
      para(span("Bite.", true), span(" "), span("Melee Weapon Attack:", false, true), span(" +4 to hit.")),
    ]);
    const bat = section(
      "Bat, Giant",
      2,
      [
        para(span("Large Beast")),
        para(span("Armor Class", true), span(" 12")),
        para(span("Hit Points", true), span(" 15")),
        para(span("Speed", true), span(" 10 ft., fly 60 ft.")),
        para(span("Perception", true), span(" 11 "), span("Stealth", true), span(" 14")),
        para(span("STR DEX CON INT WIS CHA")),
        para(span("+2 +2 +0 −4 +1 −2")),
        para(span("Echolocation.", true), span(" The bat can’t use its keensense while deafened.")),
      ],
      [actions],
      "CR 1/4"
    );
    const { note, files, kinds } = write(section("Creatures", 0, [], [bat]));
    expect(kinds).toEqual({ creature: 1 });
    expect(note).toContain('cr: "1/4"');
    expect(note).toContain("  pas_perception: 11\n  pas_stealth: 14");
    expect(note).toContain("abilities:\n  str: 2\n  dex: 2\n  con: 0\n  int: -4\n  wis: 1\n  cha: -2");
    expect(note).toContain('  - ref: "@[[Book/Creature Traits/Bat, Giant Traits]]#Bite"');
    const traits = files.find((f) => f.path === "Creature Traits/Bat, Giant Traits.md")?.text ?? "";
    expect(traits).toContain('name: "Echolocation"\ntype: trait\nheading: p');
    expect(traits).toContain('name: "Bite"\ntype: action\nheading: p\n---\n*Melee Weapon Attack:* +4 to hit.');
  });

  it("writes a magic item with its rarity, price and attunement", () => {
    const item = section("Armor of Resistance", 2, [
      para(span("Armor (Light, Medium, or Heavy), Rare 5,000 gp + armor base cost (Requires Attunement)", false, true)),
      para(span("You are resistant to one type of damage.")),
    ]);
    const { note } = write(section("Items", 0, [], [item]));
    expect(note).toContain(
      [
        'name: "Armor of Resistance"',
        'type: "Armor (Light, Medium, or Heavy)"',
        "rarity: Rare",
        'cost: "5,000 gp + armor base cost"',
        "attunement: true",
        "applies_to:",
        "  kinds: [armor]",
      ].join("\n")
    );
  });

  it("writes a class's levelled features as blocks and its subclasses as notes of their own", () => {
    const feature = (name: string, at: string) =>
      section(name, 4, [para(span(`${at}-Level Barbarian Feature`, false, true)), para(span("What it does."))]);
    const barbarian = section(
      "Barbarian",
      1,
      [para(span("Some warriors hail from untamed lands."))],
      [
        section(
          "Class Features",
          2,
          [para(span("As a barbarian, you have these."))],
          [feature("Rage", "1st"), feature("Danger Sense", "2nd")]
        ),
        section("Barbarian Subclasses", 2, [para(span("Pick one."))]),
        section(
          "Berserker",
          2,
          [para(span("A rage most ferocious."))],
          [section("Frenzy", 4, [para(span("3rd-Level Berserker Feature", false, true)), para(span("Go wild."))])]
        ),
      ]
    );
    const { note, files, kinds } = write(section("Classes", 0, [], [barbarian]));
    expect(kinds).toEqual({ class: 1, subclass: 1 });
    expect(note).toContain(
      '```rpg feature.details\nname: "Rage"\nsubtitle: "1st-Level Barbarian Feature"\nlevel: 1\n---\nWhat it does.\n```'
    );
    const sub = files.find((f) => f.path === "01. Classes/Berserker.md")?.text ?? "";
    expect(sub).toContain(".SUBCLASS:\n  parent_class: Barbarian");
    expect(sub).toContain('name: "Frenzy"\nsubtitle: "3rd-Level Berserker Feature"\nlevel: 3');
  });

  it("makes an item of each priced row of a weapons table, and none of a price list", () => {
    const weapons: Extract<Block, { type: "table" }> = {
      type: "table",
      caption: "WEAPONS",
      page: 1,
      rows: [
        ["WEAPON", "COST", "DAMAGE", "WEIGHT", "WEAPON OPTION", "PROPERTIES"],
        ["Simple Melee Weapons", "", "", "", "", ""],
        ["Club", "1 sp", "1d4 bludgeoning", "2 lb.", "Bash", "Light"],
        ["Dagger", "2 gp", "1d4 piercing", "1 lb.", "Pinning Shot", "Finesse, Light, Thrown (range 20/60 ft.)"],
        ["Mace", "5 gp", "1d6 bludgeoning", "4 lb.", "Bash", "—"],
      ],
    };
    const files = itemsFromTable(weapons, "Gear/Weapons", (_d, n) => n);
    expect(files.map((f) => f.path)).toEqual([
      "Gear/Weapons/Club.md",
      "Gear/Weapons/Dagger.md",
      "Gear/Weapons/Mace.md",
    ]);
    expect(files[1].text).toContain(
      [
        'name: "Dagger"',
        'type: "Simple Melee Weapons"',
        'cost: "2 gp"',
        'weight: "1 lb."',
        "weapon:",
        '  damage: "1d4 piercing"',
        "  properties:",
        '    - "Finesse"',
        '    - "Light"',
        '    - "Thrown (range 20/60 ft.)"',
        "  options:",
        '    - "Pinning Shot"',
      ].join("\n")
    );
    const services = {
      ...weapons,
      rows: [
        ["SERVICE", "COST"],
        ["Cantrip", "10 gp"],
        ["1st", "50 gp"],
        ["2nd", "100 gp"],
      ],
    };
    expect(itemsFromTable(services, "x", (_d, n) => n)).toEqual([]);
  });
});

describe("styles of other books", () => {
  const span = (text: string, bold = false, italic = false) => ({ text, bold, italic });
  const para = (...spans: ReturnType<typeof span>[]): Block => ({ type: "para", spans, page: 1 });
  const section = (title: string, level: number, blocks: Block[], children: Section[] = []): Section => ({
    title,
    level,
    style: `s${level}`,
    page: 1,
    blocks,
    children,
  });
  const write = (root: Section, extra: Partial<EmitContext> = {}) => {
    const ctx: EmitContext = {
      book: "Book",
      source: "From **Book**.",
      options: { ...DEFAULT_OPTIONS, title: "Book" },
      look: lookFor,
      mend: (t) => t,
      files: [],
      tableIds: new Set(),
      names: new Set(),
      kinds: new Map(),
      kept: [],
      ...extra,
    };
    const chapter: Chapter = { title: root.title, number: "01", firstPage: 1, lastPage: 9, root };
    const files = emitBook([chapter], ctx, []);
    return { files, ctx, kinds: Object.fromEntries(ctx.kinds ?? []) };
  };

  it("reads a 5e class set as a chapter: levels from its table, the subclass among its features", () => {
    const table: Block = {
      type: "table",
      page: 1,
      rows: [
        ["Level", "Proficiency Bonus", "Features", "Rages"],
        ["1st", "+2", "Rage, Unarmored Defense", "2"],
        ["2nd", "+2", "Reckless Attack, Danger Sense", "2"],
        ["3rd", "+2", "Primal Path", "3"],
      ],
    };
    const feature = (name: string, text = "What it does.") => section(name, 4, [para(span(text))]);
    const features = section(
      "Class Features",
      2,
      [para(span("As a barbarian, you gain these."))],
      [
        section("Hit Points", 6, [para(span("Hit Dice:", true), span(" 1d12 per barbarian level"))]),
        section("Proficiencies", 6, [para(span("Armor:", true), span(" Light armor"))]),
        section("The Barbarian", 7, [table]),
        feature("Rage"),
        feature("Reckless Attack"),
        feature("Primal Path"),
        section(
          "Path of the Berserker",
          4,
          [para(span("A path of untrammeled fury."))],
          [
            feature("Frenzy", "Starting when you choose this path at 3rd level, you can go into a frenzy."),
            feature("Mindless Rage", "Beginning at 6th level, you can’t be charmed."),
          ]
        ),
      ]
    );
    const { files, kinds } = write(section("Barbarian", 0, [], [features]));
    expect(kinds).toEqual({ class: 1, subclass: 1 });
    const note = files.find((f) => f.path === "01. Barbarian.md")?.text ?? "";
    expect(note).toContain('name: "Rage"\nsubtitle: "1st-Level Barbarian Feature"\nlevel: 1');
    expect(note).toContain('name: "Primal Path"\nsubtitle: "3rd-Level Barbarian Feature"\nlevel: 3');
    expect(note).not.toContain('name: "Hit Points"\nsubtitle');
    const sub = files.find((f) => f.path === "01. Barbarian/Path of the Berserker.md")?.text ?? "";
    expect(sub).toContain(".SUBCLASS:\n  parent_class: Barbarian");
    expect(sub).toContain('name: "Mindless Rage"\nsubtitle: "6th-Level Path of the Berserker Feature"\nlevel: 6');
  });

  it("reads a 5e stat block: scores with modifiers, a Challenge line, bold-italic names", () => {
    const goblin = section("Goblin", 2, [
      para(span("Small humanoid (goblinoid), neutral evil", false, true)),
      para(span("Armor Class", true), span(" 15 (leather armor, shield)")),
      para(span("Hit Points", true), span(" 7 (2d6)")),
      para(span("Speed", true), span(" 30 ft.")),
      para(span("STR DEX CON INT WIS CHA")),
      para(span("8 (−1) 14 (+2) 10 (+0) 10 (+0) 8 (−1) 8 (−1)")),
      para(span("Skills", true), span(" Stealth +6")),
      para(span("Challenge", true), span(" 1/4 (50 XP)")),
      para(span("Nimble Escape.", true, true), span(" The goblin can take the Disengage action.")),
    ]);
    const { files, kinds } = write(section("Monsters", 0, [], [goblin]));
    expect(kinds).toEqual({ creature: 1 });
    const note = files.find((f) => f.path === "01. Monsters.md")?.text ?? "";
    expect(note).toContain('cr: "1/4"');
    expect(note).toContain('  skills: "Stealth +6"');
    expect(note).toContain("abilities:\n  str: -1\n  dex: 2\n  con: 0\n  int: 0\n  wis: -1\n  cha: -1");
    expect(note).toContain("#Nimble Escape");
  });

  it("finds a name the type did not mark by the line under it, and reads a scan's unmarked names", () => {
    const blocks: Block[] = [
      para(span("Some text before.")),
      para(span("Animal Messenger")),
      para(span("2nd-level enchantment (ritual)")),
      para(span("Casting Time: 1 action")),
      para(span("At Higher Levels. If you cast this spell using a slot of")),
      para(span("3rd level or higher, the duration increases.")),
    ];
    expect(promoteNames(blocks)).toBe(1);
    expect(blocks[1]).toMatchObject({ type: "heading", text: "Animal Messenger" });
    const bat = section("Bat", 2, [
      para(span("Tiny Beast")),
      para(span("Armor Class 11")),
      para(span("Hit Points 8")),
      para(span("STR DEX CON INT WIS CHA −4 +1 −1 −4 +1 −3")),
      para(span("Echolocation. The bat can’t use its keensense while deafened.")),
      para(span("ACTIONS Bite. Melee Weapon Attack: +3 to hit.")),
    ]);
    const { files } = write(section("Creatures", 0, [], [bat]), { scanned: new Set([1]) });
    const traits = files.find((f) => f.path === "Creature Traits/Bat Traits.md")?.text ?? "";
    expect(traits).toContain('name: "Echolocation"\ntype: trait');
    expect(traits).toContain('name: "Bite"\ntype: action');
  });

  it("checks the book's table of contents against the headings found", () => {
    const contents = readContents([
      "TABLE OF CONTENTS",
      "Introduction .............................. 7",
      "Chapter 1: Character",
      "Creation & Leveling................. 11",
      "Safety Tools ..................................10",
      "Rules to Remember .......................9",
    ]);
    expect(contents.map((c) => `${c.title}|${c.page}`)).toEqual([
      "Introduction|7",
      "Chapter 1: Character Creation & Leveling|11",
      "Safety Tools|10",
      "Rules to Remember|9",
    ]);
    const chapter = (title: string, kids: string[]): Chapter => ({
      title,
      number: "",
      firstPage: 1,
      lastPage: 2,
      root: section(
        title,
        0,
        [],
        kids.map((k) => section(k, 1, []))
      ),
    });
    const missing = missingFromContents(contents, [
      chapter("Introduction", ["Safety Tools"]),
      chapter("Character Creation and Leveling", []),
    ]);
    expect(missing.map((m) => m.title)).toEqual(["Rules to Remember"]);
  });

  it("files entities into a system's folders, links to them from the book, and leaves existing notes alone", () => {
    const acid = section("Acid Splash", 2, [
      para(span("Arcane Cantrip (Conjuration)", false, true)),
      para(span("Casting Time:", true), span(" 1 action")),
      para(span("Range:", true), span(" 60 feet")),
      para(span("You hurl a bubble of acid.")),
    ]);
    const aid = section("Aid", 2, [
      para(span("2nd-Circle Divine (Abjuration)", false, true)),
      para(span("Casting Time:", true), span(" 1 action")),
      para(span("Range:", true), span(" 30 feet")),
      para(span("Your spell bolsters your allies.")),
    ]);
    const place = placer("tov", "Player's Guide");
    expect(place("item", "Dagger", { type: "Simple Melee Weapons" }, [])).toBe(
      "tov/worldbuilding/items/weapons/simple-melee/Dagger"
    );
    expect(place("item", "Padded", { type: "Light Armor" }, [])).toBe("tov/worldbuilding/items/armor/light/Padded");
    expect(place("talent", "Arcanist", {}, ["Talents", "Magic Talents"])).toBe(
      "tov/worldbuilding/traits/talents/magic/Arcanist"
    );
    // Animals: the Animal tag, a druid's list, or (in a book from outside the system) a Beast below CR 6.
    expect(place("creature", "Bat", { type: "Beast", druid: true }, [])).toBe("tov/worldbuilding/bestiary/animals/Bat");
    expect(place("creature", "Owlbear", { type: "Monstrosity", tags: "Animal" }, [])).toBe(
      "tov/worldbuilding/bestiary/animals/Owlbear"
    );
    expect(place("creature", "Wolf", { type: "Beast", cr: "1/4" }, [])).toBe(
      "tov/worldbuilding/bestiary/monsters/beast/Wolf"
    );
    const outside = placer("tov", "SRD", "ᴰ");
    expect(outside("creature", "Wolf", { type: "beast", cr: "1/4" }, [])).toBe(
      "tov/worldbuilding/bestiary/animals/Wolf ᴰ"
    );
    expect(outside("creature", "Mammoth", { type: "beast", cr: "6" }, [])).toBe(
      "tov/worldbuilding/bestiary/monsters/beast/Mammoth ᴰ"
    );
    expect(place("creature", "Pony", { type: "Beast", steed: true }, [])).toBe(
      "tov/worldbuilding/bestiary/creatures/steeds/Pony"
    );
    // Humanoids are monsters unless the book lists them among its nonplayer characters.
    expect(place("creature", "Goblin", { type: "humanoid" }, [])).toBe(
      "tov/worldbuilding/bestiary/monsters/humanoid/Goblin"
    );
    expect(place("creature", "Guard", { type: "humanoid", npc: true }, [])).toBe(
      "tov/worldbuilding/bestiary/npcs/Guard"
    );
    expect(place("creature", "Imp", { type: "Fiend" }, [])).toBe("tov/worldbuilding/bestiary/monsters/fiend/Imp");
    expect(place("vehicle", "Galley", { type: "Gargantuan Water Vehicle" }, [])).toBe(
      "tov/worldbuilding/bestiary/vehicles/water/Galley"
    );
    expect(placer("tov", "SRD", "ᴰ")("spell", "Aid", { circle: "2nd-Circle" }, [])).toBe(
      "tov/worldbuilding/spells/2nd-circle/Aid ᴰ"
    );
    const { files, ctx } = write(section("Spells", 0, [], [acid, aid]), {
      place,
      existing: new Set(["tov/worldbuilding/spells/2nd-circle/aid"]),
    });
    expect(files.filter((f) => f.outside).map((f) => f.path)).toEqual([
      "tov/worldbuilding/spells/cantrips/Acid Splash.md",
    ]);
    expect(ctx.kept).toEqual(["tov/worldbuilding/spells/2nd-circle/Aid.md"]);
    const note = files.find((f) => f.path === "01. Spells.md")?.text ?? "";
    expect(note).toContain("![[tov/worldbuilding/spells/cantrips/Acid Splash|Acid Splash]]");
    expect(note).toContain("![[tov/worldbuilding/spells/2nd-circle/Aid|Aid]]");
  });

  it("writes a vehicle as a stat.vehicle with its price, and a creature's traits into its type's note", () => {
    const stat = (name: string, type: string, extra: Block[] = []) =>
      section(name, 2, [
        para(span(type)),
        para(span("Armor Class", true), span(" 11")),
        para(span("Hit Points", true), span(" 50")),
        ...extra,
        para(span("STR DEX CON INT WIS CHA")),
        para(span("+0 +1 +0 +0 +0 +0")),
        para(span("Bite.", true), span(" It bites.")),
      ]);
    const prices: Block = {
      type: "table",
      caption: "VEHICLE BASE COST",
      page: 1,
      rows: [
        ["VEHICLE", "COST", "TRAVEL SPEED (PER HOUR)"],
        ["Sand Skimmer", "50 gp", "4 mph"],
      ],
    };
    const skimmer = section(
      "Sand Skimmer",
      1,
      [para(span("This wooden land vehicle slides atop sand."))],
      [stat("Sand Skimmer", "Large Land Vehicle (10 ft. by 5 ft.)", [para(span("Crew 1 Passengers 1"))])]
    );
    const root = section("Gear", 0, [prices], [skimmer, stat("Wolf", "Medium Beast"), stat("Dog", "Small Beast")]);
    const { files, kinds } = write(root, { place: placer("tov", "Guide") });
    expect(kinds).toEqual({ vehicle: 1, creature: 2 });
    const vehicle =
      files.find((f) => f.path === "tov/worldbuilding/bestiary/vehicles/land/Sand Skimmer.md")?.text ?? "";
    expect(vehicle).toContain(
      '```rpg stat.vehicle\nname: "Sand Skimmer"\nsize: Large\ntype: "Land Vehicle"\ndimensions: "10 ft. by 5 ft."\ncost: "50 gp"\ntravel_speed: "4 mph"'
    );
    expect(vehicle).toContain('  crew: "1"\n  passengers: "1"');
    expect(vehicle).toContain("This wooden land vehicle slides atop sand.");
    const traits = files.find((f) => f.path === "tov/worldbuilding/traits/features/Guide Beast Traits.md")?.text ?? "";
    // Two beasts with the same bite share one block.
    expect(traits.match(/name: "Bite"/g)).toHaveLength(1);
    const wolf = files.find((f) => f.path === "tov/worldbuilding/bestiary/monsters/beast/Wolf.md")?.text ?? "";
    expect(wolf).toContain('  - ref: "@[[tov/worldbuilding/traits/features/Guide Beast Traits]]#Bite"');
  });

  it("turns a dark bar's white text dark, and tells bold words by their ink", () => {
    const w = 400;
    const h = 60;
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    const set = (x: number, y: number, v: number) => {
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v;
    };
    for (let y = 20; y < 44; y++) for (let x = 40; x < 360; x++) set(x, y, 30);
    for (let y = 26; y < 38; y++) for (let x = 60; x < 120; x += 4) set(x, y, 255);
    expect(invertDarkBars(px, w, h)).toBe(1);
    expect(px[(30 * w + 200) * 4]).toBe(225);
    expect(px[(30 * w + 60) * 4]).toBe(0);
    const ink = inkMeter(px, w, h);
    expect(ink({ x0: 60, y0: 26, x1: 120, y1: 38 })).toBeCloseTo(0.25, 1);
    expect(ink({ x0: 200, y0: 26, x1: 260, y1: 38 })).toBe(0);
  });
});
