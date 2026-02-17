---
proficiency_bonus: 3
level: 5
class: Cleric
---

# Thorne - Dwarf Cleric

A stalwart cleric of the forge domain, equally comfortable in battle and at the anvil.

## Ability Scores

```rpg attributes
strength: 14
dexterity: 10
constitution: 16
intelligence: 10
wisdom: 16
charisma: 12
```

## Skills

```rpg skills
proficiencies:
  - Religion
  - Medicine
  - Insight
  - Persuasion
```

## Hit Points

```rpg healthpoints
state_key: thorne-hp
label: "Hit Points"
health: 42
hitdice:
  - dice: "d8"
    value: 5
```

## Equipment

```rpg inventory
state_key: thorne-inventory
sections:
  - name: "Weapons"
    items:
      - name: "Warhammer"
        quantity: 1
        equipped: true
      - name: "Light Crossbow"
        quantity: 1
  
  - name: "Armor"
    items:
      - name: "Chain Mail"
        quantity: 1
        equipped: true
      - name: "Shield"
        quantity: 1
        equipped: true
  
  - name: "Holy Items"
    items:
      - name: "Holy Symbol"
        quantity: 1
        equipped: true
      - name: "Prayer Book"
        quantity: 1
```

## Spellcasting

```rpg spell
state_key: thorne-spells
slots:
  - level: 1
    total: 4
    used: 0
  - level: 2
    total: 3
    used: 0
  - level: 3
    total: 2
    used: 0
```

## Class Features

```rpg features
state_key: thorne-features
class: "Cleric"
categories:
  - name: "Class Features"
    icon: "✨"
    features:
      - name: "Channel Divinity"
        level: 2
        type: action
        description: "Turn Undead or use domain power."
        reset_on: short-rest
        uses: 1
        state_key: channel-divinity
      
      - name: "Destroy Undead"
        level: 5
        type: passive
        description: "Channel Divinity destroys undead of CR 1/2 or lower."
  
  - name: "Forge Domain"
    icon: "🔨"
    features:
      - name: "Blessing of the Forge"
        level: 1
        type: action
        description: "Grant +1 AC or attack/damage to weapon or armor."
      
      - name: "Artisan's Blessing"
        level: 2
        type: action
        description: "Create simple metal items with Channel Divinity."
```

## Background

**Background:** Acolyte
**Alignment:** Lawful Good

Thorne comes from a long line of forge clerics, dedicated to both the craft of smithing and the protection of the innocent.
