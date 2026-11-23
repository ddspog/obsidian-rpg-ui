import { describe, expect, it } from "vitest";

import { extractEncounter } from "./extract-row";
import { buildMonsterIndex } from "./monster-index";

const index = buildMonsterIndex([
  { note: "b/Bandit.md", name: "Bandit", cr: "1/8" },
  { note: "b/Bandit Captain.md", name: "Bandit Captain", cr: "2" },
  { note: "b/Cultist.md", name: "Cultist", cr: "1/8" },
  { note: "b/Cultist, Fanatic.md", name: "Cultist, Fanatic", cr: "2" },
  { note: "b/Kobold, A.md", name: "Kobold, A", cr: "1/8" },
  { note: "b/Winter Wolf.md", name: "Winter Wolf", cr: "3" },
  { note: "b/Wolf.md", name: "Wolf", cr: "1/4" },
  { note: "b/Wolf, Dire.md", name: "Wolf, Dire", cr: "1" },
  { note: "b/Werebear.md", name: "Werebear", cr: "5" },
  { note: "b/Werewolf.md", name: "Werewolf", cr: "3" },
  { note: "b/Ice Mephit.md", name: "Ice Mephit", cr: "1/2" },
  { note: "b/Mammoth.md", name: "Mammoth", cr: "6" },
  { note: "b/Giant, Frost.md", name: "Giant, Frost", cr: "8" },
  { note: "b/Ghoul.md", name: "Ghoul", cr: "1" },
  { note: "b/Grimlock.md", name: "Grimlock", cr: "1/4" },
  { note: "b/Polar Bear.md", name: "Bear, Polar", cr: "2" },
  { note: "b/Seal.md", name: "Seal", cr: "0" },
  { note: "b/Moose.md", name: "Moose", cr: "1/2" },
  { note: "b/Deer.md", name: "Deer", cr: "0" },
  { note: "b/Shadow.md", name: "Shadow", cr: "1/2" },
  { note: "b/Adult White Dragon.md", name: "Adult White Dragon", cr: "13" },
  { note: "b/Swarm of Rats.md", name: "Swarm of Rats", cr: "1/4" },
  { note: "b/Giant Rat.md", name: "Rat, Giant", cr: "1/8" },
  { note: "b/Ogre.md", name: "Ogre", cr: "2" },
  { note: "b/Wyvern.md", name: "Wyvern", cr: "6" },
  { note: "b/Mimic.md", name: "Mimic", cr: "2" },
]);

const counts = (text: string) => extractEncounter(text, index).monsters.map((m) => [m.name, m.count] as const);

describe("extractEncounter: the Arctic Encounters rows", () => {
  it("counts a captain and two bandits (explicit counts, a fight that can be avoided)", () => {
    const r = extractEncounter(
      "A bandit captain and two bandits are claiming trapped animals when the PCs arrive. The captain accuses the PCs of stealing their kill and reaches for their weapon. Defusing this situation without combat requires a successful DC 11 CHA (Intimidation or Persuasion) check.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count, m.inferred])).toEqual([
      ["Bandit Captain", 1, false],
      ["Bandit", 2, false],
    ]);
    expect(r.monsters[1].matchedText).toBe("two bandits");
    expect(r.monsters[0].note).toBe("b/Bandit Captain.md");
    expect(r.monsters[0].cr).toBe("2");
    expect(r.combat).toBe("likely");
    expect(r.confidence).toBe("high");
    expect(r.unresolved).toEqual([]);
  });

  it("reads 'a team of five kobolds'", () => {
    const r = extractEncounter(
      "A team of five kobolds who seem woefully ill-prepared for the weather and terrain cross paths with the PCs. Though prepared to attack the PCs in the hope of obtaining warm clothes and rations, the kobolds respond positively to an offer of assistance and a successful DC 10 CHA (Persuasion) check.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Kobold, A", 5]]);
    expect(r.combat).toBe("likely");
    expect(r.confidence).toBe("high");
  });

  it("sums a fanatic cultist group and the cultists, and leaves the dire form of the name alone", () => {
    const r = extractEncounter(
      "Two fanatic cultists and six cultists travel the arctic wastes, forcefully converting everyone they meet.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([
      ["Cultist, Fanatic", 2],
      ["Cultist", 6],
    ]);
  });

  it("counts the wolves once and leaves reinforcements out", () => {
    const r = extractEncounter(
      "A pack of four winter wolves prowls the area, hunting for prey, and they regard the PCs as a delicious alternative to moose and deer. If one of the wolves is reduced half its hit point maximum, its keening howl draws another two winter wolves to the area in 1 minute.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Winter Wolf", 4]]);
    expect(r.reasons.join("\n")).toMatch(/reinforcements not counted/);
    expect(r.reasons.join("\n")).toMatch(/prey, the sought or a likeness/);
    expect(r.combat).toBe("likely");
    expect(r.confidence).toBe("high");
  });

  it("counts three werebears on patrol", () => {
    const r = extractEncounter(
      "Three werebears are on patrol. Their village has suffered recently due to bandits.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([
      ["Werebear", 3],
      ["Bandit", 2],
    ]);
    expect(r.monsters[1].inferred).toBe(true);
    expect(r.confidence).toBe("medium");
  });

  it("counts four ice mephits, not the snowballs", () => {
    const r = extractEncounter(
      "The PCs find two neatly stacked piles of twenty snowballs—each concealing a chunk of ice—standing 40 feet apart. Seconds later, four ice mephits arrive, two at each stack, and start chucking the snowballs at the PCs and each other. The snowballs have a range of 20 feet and deal 1d3 bludgeoning damage.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Ice Mephit", 4]]);
    expect(r.unresolved).toEqual([]);
    expect(r.combat).toBe("likely");
  });

  it("reads 'an arctic dire wolf' as one wolf and 'the wolf' as the same one", () => {
    const r = extractEncounter(
      "An arctic dire wolf returns to its pack with its most recent kill. When it notices the PCs, it drops its prey and growls, ready to attack them. The PCs can avoid combat with the wolf by succeeding on a DC 13 WIS (Animal Handling) or CHA (Intimidation) check.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count, m.inferred])).toEqual([["Wolf, Dire", 1, false]]);
    expect(r.reasons.join("\n")).toMatch(/already named/);
    expect(r.combat).toBe("likely");
    expect(r.confidence).toBe("high");
  });

  it("leaves a stalked seal out of the encounter", () => {
    const r = extractEncounter(
      "The PCs interrupt a polar bear stalking a wounded seal, and it turns its attention to them. A successful DC 10 WIS (Insight) check reveals the bear only wants to scare off competitors and won’t engage in combat unless cornered.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Bear, Polar", 1]]);
    expect(r.combat).toBe("likely");
  });

  it("calls the mammoth and frost giant tracks unlikely to be a fight", () => {
    const r = extractEncounter(
      "Mixed footprints made by massive quadrupeds and bipeds leave deep impressions in the snow. A successful DC 14 WIS (Survival) check identifies the creatures as two mammoths and four frost giants and determines they passed through an hour ago. A failure on the check misidentifies any or all the above information, depending on the severity of failure.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([
      ["Mammoth", 2],
      ["Giant, Frost", 4],
    ]);
    expect(r.combat).toBe("unlikely");
    expect(r.confidence).toBe("low");
  });

  it("finds no monster in the earthquake", () => {
    const r = extractEncounter(
      "A minor earthquake causes the snow to give way, creating 20-foot-deep pits. Each PC must succeed on a DC 13 DEX save or fall into a pit, taking 1d6 bludgeoning damage from the softened fall. Climbing out of a pit without assistance requires a successful DC 11 STR (Athletics) check.",
      index
    );
    expect(r.monsters).toEqual([]);
    expect(r.unresolved).toEqual([]);
    expect(r.confidence).toBe("low");
    expect(r.combat).toBe("unlikely");
  });

  it("takes '10 of them animate as ghouls' as ten ghouls", () => {
    const r = extractEncounter(
      "Dozens of corpses stand mid-stride in a ravine, seemingly flash frozen in place. When the noontime sun touches them, 10 of them animate as ghouls. A successful DC 14 INT (Religion) check notes that powerful necrotic energy fills the ravine.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count, m.inferred])).toEqual([["Ghoul", 10, false]]);
    expect(r.combat).toBe("likely");
    expect(r.confidence).toBe("high");
  });

  it("does not take a shadow cast by something for the Shadow", () => {
    const r = extractEncounter(
      "A winged creature’s shadow passes the PCs on its way north. A successful DC 16 INT (Nature) check reveals an adult white dragon as the shadow’s owner. The creature travels to its mountain lair 5 miles distant.",
      index
    );
    expect(r.monsters.map((m) => m.name)).toEqual(["Adult White Dragon"]);
    expect(r.combat).toBe("unlikely");
    expect(r.confidence).toBe("low");
  });

  it("reads a tracked wolf as a trace, not a meeting", () => {
    const r = extractEncounter(
      "The PCs come across a hastily abandoned encampment. If the check’s result is 15 or higher, the PC discovers odd tracks combining features of a wolf and a barefoot Humanoid.",
      index
    );
    expect(r.combat).toBe("unlikely");
    expect(r.confidence).toBe("low");
  });
});

describe("extractEncounter: counts", () => {
  it("keeps the dice and counts their rounded average", () => {
    const r = extractEncounter("1d4 + 1 grimlocks patrol the region and attack the PCs if detected.", index);
    expect(r.monsters).toMatchObject([
      { name: "Grimlock", count: 4, dice: "1d4 + 1", matchedText: "1d4 + 1 grimlocks" },
    ]);
    expect(r.confidence).toBe("high");
  });

  it("reads plain dice, and dice written without spaces", () => {
    expect(extractEncounter("3d4 kobolds who are bolder than they are smart.", index).monsters).toMatchObject([
      { count: 8, dice: "3d4" },
    ]);
    expect(extractEncounter("1d6+3 kobolds attack.", index).monsters).toMatchObject([{ count: 7, dice: "1d6 + 3" }]);
  });

  it("reads dice before a swarm and a plus-one creature after it", () => {
    const r = extractEncounter(
      "1d6 swarms of rats + 1 giant rat that rise up from the sewers or a midden heap.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count, m.dice])).toEqual([
      ["Swarm of Rats", 4, "1d6"],
      ["Rat, Giant", 1, undefined],
    ]);
  });

  it("reads 'a priest and 1d4 acolytes'-style mixed counts", () => {
    const r = extractEncounter("A bandit captain and 1d4 bandits hide in the pass, ready to attack.", index);
    expect(r.monsters.map((m) => [m.name, m.count, m.dice])).toEqual([
      ["Bandit Captain", 1, undefined],
      ["Bandit", 3, "1d4"],
    ]);
  });

  it("reads 'a pair of', number words and digits", () => {
    expect(counts("A pair of ogres attack the PCs.")).toEqual([["Ogre", 2]]);
    expect(counts("A phalanx of 15 ogres attack.")).toEqual([["Ogre", 15]]);
    expect(counts("Twelve ogres attack.")).toEqual([["Ogre", 12]]);
    expect(counts("Twenty ogres attack.")).toEqual([["Ogre", 20]]);
    expect(counts("A dozen ogres attack.")).toEqual([["Ogre", 12]]);
  });

  it("skips a modifier between the number and the name", () => {
    expect(counts("Four hungry, snarling ogres attack.")).toEqual([["Ogre", 2]]); // a comma ends the phrase
    expect(counts("Four hungry ogres attack.")).toEqual([["Ogre", 4]]);
    expect(counts("A healthy frost giant tends to their injured frost giant comrade.")).toEqual([["Giant, Frost", 2]]);
  });

  it("counts a plural with no number as two and says so", () => {
    const r = extractEncounter("Ogres lurk beneath the bridge, ready to attack.", index);
    expect(r.monsters).toMatchObject([{ name: "Ogre", count: 2, inferred: true }]);
    expect(r.reasons.join("\n")).toMatch(/plural with no number/);
    expect(r.confidence).toBe("medium");
  });

  it("counts a bare singular as one and says so", () => {
    const r = extractEncounter("Ogre guards the bridge.", index);
    expect(r.monsters).toMatchObject([{ name: "Ogre", count: 1, inferred: true }]);
  });

  it("does not count 'a' before a plural", () => {
    const r = extractEncounter("A pack of ogres attack.", index);
    expect(r.monsters).toMatchObject([{ name: "Ogre", count: 2, inferred: true }]);
  });

  it("sums repeated mentions of the same creature in one sentence", () => {
    const r = extractEncounter("Two ogres and, further on, six ogres attack the PCs.", index);
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Ogre", 8]]);
    expect(r.monsters[0].matchedText).toBe("Two ogres; six ogres");
    expect(r.reasons.join("\n")).toMatch(/2 mentions of Ogre summed to 8/);
  });

  it("does not add a number from a later sentence to the first group", () => {
    const r = extractEncounter(
      "Three werewolves in Humanoid form approach the PCs. If the PCs attack them, the next night, eight werewolves attack the party.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Werewolf", 3]]);
    expect(r.reasons.join("\n")).toMatch(/later numbers for the same creature not added/);
  });

  it("leaves out a name that modifies a noun", () => {
    const r = extractEncounter(
      "The PCs pass near a wyvern nesting ground. The sound of claws on stone draws the PCs’ attention as five wyverns take to the air to attack them.",
      index
    );
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Wyvern", 5]]);
  });

  it("leaves out what a creature only resembles, and a breeding ground's name", () => {
    expect(counts("A colossus that resembles an ogre guards the door.")).toEqual([]);
    expect(counts("The PCs intrude upon a wyvern breeding ground, occupied by six wyverns.")).toEqual([["Wyvern", 6]]);
  });

  it("does not count a cross-reference in a parenthesis", () => {
    const r = extractEncounter("Four ogres (use ogre stats, see Chapter 8) emerge from caves and attack.", index);
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Ogre", 4]]);
  });

  it("reads links and emphasis as their text", () => {
    expect(counts("Two [[Ogre|ogres]] and a **[[Mimic]]** attack.")).toEqual([
      ["Ogre", 2],
      ["Mimic", 1],
    ]);
  });
});

describe("extractEncounter: unresolved", () => {
  it("lists a number before a plural noun the bestiary does not know", () => {
    const r = extractEncounter("Five shriekers cling to the ceiling, ready to attack.", index);
    expect(r.monsters).toEqual([]);
    expect(r.unresolved).toEqual(["Five shriekers"]);
    expect(r.confidence).toBe("low");
  });

  it("caps confidence at medium when something is unresolved next to a resolved creature", () => {
    const r = extractEncounter("Two ogres and five shriekers attack the PCs.", index);
    expect(r.monsters.map((m) => m.name)).toEqual(["Ogre"]);
    expect(r.unresolved).toEqual(["five shriekers"]);
    expect(r.confidence).toBe("medium");
  });

  it("ignores rule numbers and measures", () => {
    const r = extractEncounter(
      "A successful DC 15 DEX saves the PCs from falling. Pits 20 feet deep, 5 miles distant, 3 rounds, level 5 tiers.",
      index
    );
    expect(r.unresolved).toEqual([]);
  });
});

describe("extractEncounter: the GM's Guide rows read wrong before", () => {
  const big = buildMonsterIndex([
    { note: "b/Lion.md", name: "Lion", cr: "1" },
    { note: "b/Hyena.md", name: "Hyena", cr: "0" },
    { note: "b/Gnoll.md", name: "Gnoll", cr: "1/2" },
    { note: "b/Hyena, Giant.md", name: "Hyena, Giant", cr: "1" },
    { note: "b/Baboon.md", name: "Baboon", cr: "0" },
    { note: "b/Wyrdling.md", name: "Wyrdling", cr: "1/2" },
    { note: "b/Guard.md", name: "Guard", cr: "1/8" },
    { note: "b/Shadow.md", name: "Shadow", cr: "1/2" },
    { note: "b/Spy.md", name: "Spy", cr: "1" },
    { note: "b/Centaur.md", name: "Centaur", cr: "2" },
    { note: "b/Mage.md", name: "Mage", cr: "6" },
    { note: "b/Archmage.md", name: "Archmage", cr: "12" },
    { note: "b/Young Brass Dragon.md", name: "Young Brass Dragon", cr: "6" },
    { note: "b/Jackal.md", name: "Jackal", cr: "0" },
    { note: "b/Selang.md", name: "Selang", cr: "2" },
    { note: "b/Void Piper.md", name: "Void Piper", cr: "4" },
    { note: "b/Insect, Giant Wasp.md", name: "Insect, Giant Wasp", cr: "1/2" },
    { note: "b/Honey Bee, Giant.md", name: "Honey Bee, Giant", cr: "0" },
    { note: "b/Insect, Swarm of Insects.md", name: "Insect, Swarm of Insects", cr: "1/2" },
    { note: "b/Honey Bee, Swarm of Bees.md", name: "Honey Bee, Swarm of Bees", cr: "1/2" },
    { note: "b/Mule.md", name: "Mule", cr: "1/8" },
    { note: "b/Stirge.md", name: "Stirge", cr: "1/8" },
    { note: "b/Giant, Frost.md", name: "Giant, Frost", cr: "8" },
    { note: "b/Insect, Giant Fire Beetle.md", name: "Insect, Giant Fire Beetle", cr: "0" },
    { note: "b/Darkmantle.md", name: "Darkmantle", cr: "1/2" },
    { note: "b/Unearthed.md", name: "Unearthed", cr: "3" },
    { note: "b/Mummy Lord.md", name: "Mummy Lord", cr: "15" },
    { note: "b/Will-o’-Wisp.md", name: "Will-o’-Wisp", cr: "2" },
  ]);
  const read = (text: string) => extractEncounter(text, big);
  const got = (text: string) => read(text).monsters.map((m) => [m.name, m.count] as const);

  it("keeps a hunting party's members: 'hunting party' is no verb", () => {
    expect(
      got("A hunting party of five lions stalks the PCs, trailed by 10 hyenas waiting to steal their kill.")
    ).toEqual([
      ["Lion", 5],
      ["Hyena", 10],
    ]);
  });

  it("reads a gnoll hunting party as no gnoll, and the two that come later", () => {
    expect(
      got(
        "The sound of war drums echoes over the sand as a gnoll hunting party catches the scent of the PCs. At the start of each round for the next minute, two gnolls and 1d4 giant hyenas crest the dune and attack the party."
      )
    ).toEqual([
      ["Gnoll", 2],
      ["Hyena, Giant", 3],
    ]);
  });

  it("drops a row whose creatures don't fight", () => {
    const r = read(
      "Eight baboons keep pace with the PCs. They keep their distance, staying at least 20 feet away at all times, and don’t fight, but they hoot and howl loudly."
    );
    expect(r.combat).toBe("unlikely");
    expect(r.reasons.join("\n")).toMatch(/denied/);
    // a denial with a condition still reads as a fight
    expect(
      read("Three darkmantles hide overhead. They don’t attack any creatures that leave them food.").combat
    ).not.toBe("unlikely");
  });

  it("reads a trio as three", () => {
    expect(got("A trio of wyrdlings are confounded by the threads of fate and attack.")).toEqual([["Wyrdling", 3]]);
  });

  it("does not take everyday words for creatures", () => {
    expect(got("Two iron golems guard the arch and attack. The city guards race toward the building.")).toEqual([]);
    expect(got("Three duergar hide in the shadows and attack.")).toEqual([]);
    expect(got("A hungry lion spies the PCs and attacks.")).toEqual([["Lion", 1]]);
    expect(got("The winds have unearthed a doorway, and a mummy lord emerges to attack.")).toEqual([["Mummy Lord", 1]]);
    expect(got("Three shadows hide against the stone and attack.")).toEqual([["Shadow", 3]]);
  });

  it("leaves out the sought, the dead and the absent", () => {
    expect(got("Five centaurs gallop in search of a spy who stole from them, and attack.")).toEqual([["Centaur", 5]]);
    expect(got("The PCs find the corpse of a young brass dragon. Six jackals lurk nearby and attack.")).toEqual([
      ["Jackal", 6],
    ]);
    expect(
      got("A dying mule lies by the road. Four stirges erupt from the hay; the mule twitches as they attack.")
    ).toEqual([["Stirge", 4]]);
  });

  it("reads 'the haughty mages' as the archmages named", () => {
    expect(got("Three elf archmages search the wastes. The haughty mages attack anyone who refuses them.")).toEqual([
      ["Archmage", 3],
    ]);
  });

  it("reads two names side by side as one creature", () => {
    expect(got("Five selangs and a void piper selang attack the PCs.")).toEqual([
      ["Selang", 5],
      ["Void Piper", 1],
    ]);
  });

  it("takes the stats a parenthesis names", () => {
    expect(
      got(
        "The PCs are beset by four giant bees (use giant wasp) and five swarms of bees (use swarm of insects), and attack."
      )
    ).toEqual([
      ["Insect, Giant Wasp", 4],
      ["Insect, Swarm of Insects", 5],
    ]);
  });

  it("finds the number of a group named with none", () => {
    expect(
      got(
        "A spire crawls with dozens of giant fire beetles. Eight of them stop their work to attack any creatures near."
      )
    ).toEqual([["Insect, Giant Fire Beetle", 8]]);
  });

  it("keeps another of a kind after a possessive", () => {
    expect(got("A healthy frost giant tends to their injured frost giant comrade and attacks.")).toEqual([
      ["Giant, Frost", 2],
    ]);
  });

  it("marks a rank as a doubt", () => {
    const r = read("A frost giant chieftain attacks the PCs.");
    expect(r.monsters.map((m) => [m.name, m.count])).toEqual([["Giant, Frost", 1]]);
    expect(r.confidence).toBe("medium");
  });

  it("matches a name written with an apostrophe and hyphens", () => {
    expect(got("Those following the lights are led astray by six will-o’-wisps.")).toEqual([["Will-o’-Wisp", 6]]);
  });
});

describe("extractEncounter: the Labyrinth and campaign builder rows", () => {
  const idx = buildMonsterIndex([
    { note: "b/Derro.md", name: "Derro", cr: "1/4" },
    { note: "b/Ghost.md", name: "Ghost", cr: "4" },
    { note: "b/Noble.md", name: "Noble", cr: "1/8" },
    { note: "b/Frog, Giant.md", name: "Frog, Giant", cr: "1/4" },
    { note: "b/Mummy.md", name: "Mummy", cr: "3" },
    { note: "b/Mummy Lord.md", name: "Mummy Lord", cr: "15" },
    { note: "b/Bandit.md", name: "Bandit", cr: "1/8" },
    { note: "b/Assassin.md", name: "Assassin", cr: "8" },
    { note: "b/Skeleton.md", name: "Skeleton", cr: "1/4" },
    { note: "b/Knight.md", name: "Knight", cr: "3" },
  ]);
  const got = (text: string) => extractEncounter(text, idx).monsters.map((m) => [m.name, m.count] as const);

  it("does not count a creature another book has, written with its book in brackets", () => {
    expect(got("A derro shadow antipaladin [ToB1] and twelve derro attack the ship.")).toEqual([["Derro", 12]]);
    expect(got("A ghost knight templar [ToB3] leads four ghost knights [ToB1] to attack.")).toEqual([]);
  });

  it("reads 'twenty-four', 'two dozen' and 'three of its'", () => {
    expect(got("A vampire attacks with twenty-four nobles.")).toEqual([["Noble", 24]]);
    expect(got("Two dozen void frogs (use giant frog with the void template) croak and attack.")).toEqual([
      ["Frog, Giant", 24],
    ]);
    expect(got("A mummy lord and three of its servitor mummies awaken and attack.")).toEqual([
      ["Mummy Lord", 1],
      ["Mummy", 3],
    ]);
  });

  it("does not count a creature that names a group ('a bandit gang', 'a skeleton crew')", () => {
    expect(got("A ravenfolk bandit gang (an assassin and eight bandits) attacks.")).toEqual([
      ["Assassin", 1],
      ["Bandit", 8],
    ]);
    expect(got("A tired knight hails the party from a small ship with a skeleton crew, and attacks.")).toEqual([
      ["Knight", 1],
    ]);
  });
});
