# D&D 5e Skills

This file contains the skill definitions for D&D 5e using the new **dot notation** format.

## Skills Definition

```rpg system.skills
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

## Notes

**New Format Benefits:**
- Uses `rpg system.skills` (dot notation) instead of `rpg system-skills` (hyphen)
- Direct array format - no `skills:` wrapper needed
- Cleaner, more concise YAML

**This file:**
- Is referenced by the main system file
- Contains all 18 D&D 5e skills
- Uses the streamlined format without wrapper fields
