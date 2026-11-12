import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type FlowerState,
  moveToken,
  parseHexFlower,
  pickOption,
  readPlace,
  rollFlower,
  startState,
  stepFlower,
} from "./hex-flower";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const wilderness = parseHexFlower(fixture("wilderness.yml"));
const ruins = parseHexFlower(fixture("ruins.yml"));

const at = (place: string): FlowerState => ({ at: readPlace(place)!, temperature: 0 });
const cellAt = (f: typeof wilderness, place: string) => {
  const a = readPlace(place)!;
  return f.cells.get(`${a.q},${a.r}`)?.text;
};

describe("hex flower: reading", () => {
  it("reads both book flowers without problems", () => {
    expect(wilderness.errors).toEqual([]);
    expect(ruins.errors).toEqual([]);
    expect(wilderness.cells.size).toBe(18);
    expect(wilderness.radius).toBe(2);
    expect(wilderness.directions.get(12)).toBe("N");
    expect(wilderness.directions.get(7)).toBe("S");
    expect(wilderness.arrows).toHaveLength(6);
  });

  it("reads places as steps from Start or axial", () => {
    expect(readPlace("N N")).toEqual({ q: 0, r: -2 });
    expect(readPlace("NW, SW")).toEqual({ q: -2, r: 1 });
    expect(readPlace("-1,2")).toEqual({ q: -1, r: 2 });
    expect(readPlace("start")).toEqual({ q: 0, r: 0 });
    expect(readPlace("up north")).toEqual({ q: 0, r: -2 });
    expect(readPlace("sideways")).toBeNull();
  });

  it("splits two-in-one cells and picks 1–3 / 4–6", () => {
    const cell = wilderness.cells.get("-1,1")!;
    expect(cell.options).toEqual(["Farmland", "Grassland"]);
    expect(pickOption(cell.options, 3)).toBe("Farmland");
    expect(pickOption(cell.options, 4)).toBe("Grassland");
  });

  it("reports what it can't read", () => {
    const f = parseHexFlower("directions:\n  N: 2\ncells:\n  Q: x\narrows:\n  N > X: N");
    expect(f.errors.join("\n")).toMatch(/no side for 3, 4/);
    expect(f.errors.join("\n")).toMatch(/"Q" isn't a place/);
    expect(f.errors.join("\n")).toMatch(/arrows/);
  });
});

describe("hex flower: the book's examples", () => {
  it("moves a 4 north-east from Start to Forest, and a 12 from Badlands up to Hills", () => {
    expect(stepFlower(wilderness, startState(), [1, 3]).step.result).toBe("Forest");
    const s = stepFlower(wilderness, at("NW"), [6, 6]).step;
    expect(cellAt(wilderness, "NW")).toBe("Badlands");
    expect(s.result).toBe("Hills");
  });

  it("wraps along the line: Desert and a 9 goes to the top-right Hills", () => {
    const m = moveToken(wilderness, readPlace("NW SW")!, "SW");
    expect(m).toEqual({ to: { q: 1, r: -2 }, wrapped: true, arrow: false });
    expect(cellAt(wilderness, "1,-2")).toBe("Hills");
  });

  it("follows the arrows one way: Swamp and an 8 goes to Grassland; Coastal and a 7 wraps to Hills", () => {
    const swamp = moveToken(wilderness, readPlace("S S")!, "SW");
    expect(swamp.arrow).toBe(true);
    expect(cellAt(wilderness, `${swamp.to.q},${swamp.to.r}`)).toBe("Grassland");
    const coastal = moveToken(wilderness, readPlace("SE S")!, "S");
    expect(coastal.wrapped).toBe(true);
    expect(cellAt(wilderness, `${coastal.to.q},${coastal.to.r}`)).toBe("Hills");
    expect(moveToken(wilderness, readPlace("N N")!, "N")).toEqual({ to: { q: 0, r: -2 }, wrapped: false, arrow: true });
  });

  it("repeats the previous result on Start (wilderness), and is Up/Down in ruins", () => {
    // From the Grassland below Start, a 2 goes north onto it.
    const s = stepFlower(wilderness, { ...at("S"), last: "Grassland" }, [1, 1]);
    expect(s.step.start).toBe(true);
    expect(s.step.result).toBe("Grassland");
    expect(stepFlower(ruins, at("S"), [6, 6]).step.result).toBe("Up/Down");
  });

  it("ruins: Work Ward and a 12 goes up to Collapse; Military Ward and a 9 wraps to Chasm", () => {
    expect(stepFlower(ruins, at("NW"), [6, 6]).step.result).toBe("Collapse");
    expect(stepFlower(ruins, at("NW SW"), [4, 5]).step.result).toBe("Chasm");
  });

  it("shifts temperature on a 1 or a 6, and biomes with it; doubles flagged", () => {
    // A 6 and a 1 together: back to temperate. A 6: warmer, and Forest becomes Jungle.
    let r = stepFlower(wilderness, startState(), [6, 1]);
    expect(r.step.temperature).toBe(0);
    r = stepFlower(wilderness, startState(), [6, 4]);
    expect(r.step.temperature).toBe(1);
    expect(r.step.result).toBe("Badlands"); // 10: north-west
  });
});

describe("hex flower: temperature and doubles", () => {
  it("turns Forest to Jungle when hot, and remembers the base result", () => {
    const hot: FlowerState = { at: { q: 0, r: 0 }, temperature: 1 };
    const r = stepFlower(wilderness, hot, [2, 2]); // 4: NE → Forest, doubles
    expect(r.step.result).toBe("Jungle");
    expect(r.step.doubles).toBe(true);
    expect(r.state.last).toBe("Forest");
  });

  it("rolls with a random source", () => {
    const seq = [0.5, 0.5, 0.1];
    let i = 0;
    const r = rollFlower(wilderness, startState(), () => seq[i++ % seq.length]);
    expect(r.step.dice).toEqual([4, 4]);
    expect(r.step.side).toBe("SW");
  });
});
