---
cssclasses:
  - hide-title
  - hide-properties
---
```rpg character.header
classes:
  - name: [[Druid]]
    level: 1
lineage:
  file: [[Kobold]]
heritage:
  file: [[Twisted Minion ᴴ]]
  comment: of a Dragon
background:
  file: [[Adherent]]
  comment: to an Secret Cult
xp: 88
luck: 0
banner: "#ac8080"
```
```rpg character.health
portrait: [[cleric-harold-davies.webp]]
max_hp: 10
current_hp: 10
temp_hp: 0
hit_dice:
  d8:
    max: 1
    current: 0
death_saves:
  successes: 0
  failures: 0
exhaustion: 0
conditions:
initiative:
  proficiency: 0
  vantage: 0
  bonus: 0
natural_ac: 10
speed:
  value: 30
  type: walking
```
```rpg character.stats
STR: 8
DEX: 12
CON: 14
INT: 11
WIS: 18
CHA: 10
```
```rpg character.senses
```
```rpg character.skills
```
```rpg character.rolls
```
```rpg character.proficiencies
```
## Features
```rpg character.features
choices:
  Adherent:
    __auto_0:Tool P.:
      - "[[Charlatan Tools]]"
    __auto_0:Skill P.:
      - "[[Persuasion]]"
      - "[[Investigation]]"
    Talent:
      - "[[Ritualist]]"
    __auto_0:Tools:
      - "[[Charlatan Tools]]"
  Druid:
    Proficiencies:
      - "[[Perception]]"
      - "[[Survival]]"
  Twisted Minion ᴴ:
    Knowledge Implant, Skills:
      - "[[Nature]]"
    Twisted Minion Features:Languages:
      - "[[Draconic]]"
    Twisted Minion Features:
      - Falling Wings
      - Guardian Bubble
      - Knowledge Implant, Skills
  Kobold:
    Kobold Lineage Traits:
      - Pack
trivialized:
  Twisted Minion ᴴ:
    Twisted Minion Features:
      - passive:Augmented
  Adherent:
    Ritualist:
      - passive:0
```
## Spells
```rpg character.spells
style: [Dragon, Ritual]
casters:
  Druid:
    cantrips:
      - "[[Create Bonfire ᴰ]]"
      - "[[Magnetobolt º]]"
      - "[[Shape Water ᴰ]]"
    prepared:
      "1":
        - "[[Entangle]]"
        - "[[Icicle Javelin º]]"
        - "[[Speak with Animals]]"
        - "[[Thunderwave]]"
        - "[[Toxic Plume º]]"
    rituals:
      "1":
        - "[[Detect Poison and Disease]]"
        - "[[Blood Print º]]"
    spent:
      "1": 1
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Quarterstaff]]"
    notes: SC Focus
    slot: main_hand          # off-hand empty → 2-handed 1d8 mode unlocks
  - name: "[[Leather]]"
    slot: armor
  - name: "[[Shield]]"
    slot: shield
  - "[[Clothes, common]]"
  - name: "[[Druidic Focus]]"
    notes: Totem
  - "[[Waterskin]]"
  - name: "[[Pouch]]"
    contents:
      - "[[Incense (one block) ᴺ]]"
      - "[[Ceremonial Dagger ᴺ]]"
currency:
  pp: 0
  gp: 10
  sp: 0
  cp: 0
```
# Description
```rpg character.description
appearance:
  art:
    src: "[[mounted-combat.webp]]"
    fit: width
    align: top
  side_props:
    - age: 14
      height: "3'3''"
      weight: "35 lb."
    - eyes: Black
      skin: Green-Grey
      hair: None
  body: |
    A small, thin and gaunt kobold. Mostly with gray scales and some spots with green. No hair, just some small horns from his head to tail. The tail is medium sized, coiling when needed and used for closing doors, moving some stuff.
  clothes: |
    Basic clothes and cloak to hid figure, so people will need to look carefully to see a kobold in cloak. Wears some gloves to complete the disguise.
backstory:
  homeland: "[[Mt. Aleldath]]"        
  text: |
    Kowyn was one of the various Kobolds born on the underground caves below Mt. Aleldath. His group was part of a secret cult dedicated to an Ancient Dragon overseeing the caves around him. This dragon wasn't a benevolent master, and to improve his army started making experiments on them, augmenting his ranks, where Kowyn was augmented.

    Being directed to a spellcaster life, Kowyn grew up with other similar Kobolds, an warlock, a wizard, etc. He grew sick of the sacrifices being made on the cult, and decided to try learning about the world alone. His old overload soon was onto him, gathering other Kobolds to follow. Also, Kowyn cannot snitch his cult. He's bound by magic on silence about it, he and the other Kobolds. He doesn't even remember the title of its master, since he ran away.

    One of his overlord treasures, a bag of holding, was soon stolen, and Kowyn realized that he could sleep inside it, using his augmentations. He then started using the bag of holding to help him escape, and in that form he was found.
  highlights:
    - key: "Run Away"
      value: "Ran from a secret cult, and it's overlord."
    - key: "Experiment"
      value: "His overlord performed experiments on."
allies:
enemies:
  - name: "Old Cult"
    portrait: "🏛️"
    text: Kowyn still needs to be careful, as there's various Kobolds after him around Mt. Aleldath. His old overlord is even powerful enough to prolong the search to other countries. Still, the cult operates on the mountains, underground on big caves.
organizations:
motivation:
  - text: "Many adherents don’t stray far from the object of their devotion. Those who roam often do so for reasons specific to their order."
  - text: "Staying on the move keeps me from being dragged back to the order from which I narrowly escaped."
```
