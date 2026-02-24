---
proficiency_bonus: 4
level: 8
---

# Aldric — Multi-class Fighter/Wizard

A battle-hardened warrior who has begun to unlock the secrets of arcane magic.

## Header

```rpg character.header
name: Aldric Ironveil
classes:
  - name: Fighter
    level: 6
  - name: Wizard
    level: 2
race: Half-Elf
background: Soldier
```

## Hit Points

```rpg character.health
max_hp: 68
current_hp: 52
temp_hp: 5
label: Hit Points
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
