import { describe, expect, it } from "vitest";
import { mapNoteName, mapNoteText } from "./map-note";
import { parseSquareMap } from "./square-map";
import { findMapFences } from "lib/domains/hexmap/fence-text";

const block = (text: string) => findMapFences(text)[0].body;

describe("mapNoteName", () => {
  it("drops characters a note name or link cannot hold", () => {
    expect(mapNoteName('  Kobold: "Ambush" / North [wing]  ')).toBe("Kobold Ambush North wing");
  });
});

describe("mapNoteText", () => {
  it("makes a picture map the plugin reads, with the grid found", () => {
    const text = mapNoteText({
      title: "Kowyn Encounter",
      image: { link: "[[01s02.png]]", grid: { cell: 33.04, offsetX: -1, offsetY: -1.4 } },
    });
    const map = parseSquareMap(block(text));
    expect(map.title).toBe("Kowyn Encounter");
    expect(map.image).toMatchObject({ link: "[[01s02.png]]", cell: 33.04, offsetX: -1, offsetY: -1 });
    expect(map.tokens).toEqual({});
  });

  it("falls back to a typical cell when no grid was found", () => {
    const map = parseSquareMap(block(mapNoteText({ title: "X", image: { link: "[[a.webp]]", grid: null } })));
    expect(map.image?.cell).toBe(33);
  });

  it("without a picture draws a small board to edit", () => {
    const map = parseSquareMap(block(mapNoteText({ title: "Cellar" })));
    expect(map.cols).toBe(12);
    expect(map.rows).toBe(6);
    expect(map.legend["^"]?.cover).toBe("half");
  });

  it("carries the sections a table wants", () => {
    const text = mapNoteText({ title: "Cellar" });
    for (const h of ["## Starting positions", "## Cover and terrain", "## Hazards", "## Loot", "## Notes for the GM"])
      expect(text).toContain(h);
    expect(text.startsWith("---\ncssclasses:")).toBe(true);
  });
});
