---
cssclasses:
  - hide-title
  - hide-properties
---
```rpg character.header
classes:
  - name: [[Fighter]]
    level: 1
lineage:
  file: [[Syderean]]
heritage:
  file: [[Cosmopolitan]]
  comment: (Baldur's Gate)
background:
  file: [[Sailor ᴰ]]
xp: 88
luck: 0
banner: "#ac8080"
```
```rpg character.health
portrait: [[cleric-harold-davies.webp]]
max_hp: 12
current_hp: 12
temp_hp: 0
hit_dice:
  d8:
    max: 1
    current: 1
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
STR: 18
DEX: 12
CON: 14
INT: 10
WIS: 8
CHA: 11
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
  Druid:
    Proficiencies:
      - "[[Perception]]"
      - "[[Survival]]"
  Twisted Minion ᴴ:
    __auto_0:
      - "[[Draconic]]"
  Kobold:
    Kobold Lineage Traits:
      - Pack
  Fighter:
    Proficiencies:
      - "[[Intimidation]]"
      - "[[Insight]]"
  Syderean:
    Syderean Lineage Traits:
      - Dreadful Guise
  Cosmopolitan:
    __auto_0:
      - "[[Orcish]]"
      - "[[Gnomish]]"
      - "[[Elvish]]"
    Cosmopolitan Features:
      - "[[Orcish]]"
      - "[[Gnomish]]"
      - "[[Elvish]]"
  Sailor ᴰ:
    Talent:
      - "[[Vanguard]]"
```
## Spells
```rpg character.spells
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Glaive +1]]"
    slot: main_hand          # two-handed + reach → fills off_hand
    notes: Primary
  - name: "[[Longsword]]"
    notes: Sidearm (carried)
  - name: "[[Javelin]]"
    qty: 4
    notes: Throwing pile
  - name: "[[Leather]]"
    slot: armor
  - name: "[[Waterskin]]"
    equipped: true
  - "[[Constructor Tools]]"
currency:
  pp: 0
  gp: 42
  sp: 0
  cp: 5
```