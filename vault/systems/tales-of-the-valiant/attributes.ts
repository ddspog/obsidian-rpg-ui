import { AttributeDefinition } from "rpg-ui-toolkit";

const attributes: AttributeDefinition[] = [
  {
    $name: "Strength",
    alias: "STR",
    subtitle: "Associated Skills: Athletics",
    measures: "Physical might",
    $contents: `Strength measures bodily power, athletic aptitude, and the extent to which you can exert raw physical force. STR is used to: 
- Calculate attack rolls and damage with melee weapons 
- Determine how much weight can be lifted or carried 

Use STR for checks that involve feats of bodily force, such as: 

- Kicking down a door, breaking free of bonds, or smashing a lock 
- Pulling, pushing, or lifting heavy objects 
- Climbing a rope or swimming against the current 
- Resisting an attempt to grab, pull, or push you`,
  },
  {
    $name: "Dexterity",
    alias: "DEX",
    subtitle: "Associated Skills: Acrobatics, Sleight of Hand, Stealth",
    measures: "Agility, reflexes, and balance",
    $contents: `Dexterity measures agility, reflexes, and balance. DEX is used to:
- Calculate attack rolls and damage with ranged weapons or melee weapons with the Finesse property
- Calculate Armor Class
- Determine initiative order during encounter gameplay

Use DEX for checks that involve reflexes, precise motion, or swift response time such as:
- Maintaining balance while on a moving vehicle or scooting along a narrow ledge
- Picking a pocket without being noticed
- Picking a lock or disabling a trap
- Crafting a small or detailed object
- Moving silently or sneaking up on prey
- Resisting an attempt to grab, pull, or push you`,
  },
  {
    $name: "Constitution",
    alias: "CON",
    subtitle: "Associated Skills: None",
    measures: "Health and stamina",
    $contents: `Constitution measures health, stamina, and vital force. CON is used to:
- Calculate hit points (HP)

Use CON for checks that involve endurance or weathering extreme conditions, such as:
- Holding your breath
- Extended marching or labor without rest
- Going without sleep
- Surviving without food or water
- Quaffing an entire stein of ale in one go`,
  },
  {
    $name: "Intelligence",
    alias: "INT",
    subtitle: "Associated Skills: Arcana, History, Investigation, Nature, Religion",
    measures: "Reasoning and memory",
    $contents: `Intelligence measures mental acuity, accuracy of recall, and the ability to reason. INT is used to:
- Calculate certain class spellcasting abilities

Use INT for checks to draw on logic, education, memory, or deductive reasoning, such as:
- Communicating without using words
- Estimating the value of a precious item
- Forging a document
- Recalling lore about a craft or trade
- Winning a game of skill`,
  },
  {
    $name: "Wisdom",
    alias: "WIS",
    subtitle: "Associated Skills: Animal Handling, Insight, Medicine, Perception, Survival",
    measures: "Perceptiveness and mental fortitude",
    $contents: `Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition. WIS is used to:
- Calculate certain class spellcasting abilities

Use WIS for checks to intuit clues about the environment and people or treat the injured, such as:
- Getting a gut feeling about next steps
- Discerning if a seemingly dead creature is Undead
- Picking up on subtle signals happening around you
- Bandage a wound or recognize a disease`,
  },
  {
    $name: "Charisma",
    alias: "CHA",
    subtitle: "Associated Skills: Deception, Intimidation, Performance, Persuasion",
    measures: "Confidence, poise, and charm",
    $contents: `Charisma measures your ability to interact with others and can represent a charming or commanding personality. CHA is used to:
- Calculate certain class spellcasting abilities

Use CHA for checks to influence or entertain, make an impression, tell a convincing lie, or navigate a tricky social situation, such as:
- Finding the best person to talk to for news, rumors, and gossip
- Pulling together a disguise to pass as a city guard
- Blending into a crowd to get the sense of key topics of conversation`,
  },
];

export default attributes;
