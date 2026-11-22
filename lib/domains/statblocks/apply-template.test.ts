import { describe, expect, it } from "vitest";
import { applyTemplate, formatDefences, parseDefences, withSpeeds, withTag, withType } from "./apply-template";
import { parseMonsterTemplate } from "./monster-template";

const NOTE = "features/Monster Template Traits";

/** A template note from Statistics lines and feature paragraphs, written with headings. */
function template(
  name: string,
  stats: string[],
  traits: string[] = [],
  lead = ""
): ReturnType<typeof parseMonsterTemplate> {
  return parseMonsterTemplate(
    name,
    [
      `# ${name}`,
      "This template can be applied to any Beast or Monstrosity. The creature loses all traits and actions that assume it has a living body, such as Amphibious.",
      "## Statistics",
      lead,
      "",
      ...stats.flatMap((s) => [s, ""]),
      "## Traits",
      ...traits.flatMap((s) => [s, ""]),
    ].join("\n")
  );
}

const OWLBEAR = {
  name: "Owlbear",
  type: "Large [[Monstrosity]] (Animal)",
  cr: "3",
  stats: {
    ac: "14 (natural armor)",
    hp: "80",
    speed: "40 ft.",
    pas_perception: 13,
    pas_stealth: 11,
    resistant: "Monstrosity Resilience",
    senses: "—",
    languages: "—",
  },
  abilities: { str: 5, dex: 1, con: 3, int: -4, wis: 1, cha: -2 },
  features: [{ ref: "@[[Traits]]#Beak" }],
};

describe("defence lines", () => {
  it("keeps damage, conditions and named traits apart", () => {
    const d = parseDefences("fire, cold | charmed | Undead Resilience");
    expect(d).toEqual({ damage: ["fire", "cold"], conditions: ["charmed"], other: ["Undead Resilience"] });
    expect(formatDefences({ ...d, damage: [...d.damage, "fire"] })).toBe("fire, cold | charmed | Undead Resilience");
    expect(parseDefences("—")).toEqual({ damage: [], conditions: [], other: [] });
  });

  it("changes type lines and speeds", () => {
    expect(withType("Large [[Beast]]", "Undead")).toBe("Large [[Undead]]");
    expect(withType("Medium Humanoid (Elf)", "Fiend")).toBe("Medium Fiend (Elf)");
    expect(withTag("Large Monstrosity (Animal)", "Void")).toBe("Large Monstrosity (Animal, Void)");
    expect(withTag("Large Monstrosity (Animal)", "Animal", true)).toBe("Large Monstrosity");
    expect(withSpeeds("40 ft., climb 30 ft.", -10)).toBe("30 ft., climb 20 ft.");
    expect(withSpeeds("15 ft., fly 60 ft.", -10)).toBe("10 ft., fly 50 ft.");
    expect(withSpeeds("30 ft., fly 60 ft.", 15, "fly")).toBe("30 ft., fly 75 ft.");
  });
});

describe("applyTemplate", () => {
  const zombie = template(
    "Zombie",
    [
      "**Type.** The creature’s type changes to Undead. Spells and abilities that affect Undead now affect the creature.",
      "**Armor Class.** The creature’s DEX reduces as indicated in Abilities, reducing its Armor Class accordingly.",
      "**Hit Points.** The creature’s hit points are reduced by 10 percent (rounded up).",
      "**Speed.** All the creature’s movement speeds are reduced by 10 feet. This never reduces a movement speed below 10 feet.",
      "**Senses.** The zombie has darkvision out to a range of 60 feet, if the creature doesn’t already have darkvision.",
      "**Languages.** The zombie understands all languages it knew in life but can’t speak.",
      "**Abilities.** Replace the creature’s existing DEX, INT, WIS, and CHA modifiers with the following modifiers: DEX to −2, INT to −4, WIS to +0, and CHA to −3. If the creature’s existing DEX, INT, WIS, or CHA modifier was already lower than DEX −2, INT −4, WIS +0, and CHA −3, don’t replace the modifier—just use the modifier as is.",
    ],
    [
      "***Undead Resilience.*** The zombie is immune to poison damage, exhaustion, and the poisoned condition.",
      "***Vent.*** Each creature within 5 feet of the zombie must succeed on a DC # [10 + the creature’s CON modifier or matches the save DC of the creature’s other features, whichever is higher] CON save.",
    ]
  );

  it("carries out its statistics: type, HP, speeds, senses, abilities and the AC and skills that follow them", () => {
    const r = applyTemplate(OWLBEAR, zombie, {
      featureNote: NOTE,
      cr: 3,
      baseFeatures: [{ name: "Beak", text: "Hit: 10 piercing damage. DC 13 STR save." }],
    });
    const stats = r.data.stats as Record<string, unknown>;
    expect(r.data.type).toBe("Large [[Undead]] (Animal)");
    expect(stats).toMatchObject({
      hp: "72",
      speed: "30 ft.",
      ac: "11 (natural armor)",
      senses: "darkvision 60 ft.",
      languages: "—",
      pas_perception: 12,
      pas_stealth: 8,
      immune: "Undead Resilience",
    });
    expect(r.data.abilities).toEqual({ str: 5, dex: -2, con: 3, int: -4, wis: 0, cha: -3 });
    // Its features, as refs with their numbers worked out (10 + CON 3, or the DC 13 it has: 13).
    expect(r.data.features).toEqual([
      { ref: "@[[Traits]]#Beak" },
      { ref: `@[[${NOTE}]]#Zombie: Undead Resilience` },
      { ref: `@[[${NOTE}]]#Zombie: Vent`, f1: 13 },
    ]);
    expect(r.added).toEqual(["Undead Resilience", "Vent"]);
    expect(r.manual).toEqual([]);
    // The defence lines keep the statblock's order.
    expect(Object.keys(stats)).toEqual([
      "ac",
      "hp",
      "speed",
      "pas_perception",
      "pas_stealth",
      "resistant",
      "immune",
      "senses",
      "languages",
    ]);
  });

  it("takes a choice for the damage it names, and leaves what it cannot do to a person", () => {
    const infused = template(
      "Element-Infused",
      [
        "**Hit Points.** If the creature’s CR is 19 or lower, its hit points are reduced by 10 percent (rounded up).",
        "**Resistant.** The creature is resistant to the type of damage you didn’t choose. In addition, it is resistant to the charmed condition.",
        "**Immune.** The creature is immune to the type of damage you chose.",
        "**Languages.** The creature learns one language known by its patron.",
      ],
      [],
      "Pick an element and one type of damage associated with it: air (lightning or thunder), fire (acid or fire). Then, make the following adjustments to the creature’s statistics."
    );
    const none = applyTemplate(OWLBEAR, infused, { featureNote: NOTE, cr: 3, baseFeatures: [] });
    expect(none.manual[0]).toMatch(/^Choose with --choose: air \(lightning or thunder\), fire \(acid or fire\)/);
    expect(none.manual).toContain(
      "Resistant: The creature is resistant to the type of damage you didn't choose. In addition, it is resistant to the charmed condition."
    );

    const air = applyTemplate(OWLBEAR, infused, { choice: "thunder", featureNote: NOTE, cr: 3, baseFeatures: [] });
    expect(air.choice).toEqual({ key: "air", damage: "thunder" });
    expect(air.data.stats).toMatchObject({
      resistant: "lightning | charmed | Monstrosity Resilience",
      immune: "thunder",
    });
    expect(air.manual).toEqual(["Languages: The creature learns one language known by its patron."]);
  });

  it("says what the creature loses and which features it changes", () => {
    const t = parseMonsterTemplate(
      "Skeleton",
      [
        "# Skeleton",
        "This template can be applied to any Beast. The creature loses all traits and actions that assume it has a living body, such as Amphibious.",
        "## Actions",
        "***Bite.*** If the skeleton dealt any damage type in addition to piercing with its Bite attack, that damage type changes to necrotic.",
      ].join("\n")
    );
    const r = applyTemplate(OWLBEAR, t, {
      featureNote: NOTE,
      cr: 3,
      baseFeatures: [
        { name: "Amphibious", text: "It breathes water." },
        { name: "Bite", text: "Hit." },
      ],
    });
    expect(r.added).toEqual([]);
    expect(r.manual[0]).toMatch(/^Bite \(changes a feature it has\): If the creature dealt/);
    expect(r.manual[1]).toMatch(/^It loses Amphibious/);
  });
});
