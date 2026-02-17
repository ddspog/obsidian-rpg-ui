---
proficiency_bonus: 3
level: 5
class: Rogue
---

# Elara - Half-Elf Rogue

A nimble and cunning rogue specializing in stealth and precision strikes.

## Ability Scores

```rpg attributes
strength: 10
dexterity: 18
constitution: 14
intelligence: 12
wisdom: 13
charisma: 8
```

## Skills

```rpg skills
proficiencies:
  - Stealth
  - Acrobatics
  - Sleight of Hand
  - Perception
  - Investigation
expertise:
  - Stealth
  - Thieves' Tools
```

## Hit Points

```rpg healthpoints
state_key: elara-hp
label: "Hit Points"
health: 38
hitdice:
  - dice: "d8"
    value: 5
```

## Equipment

```rpg inventory
state_key: elara-inventory
sections:
  - name: "Weapons"
    items:
      - name: "Shortsword +1"
        quantity: 1
        equipped: true
      - name: "Shortbow"
        quantity: 1
        equipped: true
      - name: "Dagger"
        quantity: 2
  
  - name: "Armor"
    items:
      - name: "Leather Armor"
        quantity: 1
        equipped: true
  
  - name: "Consumables"
    items:
      - name: "Potion of Healing"
        quantity: 2
      - name: "Antitoxin"
        quantity: 1
  
  - name: "Tools"
    items:
      - name: "Thieves' Tools"
        quantity: 1
```

## Class Features

```rpg features
state_key: elara-features
class: "Rogue"
categories:
  - name: "Class Features"
    icon: "⚔️"
    features:
      - name: "Sneak Attack"
        level: 1
        type: passive
        description: "Deal extra {{ceil (divide level 2)}}d6 damage when you have advantage."
      
      - name: "Cunning Action"
        level: 2
        type: action
        description: "Bonus action to Dash, Disengage, or Hide."
      
      - name: "Uncanny Dodge"
        level: 5
        type: reaction
        description: "Halve damage from an attack you can see."
```

## Background

**Background:** Criminal
**Alignment:** Chaotic Good

Elara grew up on the streets, using her quick wits and nimble fingers to survive. Now she uses her skills to help those who can't help themselves.
