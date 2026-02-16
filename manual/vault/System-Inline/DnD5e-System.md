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

**Expected Visual:** System info card showing the system name, attributes as pills. No file references since this is inline format.

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

**Note:** The `rpg skill-list` block uses the old format with `skills:` wrapper. This still works for backward compatibility, but won't render visually in this version.

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

**Note:** The `rpg expression` blocks use the old single-expression format. These won't render visually in this version.

## Visual Test

**What you should see on this page:**
- ✅ System info card at the top showing "D&D 5e" with 6 attribute pills
- ❌ No visual for `rpg skill-list` (old format - not rendered)
- ❌ No visual for `rpg expression` blocks (old format - not rendered)

**To see visual system definitions:**
Look at the `System-Split` folder which uses the new `rpg system.skills` and `rpg system.expressions` formats!

**Console Messages:**
- "DnD UI Toolkit: Loaded system: D&D 5e"
- System should be registered in the global registry

**To verify this system works:**
1. Create a character file using this system
2. Use `rpg skills` blocks referencing this system
3. Use expressions in ability/skill blocks
