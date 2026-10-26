import { describe, expect, it } from "vitest";
import { importAt, importOffset, loadImports, mergeImports, readImports } from "./imports";
import { parseHexMap } from "./parse-hex-map";

const notes: Record<string, string> = {
  "Region.md": `grid: hex\nscale: 30 mi\nimport:\n  - "[[Realm A]]"\n  - "[[Realm B]]"\n---\n`,
  "Realm A.md": `grid: hex\nscale: 30 mi\norigin: [4, 0]\nimport:\n  - map: "[[Realm B]]"\n    show: faint\n---\nt(0,0): plains @A\nt(1,0): plains @A\nm(0,0): pin[red] (Capital)`,
  "Realm B.md": `grid: hex\nscale: 30 mi\norigin: [0, -3]\n---\nt(0,0): ocean @B\nt(4,3): hills @B`,
  "Detail.md": `grid: hex\nscale: 5 mi\n---\nt(0,0): plains`,
  "Loop.md": `grid: hex\nimport: ["[[Loop]]", "[[Realm B]]"]\n---\nt(0,0): plains`,
};
const read = async (link: string) => {
  const path = `${link}.md`;
  return notes[path] !== undefined ? { path, body: notes[path] } : null;
};

describe("readImports", () => {
  it("reads quoted links, unquoted links and entries", () => {
    expect(readImports(["[[A]]", { map: "[[B]]", at: [1, -2], show: "faint" }])).toEqual([
      { link: "A", faint: false },
      { link: "B", at: [1, -2], faint: true },
    ]);
    // `import: [[A]]` reads in YAML as a list in a list.
    expect(readImports([["A"]])).toEqual([{ link: "A", faint: false }]);
    expect(readImports([[["A"]], [["B"]]])).toEqual([
      { link: "A", faint: false },
      { link: "B", faint: false },
    ]);
    expect(readImports("[[A|alias]]")).toEqual([{ link: "A|alias", faint: false }]);
  });

  it("reads origin and import from the header", () => {
    const map = parseHexMap(notes["Realm A.md"]);
    expect(map.origin).toEqual([4, 0]);
    expect(map.imports).toEqual([{ link: "Realm B", faint: true }]);
  });
});

describe("importOffset", () => {
  it("is the difference of the origins, unless at says where", () => {
    const host = parseHexMap("grid: hex\norigin: [4, 0]\n---\n");
    const other = parseHexMap("grid: hex\norigin: [0, -3]\n---\n");
    expect(importOffset(host, { link: "x", faint: false }, other)).toEqual([-4, -3]);
    expect(importOffset(host, { link: "x", at: [2, 2], faint: false }, other)).toEqual([2, 2]);
  });
});

describe("loadImports", () => {
  it("places imports by origin, follows full ones, and keeps each note once", async () => {
    const host = parseHexMap(notes["Region.md"]);
    const { imports, problems } = await loadImports(host, "Region.md", read);
    expect(problems).toEqual([]);
    expect(imports.map((i) => [i.path, i.offset, i.faint])).toEqual([
      ["Realm A.md", [4, 0], false],
      ["Realm B.md", [0, -3], false],
    ]);
  });

  it("keeps a faint import for the map that asked for it", async () => {
    const host = parseHexMap(notes["Realm A.md"]);
    const { imports } = await loadImports(host, "Realm A.md", read);
    expect(imports.map((i) => [i.path, i.offset, i.faint])).toEqual([["Realm B.md", [-4, -3], true]]);
  });

  it("reports missing notes and other scales, and never imports itself", async () => {
    const host = parseHexMap(`grid: hex\nscale: 30 mi\nimport: ["[[Nowhere]]", "[[Detail]]"]\n---\n`);
    const { imports, problems } = await loadImports(host, "Region.md", read);
    expect(imports).toEqual([]);
    expect(problems).toHaveLength(2);
    const loop = await loadImports(parseHexMap(notes["Loop.md"]), "Loop.md", read);
    expect(loop.imports.map((i) => i.path)).toEqual(["Realm B.md"]);
  });
});

describe("mergeImports", () => {
  it("adds imported lines at their place, under the host's own hexes", async () => {
    const host = parseHexMap(`grid: hex\n---\nt(4,0): lake`);
    const { imports } = await loadImports({ ...host, imports: [{ link: "Realm A", faint: false }] }, "Region.md", read);
    const merged = mergeImports(host, imports);
    const at = (q: number, r: number) => merged.cells.filter((c) => c.q === q && c.r === r).map((c) => c.spec);
    expect(at(4, 0)).toEqual(["lake"]);
    expect(at(5, 0)).toEqual(["plains"]);
    expect(merged.cells.find((c) => c.q === 5)!.line).toBeLessThan(0);
    // The capital's marker stood on the host's hex, so it's left out.
    expect(merged.markers).toEqual([]);
    expect(merged.regions).toEqual({});
  });

  it("brings a faint neighbour's regions, labels and markers, dimmed and not the host's to edit", () => {
    const next = parseHexMap(
      `grid: hex\nregions:\n  B: { tint: "#c08a40", label: { at: border } }\n---\nt(1,0): plains @B\nl(1,0): (B) realm\nm(1,0): pin (Town)`
    );
    const merged = mergeImports(parseHexMap("grid: hex\n---\nt(0,0): plains"), [
      { path: "n", via: "host", body: "", map: next, offset: [0, 0], faint: true },
    ]);
    const cell = merged.cells.find((c) => c.q === 1)!;
    expect(cell.regions).toEqual([]);
    expect(cell.faintRegions).toEqual(["B"]);
    expect(merged.regions.B).toMatchObject({ tint: "#c08a40", labelAt: "border" });
    expect(merged.labels).toMatchObject([{ text: "B", faint: true }]);
    expect(merged.markers).toMatchObject([{ text: "Town", faint: true, piece: false }]);
  });

  it("draws a region as its own map declares it, copies elsewhere left alone, exceptions marked", () => {
    const forest = parseHexMap(
      `grid: hex\nregions:\n  Forest: { label: "The Wood", link: "[[Forest]]", color: "#00f" }\n---\nt(0,0): forest @Forest`
    );
    const duchy = parseHexMap(
      `grid: hex\nregions:\n  Duchy: { link: "[[Duchy]]" }\n  Forest: { label: false, color: "#f00" }\n---\nt(1,0): plains @Duchy`
    );
    const imports = [
      {
        path: "Duchy.md",
        via: "Realm.md",
        body: "",
        map: duchy,
        offset: [0, 0] as [number, number],
        faint: false,
        label: { labelAt: "border" as const },
      },
      { path: "Forest.md", via: "Duchy.md", body: "", map: forest, offset: [0, 0] as [number, number], faint: false },
    ];
    // The duchy's stale copy (label: false, red) is ignored; the realm's import `label:` names the duchy only.
    const plain = mergeImports(parseHexMap("grid: hex\n---\n"), imports);
    expect(plain.regions.Forest).toMatchObject({ label: "The Wood", color: "#00f", source: "Forest.md" });
    expect(plain.regions.Forest.labelAt).toBeUndefined();
    expect(plain.regions.Duchy.labelAt).toBe("border");
    // A host copy without `override` is ignored; with it, its fields go over, the rest kept.
    const copy = mergeImports(parseHexMap("grid: hex\nregions:\n  Forest: { label: false }\n---\n"), imports);
    expect(copy.regions.Forest.label).toBe("The Wood");
    const over = mergeImports(
      parseHexMap("grid: hex\nregions:\n  Forest: { label: false, override: true }\n---\n"),
      imports
    );
    expect(over.regions.Forest).toMatchObject({ label: false, color: "#00f" });
  });

  it("carries a middle map's override up to the host that imports it", () => {
    const forest = parseHexMap(
      `grid: hex\nregions:\n  Forest: { link: "[[Forest]]", color: "#00f" }\n---\nt(0,0): forest @Forest`
    );
    const realm = parseHexMap(`grid: hex\nregions:\n  Forest: { label: false, override: true }\n---\nt(5,5): plains`);
    const merged = mergeImports(parseHexMap("grid: hex\n---\n"), [
      { path: "Realm.md", via: "World.md", body: "", map: realm, offset: [0, 0], faint: false },
      { path: "Forest.md", via: "Realm.md", body: "", map: forest, offset: [0, 0], faint: false },
    ]);
    expect(merged.regions.Forest).toMatchObject({ label: false, color: "#00f" });
  });

  it("lets the earlier import win a hex both have", () => {
    const a = parseHexMap(`grid: hex\n---\nt(0,0): plains`);
    const b = parseHexMap(`grid: hex\n---\nt(0,0): ocean\nt(1,0): ocean`);
    const merged = mergeImports(parseHexMap("grid: hex\n---\n"), [
      { path: "a", via: "host", body: "", map: a, offset: [0, 0], faint: false },
      { path: "b", via: "host", body: "", map: b, offset: [0, 0], faint: false },
    ]);
    expect(merged.cells.map((c) => `${c.q},${c.r}:${c.spec}`)).toEqual(["0,0:plains", "1,0:ocean"]);
  });

  it("finds the import a hex comes from, full before faint, and none for the host's own", () => {
    const host = parseHexMap(`grid: hex\n---\nt(0,0): plains`);
    const faint = parseHexMap(`grid: hex\n---\nt(2,0): ocean\nt(3,0): ocean`);
    const full = parseHexMap(`grid: hex\n---\nt(0,0): forest\nt(1,0): forest`);
    const imports = [
      { path: "f", via: "host", body: "", map: faint, offset: [0, 0] as [number, number], faint: true },
      { path: "w", via: "host", body: "", map: full, offset: [1, 0] as [number, number], faint: false },
    ];
    expect(importAt(host, imports, 0, 0)).toBeUndefined();
    expect(importAt(host, imports, 2, 0)?.path).toBe("w");
    expect(importAt(host, imports, 3, 0)?.path).toBe("f");
    expect(importAt(host, imports, 9, 9)).toBeUndefined();
  });

  it("moves an imported region's label with its map", () => {
    const realm = parseHexMap(`grid: hex\nregions:\n  A: { at: [1, 1] }\n---\nt(0,0): plains @A`);
    const merged = mergeImports(parseHexMap("grid: hex\n---\n"), [
      { path: "a", via: "host", body: "", map: realm, offset: [3, -2], faint: false },
    ]);
    expect(merged.regions.A.at).toEqual([4, -1]);
  });

  it("brings a faint import's full imports, faint, but never the map itself", async () => {
    const realm: Record<string, string> = {
      "Realm.md": `grid: hex\nimport: ["[[Duchy A]]", "[[Duchy B]]", { map: "[[Next]]", show: faint }]\n---\nt(5,5): plains`,
      "Duchy A.md": `grid: hex\nimport:\n  - { map: "[[Realm]]", show: faint }\n---\nt(0,0): plains`,
      "Duchy B.md": `grid: hex\n---\nt(1,0): plains`,
      "Next.md": `grid: hex\n---\nt(9,9): plains`,
    };
    const readRealm = async (link: string) => ({ path: `${link}.md`, body: realm[`${link}.md`] });
    const { imports } = await loadImports(parseHexMap(realm["Duchy A.md"]), "Duchy A.md", readRealm);
    expect(imports.map((i) => [i.path, i.faint])).toEqual([
      ["Realm.md", true],
      ["Duchy B.md", true],
    ]);
  });

  it("names an import's regions as its entry says, and lets the host's own fields win", () => {
    const duchy = parseHexMap(
      `grid: hex\nregions:\n  Feathers: { color: "#8a3b2e", link: "[[Feathers]]", parent: Dunlind }\n---\nt(0,0): plains @Feathers`
    );
    expect(readImports([{ map: "[[Feathers]]", label: "border" }])).toEqual([
      { link: "Feathers", faint: false, label: { labelAt: "border" } },
    ]);
    const host = parseHexMap(`grid: hex\nregions:\n  Feathers: { labelColor: "#fff" }\n---\n`);
    const merged = mergeImports(host, [
      { path: "f", via: "host", body: "", map: duchy, offset: [0, 0], faint: false, label: { labelAt: "border" } },
    ]);
    expect(merged.regions.Feathers).toMatchObject({
      color: "#8a3b2e",
      parent: "Dunlind",
      link: "Feathers",
      labelAt: "border",
      labelColor: "#fff",
    });
    const hidden = mergeImports(parseHexMap("grid: hex\n---\n"), [
      { path: "f", via: "host", body: "", map: duchy, offset: [0, 0], faint: false, label: { label: false } },
    ]);
    expect(hidden.regions.Feathers.label).toBe(false);
  });
});
