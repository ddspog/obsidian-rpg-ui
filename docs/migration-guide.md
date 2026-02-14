# Block Format Update

## New Unified `rpg` Namespace

Starting with version 2.0, all code blocks use a unified `rpg` namespace with a meta identifier to specify the block type.

### What Changed?

All code blocks now use the format `` ```rpg <type> `` instead of individual block types.

### Block Type Mapping

| Old Format | New Format | Status |
|------------|------------|--------|
| `` ```ability `` | `` ```rpg attributes `` | ✅ Backward compatible |
| `` ```skills `` | `` ```rpg skills `` | ✅ Backward compatible |
| `` ```healthpoints `` | `` ```rpg healthpoints `` | ✅ Backward compatible |
| `` ```stats `` | `` ```rpg stats `` | ✅ Backward compatible |
| `` ```badges `` | `` ```rpg badges `` | ✅ Backward compatible |
| `` ```consumable `` | `` ```rpg consumable `` | ✅ Backward compatible |
| `` ```initiative `` | `` ```rpg initiative `` | ✅ Backward compatible |
| `` ```spell-components `` | `` ```rpg spell `` | ✅ Backward compatible |
| `` ```event-btns `` | `` ```rpg events `` | ✅ Backward compatible |

### Do I Need to Update My Documents?

**No!** All old block types continue to work. The plugin maintains full backward compatibility.

However, we recommend using the new format for new documents:

**Old Format (still works):**
```ability
abilities:
  strength: 14
  dexterity: 16
```

**New Format (recommended):**
```rpg attributes
abilities:
  strength: 14
  dexterity: 16
```

### Why the Change?

The unified namespace enables:
- **Future multi-system support** - Support for Pathfinder, Fate, and other RPG systems
- **New block types** - System definitions, inventory, features, session logs, and battle maps
- **Cleaner codebase** - Single registration point instead of 9+ separate processors
- **Better organization** - All RPG-related blocks under one namespace

### Examples

#### Abilities → Attributes

**Before:**
````md
```ability
abilities:
  strength: 16
  dexterity: 14
  constitution: 15
  intelligence: 10
  wisdom: 12
  charisma: 8
proficiencies:
  - strength
  - constitution
```
````

**After:**
````md
```rpg attributes
abilities:
  strength: 16
  dexterity: 14
  constitution: 15
  intelligence: 10
  wisdom: 12
  charisma: 8
proficiencies:
  - strength
  - constitution
```
````

#### Event Buttons → Events

**Before:**
````md
```event-btns
items:
  - name: Short Rest
    value: short-rest
  - name: Long Rest
    value: long-rest
```
````

**After:**
````md
```rpg events
items:
  - name: Short Rest
    value: short-rest
  - name: Long Rest
    value: long-rest
```
````

#### Spell Components → Spell

**Before:**
````md
```spell-components
verbal: true
somatic: true
material: false
```
````

**After:**
````md
```rpg spell
verbal: true
somatic: true
material: false
```
````

### Coming Soon

The unified namespace sets the foundation for exciting new features:

- **Multi-system support** - Define custom RPG systems in markdown
- **Inventory management** - Track equipment and items
- **Character features** - Class features, feats, and traits
- **Session logs** - Structured session notes with automatic state updates
- **Battle maps** - Hex and square grid maps with tokens

Stay tuned for Phase 2!
