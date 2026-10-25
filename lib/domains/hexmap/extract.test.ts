import { describe, expect, it } from "vitest";
import { extractHexes } from "./extract";
import { loadImports, mergeImports } from "./imports";
import { parseHexMap } from "./parse-hex-map";

const duchy = [
  "grid: hex",
  "title: Worthallow",
  "scale: 30 mi",
  "origin: [5, 3]",
  "import:",
  '  - map: "[[Dunlind]]"',
  "    show: faint",
  "regions:",
  '  Worthallow: { color: "#8a6d2e", link: "[[Worthallow]]", parent: Dunlind }',
  '  WorthallowForest: { label: false, color: "#6b5a3a", link: "[[Worthallow Forest]]", parent: Dunlind }',
  "---",
  "0m:",
  "  * t(0,0): basic[lush] @Worthallow",
  "  * t(1,0): forest[lush] @Worthallow @WorthallowForest",
  "  * t(2,0): forest[lush] @Worthallow @WorthallowForest",
  "  * p(1,0): rivers",
  "m(1.1,0): pin[white] (Glade)",
  "l(1.5,0): (Worthallow Forest) region",
].join("\n");
const forest = new Set(["1,0", "2,0"]);

describe("extractHexes", () => {
  const out = extractHexes(duchy, forest, "Worthallow Forest", "Worthallow", "Worthallow Forest")!;

  it("moves the hexes, their lines and markers into a new block, labels staying", () => {
    expect(out).toMatchObject({ hexes: 2, markers: 1 });
    const block = parseHexMap(out.block.replace(/^```rpg map\n|\n```$/g, ""));
    expect(block.cells.map((c) => `${c.layer}:${c.q},${c.r}`)).toEqual(["terrain:0,0", "terrain:1,0", "path:0,0"]);
    expect(block.origin).toEqual([6, 3]);
    expect(block.imports).toEqual([{ link: "Worthallow", faint: true }]);
    expect(Object.keys(block.regions).sort()).toEqual(["Worthallow", "WorthallowForest"]);
    expect(block.markers[0]).toMatchObject({ q: 0.1, r: 0, text: "Glade" });
    expect(block.labels).toEqual([]);
    const left = parseHexMap(out.remaining);
    expect(left.cells.map((c) => `${c.q},${c.r}`)).toEqual(["0,0"]);
    expect(left.labels).toHaveLength(1);
    expect(left.imports?.[0]).toEqual({ link: "Worthallow Forest", faint: false });
  });

  it("leaves the map looking as it did, through the import", async () => {
    const notes: Record<string, string> = {
      "Worthallow Forest.md": out.block.replace(/^```rpg map\n|\n```$/g, ""),
    };
    const host = parseHexMap(out.remaining);
    const { imports } = await loadImports(host, "Worthallow.md", async (link) =>
      notes[`${link}.md`] ? { path: `${link}.md`, body: notes[`${link}.md`] } : null
    );
    const merged = mergeImports(host, imports);
    const at = (q: number, r: number) => merged.cells.filter((c) => c.q === q && c.r === r).map((c) => c.spec);
    expect(at(1, 0)).toEqual(["forest[lush]", "rivers"]);
    expect(at(2, 0)).toEqual(["forest[lush]"]);
    expect(merged.markers.find((m) => m.text === "Glade")).toMatchObject({ q: 1.1, r: 0 });
  });

  it("starts an import list when the map has none, and gives nothing for empty hexes", () => {
    const plain = "grid: hex\n---\nt(0,0): plains\nt(1,0): plains";
    const res = extractHexes(plain, new Set(["1,0"]), "B", "A", "B")!;
    expect(parseHexMap(res.remaining).imports).toEqual([{ link: "B", faint: false }]);
    expect(extractHexes(plain, new Set(["5,5"]), "B", "A", "B")).toBeNull();
  });
});
