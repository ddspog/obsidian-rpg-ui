import { describe, it, expect } from "vitest";
import { parseReference } from "./parse";
import { extractAllRpgFences, groupFences } from "./fence-scan";
import { resolveReference, type FileRefView } from "./resolve";

function buildView(markdown: string, frontmatter: Record<string, unknown> = {}): FileRefView {
  return {
    frontmatter,
    fencesByKey: groupFences(extractAllRpgFences(markdown)),
  };
}

const LONGSWORD = [
  "```rpg item.element",
  "type: Martial Melee Weapons",
  "cost: 15 gp",
  "weapon:",
  "  damage: 1d8/1d10 slashing",
  "  properties:",
  "    - Versatile",
  "```",
].join("\n");

describe("resolveReference — metadata paths", () => {
  it("walks frontmatter keys", () => {
    const view = buildView("", { cssclasses: ["note-item"], xp: 1200 });
    const ref = parseReference("@[[X]].metadata.cssclasses[0]")!;
    const r = resolveReference(ref, view);
    expect(r.kind).toBe("scalar");
    expect(r.value).toBe("note-item");
  });

  it("returns scalar + nested trace on a plain key", () => {
    const view = buildView("", { xp: 1200 });
    const ref = parseReference("@[[X]].metadata.xp")!;
    const r = resolveReference(ref, view);
    expect(r.value).toBe(1200);
  });

  it("reports missing when the path overshoots", () => {
    const view = buildView("", { xp: 1200 });
    const ref = parseReference("@[[X]].metadata.xp.wat")!;
    const r = resolveReference(ref, view);
    expect(r.kind).toBe("missing");
    expect(r.trace).toContain("metadata.xp.wat");
  });
});

describe("resolveReference — fence-body paths", () => {
  it("shorthand `item.element.cost` hits the first fence", () => {
    const view = buildView(LONGSWORD);
    const ref = parseReference("@[[L]].item.element.cost")!;
    const r = resolveReference(ref, view);
    expect(r.value).toBe("15 gp");
  });

  it("deep paths walk into nested maps", () => {
    const view = buildView(LONGSWORD);
    const ref = parseReference("@[[L]].item.element.weapon.damage")!;
    const r = resolveReference(ref, view);
    expect(r.value).toBe("1d8/1d10 slashing");
  });

  it("`[0]` explicit index is equivalent to shorthand", () => {
    const view = buildView(LONGSWORD);
    const implicit = resolveReference(parseReference("@[[L]].item.element.cost")!, view);
    const explicit = resolveReference(parseReference("@[[L]].item.element[0].cost")!, view);
    expect(implicit.value).toBe(explicit.value);
  });

  it("resolves [Name] against an array of named entries", () => {
    const doc = [
      "```rpg feature.details",
      "name: Spellcasting",
      'text: "Wizard slots"',
      "```",
      "```rpg feature.details",
      "name: Arcane Recovery",
      'text: "Regain slots"',
      "```",
    ].join("\n");
    const view = buildView(doc);
    const r = resolveReference(
      parseReference("@[[W]].feature.details[Spellcasting].text")!,
      view,
    );
    expect(r.value).toBe("Wizard slots");
  });

  it("returns missing when the fence bucket is empty", () => {
    const view = buildView("");
    const r = resolveReference(parseReference("@[[X]].item.element.cost")!, view);
    expect(r.kind).toBe("missing");
  });

  it("classifies array / object results distinctly from scalars", () => {
    const view = buildView(LONGSWORD);
    const arr = resolveReference(parseReference("@[[L]].item.element.weapon.properties")!, view);
    expect(arr.kind).toBe("array");
    const obj = resolveReference(parseReference("@[[L]].item.element.weapon")!, view);
    expect(obj.kind).toBe("object");
  });
});

describe("resolveReference — shorthand (unqualified)", () => {
  it("finds a top-level fence field without the entity.block prefix", () => {
    const view = buildView(LONGSWORD);
    const r = resolveReference(parseReference("@[[L]].cost")!, view);
    expect(r.kind).toBe("scalar");
    expect(r.value).toBe("15 gp");
  });

  it("walks nested fence-body paths literally — no deep-key search", () => {
    const view = buildView(LONGSWORD);
    const walked = resolveReference(parseReference("@[[L]].weapon.damage")!, view);
    expect(walked.kind).toBe("scalar");
    expect(walked.value).toBe("1d8/1d10 slashing");
    // `damage` alone must not fall through to the nested `weapon.damage`.
    const bare = resolveReference(parseReference("@[[L]].damage")!, view);
    expect(bare.kind).toBe("missing");
  });

  it("surfaces fence-body objects when the direct property is a map", () => {
    const view = buildView(LONGSWORD);
    const r = resolveReference(parseReference("@[[L]].weapon")!, view);
    expect(r.kind).toBe("object");
    expect((r.value as Record<string, unknown>).damage).toBe("1d8/1d10 slashing");
  });

  it("falls through to frontmatter when no fence body has the key", () => {
    const view = buildView("", { cssclasses: ["note-armor"], xp: 1200 });
    const r = resolveReference(parseReference("@[[X]].cssclasses")!, view);
    expect(r.value).toEqual(["note-armor"]);
  });

  it("reports missing with a helpful reason when nothing matches", () => {
    const view = buildView(LONGSWORD);
    const r = resolveReference(parseReference("@[[X]].bogus")!, view);
    expect(r.kind).toBe("missing");
    expect(r.reason).toContain("No matching path");
  });
});
