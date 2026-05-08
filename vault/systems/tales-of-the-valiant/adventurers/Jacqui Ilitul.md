```rpg character.sheet
# Header
classes:
  - name: [[Cleric]]
    level: 1
lineage:
  file: [[Human]]
heritage:
  file: [[Great House ᴷ]]
  comment: of [[Ilitul]] ([[Borelhearth]])
background:
  file: [[Adherent]]
  comment: to [[Lusanda, the Muse]]
xp: 88
luck: 0
banner: "#ac8080"
# Health
portrait: [[cleric-harold-davies.webp]]
max_hp: 9
current_hp: 9
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
natural_ac: 10

# Attributes
STR: 14
DEX: 11
CON: 12
INT: 8
WIS: 18
CHA: 10
```
## Features
```rpg character.features
choices:
  Cleric:
    Proficiencies:
      - "[[Medicine]]"
      - "[[Insight]]"
    Manifestation of Faith:
      - Might
    Might:
      - "[[Warhammer]]"
  Human:
    Human Lineage Traits:Size:
      - Medium
    Human Lineage Traits:Skill P.:
      - "[[Stealth]]"
    Human Lineage Traits:Talent:
      - "[[Comrade]]"
  Great House:
    __auto_0:Languages:
      - "[[Dwarvish]]"
    __auto_0:Weapons:
      - "[[Northlands Estoc ᴷ]]"
  Adherent:
    __auto_0:Skill P.:
      - "[[Investigation]]"
      - "[[Religion]]"
    Talent:
      - "[[Field Medic]]"
    __auto_0:Tool P.:
      - "[[Constructor Tools]]"
    __auto_0:Tools:
      - "[[Constructor Tools]]"
  Great House ᴷ:
    __auto_0:Languages:
      - "[[Dwarvish]]"
    __auto_0:Weapons:
      - "[[Northlands Estoc ᴷ]]"
    Great House Features:Weapons:
      - "[[Northlands Estoc ᴷ]]"
    Great House Features:Languages:
      - "[[Dwarvish]]"
```
## Spells
```rpg character.spells
style: [Dream, Portal]
casters:
  Cleric:
    cantrips:
      - "[[Guidance]]"
      - "[[Luminous Bolt ᴷ]]"
      - "[[Message]]"
    prepared:
      "1":
        - "[[Arcane Mark ᴴ]]"
        - "[[Cure Wounds]]"
        - "[[Last Strike ᴷ]]"
        - "[[Lunarbolt Waxing ᴷ]]"
        - "[[Sanctuary]]"
    rituals:
      "1":
        - "[[Clue º]]"
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Warhammer]]"
    slot: main_hand
    notes: For melee range
  - name: "[[Chain Mail]]"
    slot: armor
    notes: Heavy Armor, [[Noisy]]
  - name: "[[Clothes, common]]"
    notes: (worn)
  - name: "[[Holy Symbol]]"
    notes: An amulet for [[Lusanda, the Muse]] (Under clothes)
  - name: "[[Holy Symbol]]"
    notes: An emblem of [[Aderyn, the Fuel]] (Near neck)
  - name: "[[Waterskin]]"
  - name: "[[Pouch]]"
    contents:
      - name: "[[Incense (one block) ᴺ]]"
      - name: "[[Prayer book ᴺ]]"
      - name: "[[Contract, Lurkers Hall ᴺ]]"
currency:
  pp: 0
  gp: 10
  sp: 0
  cp: 0
```