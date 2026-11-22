import { describe, expect, it } from "vitest";
import { lineageFromNote, lineageFromNpcRow, npcFeatureRows, toStatblockVoice } from "./lineage-template";
import { applyTemplateBlock } from "./template-block";

const GUARD = {
  name: "Guard",
  type: "Medium Humanoid (Any Lineage)",
  cr: "1/8",
  stats: { ac: "16", hp: "11", speed: "30 ft.", senses: "—", languages: "any one language" },
  abilities: { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 },
  features: [{ ref: "@[[Traits]]#Spear" }],
};

describe("toStatblockVoice", () => {
  it("turns the player's words into a statblock's", () => {
    expect(
      toStatblockVoice("You have advantage on saves against becoming poisoned, and you are resistant to poison damage.")
    ).toBe(
      "The {{ self.name() }} has advantage on saves against becoming poisoned, and it is resistant to poison damage."
    );
    expect(toStatblockVoice("As a bonus action, you magically increase in size. Your speed doubles.")).toBe(
      "As a bonus action, it magically increases in size. Its speed doubles."
    );
    expect(toStatblockVoice("Its blood gives you traits in common with Undead. You also have darkvision.")).toBe(
      "Its blood gives it traits in common with Undead. The {{ self.name() }} also has darkvision."
    );
  });
});

describe("lineages", () => {
  it("reads an NPC Features row, its features from the humanoid's statblock", () => {
    const [row] = npcFeatureRows(
      "| Humanoid | Traits | Actions |\n| --- | --- | --- |\n| Kobold | [[Darkvision]] 60 ft., Pack Tactics and Sunlight Sensitivity traits | Scurry bonus action |"
    );
    const block = lineageFromNpcRow({
      ...row,
      features: [
        { name: "Pack Tactics", ref: "@[[K]]#Pack Tactics" },
        { name: "Sunlight Sensitivity", ref: "@[[K]]#Sunlight Sensitivity" },
        { name: "Scurry", ref: "@[[K]]#Scurry" },
      ],
      cr: 0.125,
      source: "Monster Vault",
    });
    expect(block).toMatchObject({ name: "Kobold", kind: "lineage", applies: { anyLineage: true } });
    expect(block.features.map((f) => [f.name, f.type, f.ref])).toEqual([
      ["Pack Tactics", "trait", "@[[K]]#Pack Tactics"],
      ["Sunlight Sensitivity", "trait", "@[[K]]#Sunlight Sensitivity"],
      ["Scurry", "bonus", "@[[K]]#Scurry"],
    ]);
    const r = applyTemplateBlock(GUARD, block, { cr: 0.125, baseFeatures: [] });
    expect(r.data.type).toBe("Medium Humanoid (Kobold)");
    expect(r.data.stats).toMatchObject({ senses: "darkvision 60 ft." });
    expect(r.data.features).toEqual([
      { ref: "@[[Traits]]#Spear" },
      { ref: "@[[K]]#Pack Tactics" },
      { ref: "@[[K]]#Sunlight Sensitivity" },
      { ref: "@[[K]]#Scurry" },
    ]);
  });

  it("keeps a trait with 'and' in its name whole, and reads speeds", () => {
    const block = lineageFromNpcRow({
      humanoid: "Lizardfolk",
      traits: "[[Climbing]] speed of 15 ft., [[swimming]] speed of 30 ft., Heightened Smell and Taste trait",
      actions: "__",
      features: [{ name: "Heightened Smell and Taste", ref: "@[[L]]#H" }],
      source: "Monster Vault",
    });
    expect(block.features.map((f) => f.name)).toEqual(["Heightened Smell and Taste"]);
    const r = applyTemplateBlock(GUARD, block, { cr: 0.125, baseFeatures: [] });
    expect((r.data.stats as Record<string, string>).speed).toBe("30 ft., climb 15 ft., swim 30 ft.");
  });

  it("reads a lineage note's traits, leaving out a player character's", () => {
    const note = [
      "# Dwarf",
      "Your dwarf character has the following hereditary traits.",
      "",
      "*Age.* Dwarves live about 350 years.",
      "",
      "*Size.* Your size is Medium.",
      "",
      "*Speed.* Your base walking speed is 30 feet.",
      "",
      "*Darkvision.* You have darkvision to a range of 60 feet.",
      "",
      "*Dwarven Resilience.* You have advantage on saves against becoming poisoned, and you are resistant to poison damage.",
      "",
      "*Dwarven Toughness.* Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.",
    ].join("\n");
    const l = lineageFromNote("Dwarf", note, "Lineage NPC Traits")!;
    expect(l.block.changes).toEqual([
      { stat: "tag", remove: "Any Lineage", add: "Dwarf" },
      { stat: "size", to: "Medium" },
      { stat: "speed", walk: 30 },
      { stat: "senses", add: "darkvision", range: 60, atLeast: true },
      { stat: "resistant", damage: ["poison"] },
    ]);
    expect(l.features).toEqual([
      {
        id: "Dwarf: Dwarven Resilience",
        name: "Dwarven Resilience",
        type: "trait",
        text: "The {{ self.name() }} has advantage on saves against becoming poisoned, and it is resistant to poison damage.",
      },
    ]);
    expect(l.block.rules).toEqual(["Dwarven Toughness is a player character's trait; it is not added to a statblock."]);
  });
});
