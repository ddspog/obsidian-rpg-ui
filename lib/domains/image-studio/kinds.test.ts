import { describe, it, expect } from "vitest";
import { aspectFor, kindOf, promptFor, targetSize, type PromptContext } from "./kinds";

const ctx = (c: Partial<PromptContext>): PromptContext => ({
  note: "x",
  frontmatter: {},
  blocks: [],
  prose: "",
  name: "x",
  ...c,
});

describe("image kinds", () => {
  it("knows a kind by where the image sits", () => {
    expect(kindOf({ kind: "fence", fence: 0, meta: "item.element", key: "image", label: "" })).toBe("item");
    expect(kindOf({ kind: "fence", fence: 0, meta: "spell", key: "image", label: "" })).toBe("spell");
    expect(kindOf({ kind: "fence", fence: 0, meta: "stat.monster", key: "image", label: "" })).toBe("creature");
    expect(kindOf({ kind: "frontmatter", key: "banner", label: "" })).toBe("banner");
    expect(
      kindOf(
        { kind: "frontmatter", key: "reference_img", label: "" },
        "021. History and Geography/NPCs/Cleric Harold.md"
      )
    ).toBe("portrait");
    expect(kindOf({ kind: "icon", name: "Dash", label: "" })).toBe("icon");
  });

  it("fills an item's prompt from its block — a cut-out on magenta, wide for a long weapon", () => {
    const block = {
      meta: "item.element",
      data: { name: "Longbow", type: "[[Martial]] [[Ranged]] Weapons", weapon: { damage: "1d8 piercing" } },
      body: "",
    };
    const c = ctx({ name: "Longbow", block, blocks: [block] });
    const p = promptFor("item", c, "");
    expect(p).toContain("a single Longbow (a martial ranged weapon, a weapon dealing 1d8 piercing) and nothing else");
    expect(p).toContain("#FF00FF");
    expect(aspectFor("item", c)).toBe("16:9");
  });

  it("frames a spell card with its name, coloured by its magic", () => {
    const block = { meta: "spell", data: { school: "Abjuration", summary: "Break an ongoing spell." }, body: "" };
    const p = promptFor("spell", ctx({ name: "Dispel Magic", block, blocks: [block] }), "");
    expect(p).toContain("“Dispel Magic”");
    expect(p).toContain("protective translucent blue wards");
    // The art alone: the frame and plaque are the plugin's.
    expect(p).toContain("Full-bleed");
    expect(p).not.toContain("magenta");
    expect(p).not.toContain("plaque at the bottom");
    expect(p).toContain("Break an ongoing spell.");
  });

  it("gives a spell's whole description, not only its tooltip line", () => {
    const block = {
      meta: "spell",
      data: { school: "Conjuration", summary: "Hurl an ice lance.", duration: "Instantaneous" },
      body: "You fling a massive icicle toward a target. On a hit, the target takes 3d8 cold damage and may be pinned against a wall.<br/<br/ At Higher Levels. More damage.",
    };
    const p = promptFor("spell", ctx({ name: "Icicle Javelin", block, blocks: [block] }), "");
    expect(p).toContain("In short: Hurl an ice lance.");
    expect(p).toContain("pinned against a wall");
    expect(p).not.toContain("<br");
  });

  it("reads a portrait from the character's sheet", () => {
    const header = {
      meta: "character.header",
      data: { lineage: { file: [["Elf"]] }, classes: [{ name: [["Ranger"]] }] },
      body: "",
    };
    const desc = {
      meta: "character.description",
      data: { appearance: { body: "A young elf with glowing hair." } },
      body: "",
    };
    const p = promptFor("portrait", ctx({ name: "Talon", blocks: [header, desc] }), "");
    expect(p).toContain("Talon, Elf, a Ranger");
    expect(p).toContain("glowing hair");
  });
});

describe("icon prompts", () => {
  it("tints the stone and glow by the card's type, and asks for its idea drawn, not written", async () => {
    const { DEFAULT_IMAGE_STUDIO } = await import("settings");
    const p = promptFor(
      "icon",
      ctx({ name: "Fate Question", prose: "Ask a yes/no question.", tone: "gm" }),
      DEFAULT_IMAGE_STUDIO.stylePrompt
    );
    expect(p).toContain("clearly tinted violet");
    expect(p).toContain("luminous glowing magenta-pink");
    expect(p).toContain("one single iconic motif for “Fate Question”");
    expect(p).toContain("never write any of it");
    expect(p).not.toContain("{tint}");
  });
});

describe("a character's portrait prompt", () => {
  const header = {
    meta: "character.header",
    data: {
      classes: [{ name: [["Druid"]], level: 1 }],
      lineage: { file: [["Kobold"]] },
      heritage: { file: [["Twisted Minion ᴴ"]], comment: "of a Dragon" },
      background: { file: [["Adherent"]], comment: "to a Secret Cult" },
    },
    body: "",
  };
  const desc = {
    meta: "character.description",
    data: {
      appearance: {
        side_props: [
          { age: 14, height: "3'3''", weight: "35 lb." },
          { eyes: "Black", skin: "Green-Grey", hair: "None" },
        ],
        body: "A small, thin and gaunt kobold with gray scales and small horns.",
        clothes: "A cloak to hide the figure, and gloves.",
      },
      backstory: {
        text: "Kowyn was born below Mt. Aleldath, in a secret cult. He ran away.",
        highlights: [{ key: "Run Away", value: "Ran from a secret cult." }],
      },
    },
    body: "",
  };
  const inv = {
    meta: "character.inventory",
    data: {
      items: [
        { name: "[[Quarterstaff]]", slot: "main_hand" },
        { name: "[[Leather]]", slot: "armor" },
        { name: "[[Waterskin]]" },
      ],
    },
    body: "",
  };

  it("takes the whole appearance, the origins with their comments, the class, the gear", () => {
    const p = promptFor(
      "portrait",
      ctx({
        name: "Kowyn",
        blocks: [header, desc, inv],
        lore: [
          {
            role: "Lineage",
            note: "Kobold",
            text: "Kobolds are small reptilian humanoids with scales, horns and a tail.",
          },
        ],
      }),
      ""
    );
    expect(p).toContain(
      "Kowyn, 14 years old Kobold, Twisted Minion of a Dragon heritage, a Druid (level 1), Adherent to a Secret Cult background"
    );
    expect(p).toContain("3'3'' tall, weighs 35 lb., eyes Black, skin Green-Grey, no hair");
    expect(p).toContain("Appearance: A small, thin and gaunt kobold");
    expect(p).toContain("Clothing: A cloak");
    expect(p).toContain("Quarterstaff (main hand), Leather (armor)");
    expect(p).not.toContain("Waterskin");
    expect(p).toContain("Lineage Kobold: Kobolds are small reptilian humanoids");
    expect(p).toContain("Heritage Twisted Minion (of a Dragon)");
    expect(p).toContain("Their story, for mood: Kowyn was born below Mt. Aleldath");
  });
});

describe("targetSize", () => {
  const card = { size: { w: 1600, h: 938 } };
  it("keeps the replaced picture's size when it has the shape asked for", () => {
    expect(targetSize(card, "16:9", { w: 1344, h: 768 })).toEqual({ w: 1344, h: 768 });
  });
  it("follows the shape asked for when it differs", () => {
    expect(targetSize(card, "3:4", { w: 1344, h: 768 })).toEqual({ w: 1200, h: 1600 });
    expect(targetSize(card, "1:1")).toEqual({ w: 1600, h: 1600 });
  });
  it("has none for a cut-out", () => {
    expect(targetSize({}, "1:1")).toBeUndefined();
  });
});
