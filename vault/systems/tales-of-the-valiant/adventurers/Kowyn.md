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
```rpg character.attacks
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
  sp: 5
  cp: 0
```