import { describe, it, expect } from "vitest";
import { ammoRows, carriedAmmo } from "./ammo";

describe("ammunition", () => {
  const items = [{ name: "[[Longbow]]" }, { name: "[[Quiver]]", contents: [{ name: "[[Arrows]]", qty: 19 }] }];
  const notes = { Quiver: { holds: true, forAmmo: ["[[Arrows]]", "[[Crossbow Bolts]]"], ammoCap: 20 } };

  it("finds what a member carries, in pieces, against its container's cap", () => {
    expect(
      carriedAmmo(
        "Talon",
        items,
        (s) => notes[s as "Quiver"],
        () => false
      )
    ).toEqual({ "talon/quiver/arrows": { qty: 19, cap: 20, at: [1, 0] } });
  });

  it("counts the log's shots and recoveries against what the sheet carried", () => {
    const stacks = carriedAmmo(
      "Talon",
      items,
      (s) => notes[s as "Quiver"],
      () => false
    );
    const rows = ammoRows(
      [{ name: "Talon", page: "Talon Pallton", baseline: stacks, sheet: stacks }],
      [{ owner: "Talon", path: ["Quiver"], name: "Arrows", link: true, delta: -1, depleted: false, sources: [1, 2, 3] }]
    );
    expect(rows[0]).toMatchObject({ kind: "ammo", from: 19, target: 18, max: 20, sheet: 19, ok: false });
  });
});
