---
xp: 34000
luck: 2
---
```rpg character.header
name: Aldric Ironveil
classes:
  - name: [[Druid]]
    level: 6
  - name: [[Ranger]]
    level: 2
lineage: [[Elf]]
heritage: [[Cosmopolitan]]
background: [[Adherent]]
```
```rpg character.health
max_hp: 68
current_hp: 52
temp_hp: 5
label: Hit Points
```
```rpg character.stats
STR:
  value: 16
  save:
    proficiency: 1
    vantage: 0
    bonus: 0
DEX:
  value: 12
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
CON:
  value: 14
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
INT:
  value: 13
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
WIS:
  value: 11
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
CHA:
  value: 10
  save:
    proficiency: 0
    vantage: 0
    bonus: 0
```
```rpg character.senses
senses_list:
  - type: darkvision
    range: 60
```
```rpg character.skills
Acrobatics:
  proficiency: 0
  vantage: 0
  bonus: 0
"Animal Handling":
  proficiency: 0
  vantage: 0
  bonus: 0
Arcana:
  proficiency: 0
  vantage: 0
  bonus: 0
Athletics:
  proficiency: 1
  vantage: 0
  bonus: 0
Deception:
  proficiency: 0
  vantage: 0
  bonus: 0
History:
  proficiency: 0
  vantage: 0
  bonus: 0
Insight:
  proficiency: 0
  vantage: 0
  bonus: 0
Intimidation:
  proficiency: 0
  vantage: 0
  bonus: 0
Investigation:
  proficiency: 0
  vantage: 0
  bonus: 0
Medicine:
  proficiency: 0
  vantage: 0
  bonus: 0
Nature:
  proficiency: 0
  vantage: 0
  bonus: 0
Perception:
  proficiency: 0
  vantage: 0
  bonus: 0
Performance:
  proficiency: 0
  vantage: 0
  bonus: 0
Persuasion:
  proficiency: 0
  vantage: 0
  bonus: 0
Religion:
  proficiency: 0
  vantage: 0
  bonus: 0
"Sleight of Hand":
  proficiency: 0
  vantage: 0
  bonus: 0
Stealth:
  proficiency: 0
  vantage: 0
  bonus: 0
Survival:
  proficiency: 0
  vantage: 0
  bonus: 0
```
## Attacks
```rpg character.attacks
attacks:
  - name: Longsword
    toHit: 6
    range: melee
    damage: 8
  - name: Light Crossbow
    toHit: 4
    range: 80/320
    damage: 6
```
## Proficiencies
```rpg character.proficiencies
weapons:
  - Longsword
  - Light Crossbow
armor:
  - Chain Mail
tools:
  - Thieves' Tools
languages:
  - Common
  - Elvish
```
## Features
```rpg character.features
title: Class Features
features:
  - name: Action Surge
    type: action
    description: Take one additional action on your turn. Usable once per short rest.
  - name: Extra Attack
    type: passive
    description: Attack twice whenever you take the Attack action.
  - name: Arcane Recovery
    type: passive
    description: Recover expended spell slots during a short rest (up to half wizard level).
```
## Spells
```rpg character.spells
title: Prepared Spells
spells:
  - name: Fire Bolt
    circle: "0"
    prepared: true
  - name: Mage Armor
    circle: "1"
    prepared: true
  - name: Shield
    circle: "1"
    prepared: true
  - name: Misty Step
    circle: "2"
    prepared: false
```
