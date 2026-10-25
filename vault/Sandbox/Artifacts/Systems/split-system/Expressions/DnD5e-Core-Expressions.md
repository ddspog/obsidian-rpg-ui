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

## Expected Visual

**You should see:**
- 🔢 Header showing "Expressions Definition" with icon and count (3 expressions)
- List of expression cards, each showing:
  - Expression ID in monospace font
  - Parameters list (if any)
  - Formula in code block

**Visual Features:**
- Each expression in its own card
- Syntax-highlighted formula display
- Parameters shown in italics
- Hover effects on cards

## Notes

**New Format Benefits:**
- Uses `rpg system.expressions` (dot notation)
- Direct array format - no `expressions:` wrapper needed
- Multiple expressions in one block
- **Now renders visually!**

**Expressions Included:**
1. **modifier** - Calculate ability modifier from score (e.g., 16 → +3)
2. **proficiency_bonus** - Calculate proficiency bonus from level (e.g., level 5 → +3)
3. **skill_modifier** - Calculate skill modifier with proficiency
