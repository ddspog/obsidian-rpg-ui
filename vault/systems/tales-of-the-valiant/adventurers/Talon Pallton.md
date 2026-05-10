---
cssclasses:
  - hide-title
  - hide-properties
---
```rpg character.header
classes:
  - name: [[Ranger]]
    level: 1
lineage:
  file: [[Elf]]
heritage:
  file: [[Acolyte ᴴ]]
  comment: for Lurker's Hall
background:
  file: [[Celebrity Adventurer's Scion ᴰ]]
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
  d10:
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
STR: 11
DEX: 18
CON: 11
INT: 8
WIS: 15
CHA: 9
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
  Ranger:
    Proficiencies:Tools:
      - "[[Herbalist Tools]]"
    Proficiencies:Skill P.:
      - "[[Athletics]]"
      - "[[Nature]]"
      - "[[Stealth]]"
    Explorer:
      - "[[Climbing]]"
  Acolyte ᴴ:
    Acolyte Features:Languages:
      - "[[Dwarvish]]"
      - "[[Elvish]]"
    Acolyte Features:ability:
      - WIS
  Celebrity Adventurer's Scion ᴰ:
    Celebrity Adventurer's Scion Features:Skill P.:
      - "[[Perception]]"
      - "[[Performance]]"
    Celebrity Adventurer's Scion Features:Languages:
      - "[[Undercommon]]"
    Talent:
      - "[[Noxious Apothecary]]"
trivialized:
  Acolyte ᴴ:
    "0": Acolyte Features
    Acolyte Features:
      - passive:Arcane Tricks
  Elf:
    "0": Elf Lineage Traits
    Elf Lineage Traits:
      - passive:Trance
```
## Spells
```rpg character.spells
style: [Shadow, Rune]
casters:
  Acolyte ᴴ:
    cantrips:
      - "[[Douse Light ᴷ]]"
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Longbow]]"
    notes: Main
  - name: "[[Quiver]]"
    contents:
      - name: "[[Arrows]]"
        qty: 19
  - name: "[[Shortsword]]"
    qty: 2
    slot: main_hand
    notes: For melee, dual
  - name: "[[Leather]]"
    slot: armor
  - name: "[[Clothes, fine]]"
  - name: "[[Waterskin]]"
  - name: "[[Charlatan Tools]]"
  - name: "[[Kowyn's Bag]]"
    container: main
  - name: "[[Pouch]]"
    container: main
currency:
  pp: 0
  gp: 20
  sp: 0
  cp: 0
```