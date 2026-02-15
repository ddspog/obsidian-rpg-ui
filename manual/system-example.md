# D&D 5e System Example

This is an example of how to define a custom RPG system. This file demonstrates the syntax for defining system rules.

## System Definition

```rpg system
name: "D&D 5th Edition"
attributes:
  - strength
  - dexterity
  - constitution
  - intelligence
  - wisdom
  - charisma

types:
  character:
    fields:
      - name: level
        type: number
        default: 1
      - name: proficiency_bonus
        type: number
        derived: "{{level_to_proficiency level}}"
        aliases: [proficiencyBonus, "Proficiency Bonus"]
      - name: class
        type: string
      - name: subclass
        type: string
      
  monster:
    fields:
      - name: cr
        type: number
        default: 0
      - name: type
        type: string
        default: "beast"
```

## Expressions

### Ability Modifier

```rpg expression
id: modifier
description: "Calculate ability modifier from score"
params:
  - score
formula: "{{floor (divide (subtract score 10) 2)}}"
```

### Saving Throw

```rpg expression
id: saving_throw
description: "Calculate saving throw bonus"
params:
  - modifier
  - proficient
  - proficiency_bonus
  - bonus
formula: "{{add modifier (if proficient proficiency_bonus 0) bonus}}"
```

### Skill Modifier

```rpg expression
id: skill_modifier
description: "Calculate skill modifier including proficiency"
params:
  - attribute_mod
  - proficiency_bonus
  - proficiency_level
  - bonus
formula: "{{add attribute_mod (multiply proficiency_bonus proficiency_level) bonus}}"
```

## Skills

```rpg skill-list
skills:
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Animal Handling"
    attribute: wisdom
  - label: "Arcana"
    attribute: intelligence
  - label: "Athletics"
    attribute: strength
  - label: "Deception"
    attribute: charisma
  - label: "History"
    attribute: intelligence
  - label: "Insight"
    attribute: wisdom
  - label: "Intimidation"
    attribute: charisma
  - label: "Investigation"
    attribute: intelligence
  - label: "Medicine"
    attribute: wisdom
  - label: "Nature"
    attribute: intelligence
  - label: "Perception"
    attribute: wisdom
  - label: "Performance"
    attribute: charisma
  - label: "Persuasion"
    attribute: charisma
  - label: "Religion"
    attribute: intelligence
  - label: "Sleight of Hand"
    attribute: dexterity
  - label: "Stealth"
    attribute: dexterity
  - label: "Survival"
    attribute: wisdom
```

## Usage

To use this system:

1. Save this file in your vault (e.g., `Systems/DnD 5e.md`)
2. Open plugin settings
3. Add a system mapping:
   - Folder: `Characters/DnD` (or leave empty for vault-wide default)
   - System file: `Systems/DnD 5e.md`
4. All character files in that folder will use this system's rules

## Notes

- The built-in D&D 5e system is used by default when no mapping is configured
- System definition blocks don't render visible UI - they define rules
- Changes to the system file are detected and reloaded automatically
- Multiple folders can use different systems
