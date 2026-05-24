---
cr: 0.25
---

# Goblin

*Small Humanoid (Goblinoid), Neutral Evil*

## Statblock Header

```rpg statblock.header
name: Goblin
size_type: Small Humanoid (Goblinoid)
alignment: Neutral Evil
ac: 15
ac_source: leather armor, shield
hp: 7
hit_dice: 2d6
speed: 30 ft.
```

## Traits

```rpg statblock.traits
senses: darkvision 60 ft., passive Perception 9
languages: Common, Goblin
traits:
  - $name: Nimble Escape
    $contents: The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
```

## Attributes

```rpg statblock.attributes
strength: 8
dexterity: 14
constitution: 10
intelligence: 10
wisdom: 8
charisma: 8
```

## Features

```rpg statblock.features
actions:
  - $name: Scimitar
    $contents: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage."
  - $name: Shortbow
    $contents: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage."
bonus_actions:
  - $name: Nimble Escape
    $contents: The goblin takes the Disengage or Hide action.
```
