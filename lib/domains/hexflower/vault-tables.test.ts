import { describe, expect, it } from "vitest";
import { readTableRef, shortName, tableIn } from "./vault-tables";
import { formatRollOutcome, rollOnce } from "lib/domains/tables/roll";

describe("vault table refs", () => {
  it("reads links with and without a note", () => {
    expect(readTableRef("[[Hexcrawls]]#distinct-hex-elements")).toEqual({
      note: "Hexcrawls",
      name: "distinct-hex-elements",
    });
    expect(readTableRef("[[Hexcrawls#^distinct-hex-elements]]")).toEqual({
      note: "Hexcrawls",
      name: "distinct-hex-elements",
    });
    expect(readTableRef("#distinct-hex-elements")).toEqual({ name: "distinct-hex-elements" });
    expect(readTableRef("Hexcrawls")).toBeNull();
  });

  it("finds the block and rolls it to a short name", () => {
    const text =
      "x\n```rpg table.els\n|d4*|Element|\n|---|---|\n|1-2|**Haunted**\\* – The area is haunted.|\n|3-4|**Spring** – Water.|\n[Els]\n```\n";
    const t = tableIn(text, "els")!;
    expect(t.rows).toHaveLength(2);
    const out = formatRollOutcome(rollOnce(t, [], undefined, () => 0));
    expect(shortName(out)).toBe("Haunted");
    expect(tableIn(text, "nope")).toBeNull();
  });
});
