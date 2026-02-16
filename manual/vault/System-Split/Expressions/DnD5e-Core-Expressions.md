# D&D 5e Core Expressions

This file contains core mathematical expressions for D&D 5e using the new **dot notation** format.

## Core Expressions

```rpg system.expressions
- id: modifier
  params: [score]
  formula: "{{floor (divide (subtract score 10) 2)}}"

- id: proficiency_bonus
  params: [level]
  formula: "{{add 1 (floor (divide (subtract level 1) 4))}}"

- id: skill_modifier
  params: [attribute_mod, proficient, proficiency_bonus]
  formula: "{{add attribute_mod (if proficient proficiency_bonus 0)}}"
```

## Notes

**New Format Benefits:**
- Uses `rpg system.expressions` (dot notation)
- Direct array format - no `expressions:` wrapper needed
- Multiple expressions in one block

**Expressions Included:**
1. **modifier** - Calculate ability modifier from score (e.g., 16 → +3)
2. **proficiency_bonus** - Calculate proficiency bonus from level (e.g., level 5 → +3)
3. **skill_modifier** - Calculate skill modifier with proficiency
