import { describe, it, expect } from "vitest";
import type { SessionFeatureCard } from "./card-types";
import { economyResources, spendsResource, tileGlyph, tileKind } from "./hotbar-model";

const card = (c: Partial<SessionFeatureCard>): SessionFeatureCard =>
  ({
    id: c.name ?? "x",
    name: "x",
    bucket: "action",
    logTemplate: "",
    actor: "Talon",
    source: "s",
    ...c,
  }) as SessionFeatureCard;

describe("hotbar model", () => {
  it("tells a tile's kind and glyph", () => {
    expect(tileKind(card({ name: "Longbow", bucket: "attack" }))).toBe("attack");
    expect(tileGlyph(card({ name: "Longbow", bucket: "attack" }), "attack")).toBe("Crosshair");
    expect(tileKind(card({ name: "Icicle Javelin", cast: { circle: 1, damage: {} } }))).toBe("spell");
    expect(tileGlyph(card({ name: "Dash" }), "action")).toBe("Wind");
    expect(tileGlyph(card({ name: "Two-Weapon Fighting", bucket: "bonus" }), "bonus")).toBe("Swords");
  });

  it("picks out what spends a pill", () => {
    const bonus = card({ name: "Two-Weapon Fighting", bucket: "bonus" });
    const bow = card({ name: "Longbow", bucket: "attack", riders: [{ name: "Mystic Mark" }] });
    const [action, b] = economyResources({ action: ["Longbow"], bonus: [], reaction: [] });
    expect(action).toMatchObject({ kind: "action", left: 0 });
    expect(spendsResource(bow, "attack", action)).toBe(true);
    expect(spendsResource(bonus, "bonus", b)).toBe(true);
    expect(spendsResource(bow, "attack", { kind: "use", label: "Mystic Mark", max: 2, left: 2 })).toBe(true);
    expect(
      spendsResource(card({ cast: { circle: 1, damage: {} } }), "spell", {
        kind: "slot",
        label: "1st",
        max: 2,
        left: 1,
        circle: 1,
      })
    ).toBe(true);
  });
});
