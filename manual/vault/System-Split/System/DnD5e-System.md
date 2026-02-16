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

## Expected Visual

**You should see a system info card showing:**
- ⚙️ System name: "D&D 5e Split"
- Attributes section with 6 colored pills (strength, dexterity, constitution, intelligence, wisdom, charisma)
- Skills section showing: 📄 System-Split/Skills/DnD5e-Skills.md
- Expressions section showing:
  - 📄 System-Split/Expressions/DnD5e-Core-Expressions.md
  - 📄 System-Split/Expressions/DnD5e-Combat-Expressions.md

## How This Works

**File References:**
1. **Single file** - `skills` points to one file containing all skills
2. **Multiple files** - `expressions` is an array pointing to multiple files (core and combat expressions)

**External Files:**
- Navigate to referenced files to see their visual cards
- Each file uses `rpg system.X` blocks with visual rendering

## Benefits

✅ **Better organization** - Related components grouped in folders
✅ **Easier maintenance** - Edit skills/expressions without touching main system file
✅ **Visual feedback** - System card shows all file references
✅ **Reusability** - Share skill/expression definitions across multiple systems

**This demonstrates:**
- ✅ Single file reference for skills
- ✅ Multiple file references for expressions (array)
- ✅ Cleaner organization with components split across files
- ✅ **All blocks now render visually!**
