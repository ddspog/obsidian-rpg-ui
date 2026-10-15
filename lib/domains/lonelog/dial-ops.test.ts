/**
 * Resource-op accumulator tests.
 */

import { describe, it, expect } from "vitest";
import { parseLonelog } from "./parser";
import {
  resolveDialOps,
  normalizeResource,
  collectResources,
  collectResourceDecls,
  foldResources,
  type DialDecl,
} from "./dial-ops";
import type { ResolvedDialOp } from "./dial-ops";

const CF: Record<string, DialDecl> = {
  CF: { key: "CF", min: 1, max: 9, default: 5, name: "Chaos Factor" },
};

/** All resolved ops in document order (flattened across entry indices). */
function ops(log: string, decls = CF): ResolvedDialOp[] {
  const map = resolveDialOps(parseLonelog(log), decls);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, v]) => v);
}

describe("resolveDialOps", () => {
  it("inspect reports the default when no op has changed it", () => {
    expect(ops("[CF?]")).toEqual([
      { key: "CF", name: "Chaos Factor", op: "inspect", amount: undefined, current: 5, min: 1, max: 9 },
    ]);
  });

  it("set assigns the value (`=` and `:` synonyms)", () => {
    expect(ops("[CF=3]")[0].current).toBe(3);
    expect(ops("[CF:3]")[0].current).toBe(3);
  });

  it("increases and decreases from the running value", () => {
    expect(ops("[CF+1]")[0].current).toBe(6); // 5 + 1
    expect(ops("[CF-2]")[0].current).toBe(3); // 5 - 2
  });

  it("clamps to the declared band", () => {
    expect(ops("[CF+10]")[0].current).toBe(9); // max
    expect(ops("[CF-10]")[0].current).toBe(1); // min
  });

  it("folds a sequence in document order", () => {
    const seq = ops("[CF=5]\n[CF+1]\n[CF+1]\n[CF-1]").map((o) => o.current);
    expect(seq).toEqual([5, 6, 7, 6]);
  });

  it("carries the delta + range for the pill", () => {
    const o = ops("[CF+1]")[0];
    expect(o).toMatchObject({ op: "inc", amount: 1, current: 6, min: 1, max: 9 });
  });

  it("ignores ops for an undeclared resource", () => {
    expect(ops("[XY+1]")).toEqual([]);
  });

  it("tracks multiple session resources independently", () => {
    const decls: Record<string, DialDecl> = {
      ...CF,
      TN: { key: "TN", min: 0, max: 6, default: 0, name: "Tension" },
    };
    const seq = ops("[CF+1]\n[TN+2]\n[CF-1]", decls);
    expect(seq.map((o) => [o.key, o.current])).toEqual([
      ["CF", 6],
      ["TN", 2],
      ["CF", 5],
    ]);
  });

  it("resolves ops carried on oracle `?` lines, accumulating across them", () => {
    const log = [
      "? The default value [CF?]",
      "? We can increase [CF+1]",
      "? Consult [CF?]",
      "? And decrease [CF-1]",
    ].join("\n");
    expect(ops(log).map((o) => o.current)).toEqual([5, 6, 6, 5]);
  });

  it("resolves PC resource ops keyed by Character/Resource, per character", () => {
    // The DECL is keyed by resource name; the RUNNING value is per character.
    const decls: Record<string, DialDecl> = {
      "Mystic Mark": { key: "Mystic Mark", min: 0, max: 3, default: 3, name: "Mystic Mark" },
    };
    const seq = ops("[Talon/Mystic Mark-1]\n[Talon/Mystic Mark?]\n[Bram/Mystic Mark-2]", decls);
    expect(seq.map((o) => [o.key, o.current])).toEqual([
      ["Talon/Mystic Mark", 2], // Talon: 3 - 1
      ["Talon/Mystic Mark", 2], // inspect, unchanged
      ["Bram/Mystic Mark", 1], // Bram starts fresh at 3, - 2
    ]);
  });

  it("clamps a PC counter at 0 (can't spend below empty)", () => {
    const decls: Record<string, DialDecl> = {
      "Mystic Mark": { key: "Mystic Mark", min: 0, max: 3, default: 3 },
    };
    expect(ops("[Talon/Mystic Mark-5]", decls)[0].current).toBe(0);
  });
});

describe("normalizeResource", () => {
  it("dial → band as declared", () => {
    expect(normalizeResource({ dial: { abbr: "CF", min: 1, max: 9, default: 5, name: "Chaos Factor" } })).toEqual({
      key: "CF",
      min: 1,
      max: 9,
      default: 5,
      name: "Chaos Factor",
      shape: "dial",
    });
  });

  it("clock/track → 0..max, starts at 0", () => {
    expect(normalizeResource({ clock: { abbr: "RF", name: "Reinforcements", max: 6 } })).toMatchObject({
      key: "RF",
      min: 0,
      max: 6,
      default: 0,
      shape: "clock",
    });
  });

  it("counter/charges → 0..max, starts FULL; keyed by name when no abbr (PC)", () => {
    expect(normalizeResource({ charges: { name: "Mystic Mark", max: 3 } })).toMatchObject({
      key: "Mystic Mark",
      min: 0,
      max: 3,
      default: 3,
      shape: "charges",
    });
  });
});

describe("collectResources", () => {
  it("folds the `dial` aspect + `resources:` into one registry", () => {
    const reg = collectResources([
      { name: "Chaos Factor", dial: { abbr: "CF", min: 1, max: 9, default: 5 } },
      { name: "Fighter", resources: [{ charges: { name: "Second Wind", max: 1 } }] },
    ]);
    expect(reg["CF"]).toMatchObject({ key: "CF", default: 5, shape: "dial" });
    expect(reg["Second Wind"]).toMatchObject({ key: "Second Wind", max: 1, default: 1, shape: "charges" });
  });
});

describe("collectResourceDecls / foldResources (PC-side shared schema)", () => {
  it("folds PC feature `resources:` into a registry keyed by resource name", () => {
    const reg = collectResourceDecls([
      { resources: [{ charges: { name: "Mystic Mark", max: 3, recovery: "short rest" } }] },
      { resources: [{ clock: { name: "Resolve", max: 6 } }] },
      {}, // a feature with no resources contributes nothing
    ]);
    expect(reg["Mystic Mark"]).toMatchObject({ key: "Mystic Mark", max: 3, default: 3, shape: "charges" });
    expect(reg["Resolve"]).toMatchObject({ key: "Resolve", max: 6, default: 0, shape: "clock" });
  });

  it("accumulates into an existing registry, first key winning (GM + PC)", () => {
    const gm = collectResources([{ name: "Chaos Factor", dial: { abbr: "CF", min: 1, max: 9, default: 5 } }]);
    const merged = collectResourceDecls([{ resources: [{ charges: { name: "Ki", max: 2 } }] }], gm);
    expect(merged["CF"]).toMatchObject({ key: "CF", shape: "dial" });
    expect(merged["Ki"]).toMatchObject({ key: "Ki", default: 2, shape: "charges" });
    // foldResources respects first-wins: a later Ki decl doesn't overwrite
    foldResources([{ charges: { name: "Ki", max: 9 } }], merged);
    expect(merged["Ki"].max).toBe(2);
  });
});
