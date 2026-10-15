import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { conditionChange, conditionsNow, resourcesSpent } from "./conditions";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));

describe("conditionsNow", () => {
  it("gives and lifts the party's and the foes' conditions", () => {
    const now = conditionsNow(
      segments([
        "? Fight. [F:Fat [[Kobold, A]]|HP 9]",
        "@(Kowyn) Javelin → Fat Kobold, A",
        "=> [F:Fat Kobold, A|+pinned]",
        "=> Lilith went down. [PC:Lilith|+prone]",
        "=> [PC:Lilith|-prone]",
      ])
    );
    expect([...(now.get("fat kobold, a")?.keys() ?? [])]).toEqual(["pinned"]);
    expect([...(now.get("lilith")?.keys() ?? [])]).toEqual([]);
  });

  it("keeps what left a condition, and lifts it whatever left it", () => {
    const tagged = (lines: string[]) =>
      conditionsNow(segments(["? Fight. [F:[[Kobold, Elite]]|HP 26]", ...lines])).get("kobold, elite");
    expect(tagged(["=> [F:Kobold, Elite|+pinned([[Icicle Javelin º]])]"])?.get("pinned")).toBe("Icicle Javelin º");
    expect(
      tagged(["=> [F:Kobold, Elite|+pinned([[Icicle Javelin º]])]", "=> [F:Kobold, Elite|-pinned]"])?.has("pinned")
    ).toBe(false);
  });
});

describe("a condition that lasts until the end of its bearer's next turn", () => {
  const log = [
    "? Fight. [F:[[Kobold, Elite]]|HP 26]",
    "[COMBAT]",
    "T1",
    "R(Kobold, Elite)",
    "@(Kobold, Elite) Sling → Kowyn",
    "R(Jacqui)",
    "@(Jacqui) Luminous Bolt → Kobold, Elite",
    "=> [F:Kobold, Elite|+blinded([[Luminous Bolt ᴷ]])]",
    "T2",
    "R(Kobold, Elite)",
    "@(Kobold, Elite) Moves",
  ];
  const bolt = (c: string, from?: string) =>
    c === "blinded" && from === "Luminous Bolt ᴷ" ? ("end-of-next-turn" as const) : undefined;

  it("holds through its bearer's next round, and ends with it", () => {
    expect(conditionsNow(segments(log), bolt).get("kobold, elite")?.has("blinded")).toBe(true);
    expect(
      conditionsNow(segments([...log, "R(Talon)"]), bolt)
        .get("kobold, elite")
        ?.has("blinded")
    ).toBe(false);
  });

  it("stays without a duration", () => {
    expect(
      conditionsNow(segments([...log, "R(Talon)"]))
        .get("kobold, elite")
        ?.has("blinded")
    ).toBe(true);
  });
});

describe("conditionChange", () => {
  it("reads a condition, given or lifted, with its source or without", () => {
    expect(conditionChange("+pinned([[Icicle Javelin º]])")).toEqual({
      add: true,
      condition: "pinned",
      from: "Icicle Javelin º",
    });
    expect(conditionChange("+restrained(Web)")).toEqual({ add: true, condition: "restrained", from: "Web" });
    expect(conditionChange("-Prone")).toEqual({ add: false, condition: "prone" });
    expect(conditionChange("HP-5")).toBeNull();
    expect(conditionChange("HP 9")).toBeNull();
  });
});

describe("resourcesSpent", () => {
  it("nets each character's slots and uses spent", () => {
    const spent = resourcesSpent(
      segments([
        "@(Kowyn) Javelin → Kobold",
        "=> [Kowyn/1st-Circle Slot-1]",
        "@(Kowyn) Entangle",
        "=> [Kowyn/1st-Circle Slot-1]",
        "@(Talon) Longbow → Kobold",
        "=> [Talon/Mystic Mark-1]",
        "=> [Talon/Mystic Mark+1]",
      ])
    );
    expect(spent).toEqual([{ who: "Kowyn", resource: "1st-Circle Slot", change: -2 }]);
  });
});
