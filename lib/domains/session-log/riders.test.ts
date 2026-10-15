import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { foldHealth } from "./health";
import { foldFoes } from "./foes";
import { onAMiss, withRiders } from "./riders";
import { resolveLogTemplate } from "./template-resolver";
import { sessionActionCards } from "./session-actions";

const attack = [
  '@({{actor}}) @[[Talon Pallton|Talon]].action("Shortbow") → {{target}}',
  "d: Attack | d20+6= vs AC {{target_ac}} ->",
  "d: Piercing damage | 1d8+4=",
].join("\n");
const mark = { name: "Mystic Mark", damage: "1d4", cost: { resource: "Mystic Mark", amount: 1 }, mark: "marked" };

describe("riders on an attack card", () => {
  it("are offered by attacks, never as cards of their own", () => {
    const cards = sessionActionCards(
      [
        { name: "Shortbow", hit: "+6", damage: "1d8+4 piercing" },
        {
          name: "Mystic Mark",
          rider: { damage: "1d4 origin", cost: { resource: "Mystic Mark", amount: 1 }, mark: "marked" },
        },
        { name: "Dash" },
      ],
      "Talon",
      "pc:Talon"
    );
    expect(cards.map((c) => c.name)).toEqual(["Shortbow", "Dash"]);
    expect(cards[0].riders).toEqual([mark]);
    expect(cards[1].riders).toBeUndefined();
  });

  it("write the rider in: named with the attack, its damage, its mark and its use", () => {
    const out = withRiders(attack, [{ rider: mark, free: false }], {
      actor: "Talon",
      targetIsFoe: true,
      markedNow: () => ["Thin Kobold, A"],
    });
    expect(out.split("\n")).toEqual([
      '@({{actor}}) @[[Talon Pallton|Talon]].action("Shortbow") → {{target}} with @[[Talon Pallton|Talon]].action("Mystic Mark")',
      "d: Attack | d20+6= vs AC {{target_ac}} ->",
      "d: Piercing damage | 1d8+4=",
      "d: Mystic Mark damage | 1d4=",
      "=> [F:Thin Kobold, A|-marked] [F:{{target}}|+marked] [Talon/Mystic Mark-1]",
    ]);
  });

  it("ride free on a target already marked — the die only", () => {
    const out = withRiders(attack, [{ rider: mark, free: true }], { actor: "Talon", targetIsFoe: true });
    expect(out).toContain("d: Mystic Mark damage | 1d4=");
    expect(out).not.toContain("=>");
  });

  it("count as damage on a hit, and mark the target", () => {
    const text = resolveLogTemplate(
      withRiders(attack, [{ rider: mark, free: false }], { actor: "Talon", targetIsFoe: true }),
      {
        actor: "Talon",
        target: "Fat Kobold, A",
        target_ac: "",
      }
    )
      .replace("d20+6=", "d20+6=15")
      .replace("1d8+4=", "1d8+4=9")
      .replace("1d4=", "1d4=2");
    const segs = groupIntoProse(parseLonelog(`? Fight. [F:Fat [[Kobold, A]]|HP 9]\n${text}`));
    const hit = [
      ...foldHealth(
        segs,
        () => undefined,
        () => 12
      ).hits.values(),
    ][0];
    expect(hit).toMatchObject({ target: "Fat Kobold, A", hit: true, damage: 11 });
    const foes = [...foldFoes(segs).values()].pop()!;
    expect(foes.find((f) => /Fat/.test(f.name))?.conditions).toEqual(["marked"]);
  });
});

describe("a martial action riding with an attack", () => {
  const glaive =
    '@({{actor}}) @[[Lilith]].action("Glaive") → {{target}}\nd: Attack | d20+5= vs AC {{target_ac}} ->\nd: Slashing damage | 1d10+3=';
  const ctx = { actor: "Lilith", targetIsFoe: true };
  const windUp = { rider: { name: "Wind Up", damage: "2", takes: "bonus" as const }, free: false };
  const aim = { rider: { name: "Aim", hit: "2", takes: "bonus" as const }, free: false };

  it("adds its PB to the weapon's own damage — same type — and nothing to spend", () => {
    expect(withRiders(glaive, [windUp], ctx).split("\n")).toEqual([
      '@({{actor}}) @[[Lilith]].action("Glaive") → {{target}} with @[[Lilith]].action("Wind Up")',
      "d: Attack | d20+5= vs AC {{target_ac}} ->",
      "d: Slashing damage | 1d10+3+2=",
    ]);
  });

  it("adds its PB to the attack roll", () => {
    expect(withRiders(glaive, [aim], ctx).split("\n")[1]).toBe("d: Attack | d20+5+2= vs AC {{target_ac}} ->");
  });

  it("stays on a miss — its bonus action spent — without its damage; Mystic Mark goes", () => {
    const mark = { rider: { name: "Mystic Mark", damage: "1d4", mark: "marked" }, free: false };
    const kept = onAMiss([windUp, mark]);
    expect(kept.map((p) => [p.rider.name, p.rider.damage])).toEqual([["Wind Up", undefined]]);
    expect(withRiders(glaive, kept, ctx)).toContain("1d10+3=");
  });
});
