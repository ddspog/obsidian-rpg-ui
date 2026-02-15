# D&D 5e System - Split Format

This file demonstrates the **split format** where system components are referenced from external files.

## System Definition

```rpg system
name: "D&D 5e Split"
attributes:
  - strength
  - dexterity
  - constitution
  - intelligence
  - wisdom
  - charisma
skills: "System-Split/Skills/DnD5e-Skills.md"
expressions:
  - "System-Split/Expressions/DnD5e-Core-Expressions.md"
  - "System-Split/Expressions/DnD5e-Combat-Expressions.md"
```

## Visual Test

You should see no UI rendered on this page (definition blocks don't render).

**Expected Console Messages:**
- "DnD UI Toolkit: Loaded system: D&D 5e Split"
- "Loading skills from System-Split/Skills/DnD5e-Skills.md"
- "Loading expressions from System-Split/Expressions/DnD5e-Core-Expressions.md"
- "Loading expressions from System-Split/Expressions/DnD5e-Combat-Expressions.md"
- System should be registered in the global registry

**To verify this system works:**
1. Create a character file using this system
2. Use `rpg skills` blocks referencing this system
3. Use expressions in ability/skill blocks

**This demonstrates:**
- ✅ Single file reference for skills
- ✅ Multiple file references for expressions (array)
- ✅ Cleaner organization with components split across files
