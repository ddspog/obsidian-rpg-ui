# D&D 5e System - Inline Format

This file demonstrates the **inline format** where all system components are defined in a single file.

## System Definition

```rpg system
name: "D&D 5e"
attributes:
  - strength
  - dexterity
  - constitution
  - intelligence
  - wisdom
  - charisma
```

## Skills (Inline)

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

## Expressions (Inline)

```rpg expression
id: modifier
params: [score]
formula: "{{floor (divide (subtract score 10) 2)}}"
```

```rpg expression
id: proficiency_bonus
params: [level]
formula: "{{add 1 (floor (divide (subtract level 1) 4))}}"
```

```rpg expression
id: skill_modifier
params: [attribute_mod, proficient, proficiency_bonus]
formula: "{{add attribute_mod (if proficient proficiency_bonus 0)}}"
```

```rpg expression
id: saving_throw
params: [attribute_mod, proficient, proficiency_bonus]
formula: "{{add attribute_mod (if proficient proficiency_bonus 0)}}"
```

```rpg expression
id: attack_bonus
params: [attribute_mod, proficient, proficiency_bonus]
formula: "{{add attribute_mod (if proficient proficiency_bonus 0)}}"
```

## Visual Test

You should see no UI rendered on this page (definition blocks don't render).

**Expected Console Messages:**
- "DnD UI Toolkit: Loaded system: D&D 5e"
- System should be registered in the global registry

**To verify this system works:**
1. Create a character file using this system
2. Use `rpg skills` blocks referencing this system
3. Use expressions in ability/skill blocks
