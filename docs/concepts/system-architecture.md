# System Architecture

The RPG UI Toolkit uses a flexible system abstraction layer that allows multiple RPG systems (D&D 5e, Fate, etc.) to be supported with their own rules and mechanics.

## Overview

A **system** defines:
- Core attributes (e.g., Strength, Dexterity for D&D 5e)
- Skills and their attribute associations
- Mathematical expressions for calculations
- Feature types and their display order
- Entity types (character, class, race, monster, etc.)
- Provider/Collector relationships for features

## Feature Provider/Collector Pattern

The system uses a provider/collector pattern to manage features across different entity types:

### Feature Collectors

**Collectors** are entity types that **receive and display** features from other files. Examples:
- `character` - Player characters
- `monster` - NPCs and creatures

A character note automatically collects features from:
- Their class (based on frontmatter `class` field)
- Their race (based on frontmatter `race` field)
- Direct features defined in the character's own `rpg features` block

### Feature Providers

**Providers** are entity types that **define features to pass on** to collectors. Examples:
- `class` - D&D classes (Fighter, Wizard, etc.)
- `race` - D&D races (Human, Elf, etc.)

A class note defines features that characters of that class will receive, often with level requirements.

### Example Flow

```
Fighter.md (class provider)
├─ rpg features
│  └─ Second Wind (level 1, type: bonus_action)
│  └─ Action Surge (level 2, type: active)
│  └─ Extra Attack (level 5, type: passive)

Human.md (race provider)
├─ rpg features
│  └─ Extra Language (no level requirement)
│  └─ Versatile (+1 to all abilities)

Conan.md (character collector)
├─ frontmatter: class: Fighter, race: Human, level: 5
└─ Displays all features:
   - Second Wind (from Fighter)
   - Action Surge (from Fighter)
   - Extra Attack (from Fighter)
   - Extra Language (from Human)
   - Versatile (from Human)
```

## System Definition

In the system configuration (`lib/systems/dnd5e.ts` for D&D 5e), you define:

### Feature System Configuration

The `features` object in the system defines the complete feature system:

```typescript
features: {
  categories: [
    { id: "action", label: "Action", icon: "⚔️" },
    { id: "bonus_action", label: "Bonus Action", icon: "⚡" },
    { id: "reaction", label: "Reaction", icon: "🛡️" },
    { id: "passive", label: "Passive", icon: "👁️" },
    { id: "active", label: "Active", icon: "✨" },
  ],
  providers: ["class", "race"],
  collectors: ["character", "monster"],
}
```

**The order in the `categories` array determines the display order** when features are grouped by type.

The `providers` and `collectors` arrays define which entity types participate in the feature inheritance system. These arrays reference entity type names defined in the `entities` configuration.

### Entity Type Definitions

Each entity type in `entities` has two parts: frontmatter field definitions and default features:

```typescript
entities: {
  character: {
    frontmatter: [
      { name: "proficiency_bonus", type: "number", default: 2 },
      { name: "level", type: "number", default: 1 }
    ],
    features: [
      { name: "Dash", type: "action", description: "Double your speed..." },
      { name: "Opportunity Attack", type: "reaction", description: "..." }
    ]
  },
  class: {
    frontmatter: [
      { name: "hit_die", type: "string", default: "d8" }
    ]
  },
  race: {
    frontmatter: [
      { name: "size", type: "string", default: "medium" },
      { name: "speed", type: "number", default: 30 }
    ]
  }
}
```

**Frontmatter fields** define the data structure for notes of that entity type.

**Default features** (optional) define features available to all entities of that type. For example, in D&D 5e, all characters can Dash, Dodge, and make Opportunity Attacks. These default features are automatically available without needing to be defined in individual character notes.

Entity roles (provider vs collector) are defined in the `features.providers` and `features.collectors` arrays, not in the entity definitions themselves.

## Phase 2 vs Phase 3

**Phase 2 (Current):**
- System defined in code (`lib/systems/dnd5e.ts`)
- D&D 5e is the only built-in system
- All files use D&D 5e system

**Phase 3 (Future):**
- Systems defined in markdown files using `rpg system` blocks
- Multiple systems can coexist
- Folder-based system assignment
- Custom systems without code changes

## Benefits

1. **Separation of Concerns**: Features are defined where they logically belong (class notes, race notes)
2. **Reusability**: Multiple characters can reference the same class/race notes
3. **Maintainability**: Update a class feature once, all characters of that class see the change
4. **Extensibility**: Easy to add new provider types (backgrounds, feats, magic items)
5. **Flexibility**: Works with any RPG system, not just D&D 5e
