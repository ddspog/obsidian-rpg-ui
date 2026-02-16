# D&D 5e Combat Expressions

This file contains combat-related expressions for D&D 5e using the new **dot notation** format.

## Combat Expressions

```rpg system.expressions
- id: saving_throw
  params: [attribute_mod, proficient, proficiency_bonus]
  formula: "{{add attribute_mod (if proficient proficiency_bonus 0)}}"

- id: attack_bonus
  params: [attribute_mod, proficient, proficiency_bonus]
  formula: "{{add attribute_mod (if proficient proficiency_bonus 0)}}"

- id: armor_class
  params: [dex_mod, armor_bonus, shield_bonus]
  formula: "{{add 10 (add dex_mod (add armor_bonus shield_bonus))}}"
```

## Notes

**Demonstrates:**
- Multiple expression files can be loaded
- Expressions are merged from all referenced files
- Combat-specific calculations separated from core

**Expressions Included:**
1. **saving_throw** - Calculate saving throw modifier
2. **attack_bonus** - Calculate attack roll modifier
3. **armor_class** - Calculate AC from components
