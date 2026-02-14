# Features Block

The `rpg features` block allows you to track class features, racial traits, feats, and other character abilities with level gating and prerequisite tracking.

## Feature Provider/Collector Architecture

The system uses a **provider/collector** pattern for features:

### Feature Collectors
Entity types that **receive** features from other files (e.g., `character`, `monster`). These notes display all features they collect from their class, race, and other sources.

### Feature Providers
Entity types that **define** features to pass to collectors (e.g., `class`, `race`). These notes declare what features are available at different levels.

**Example flow:**
1. A "Fighter" class note (provider) defines "Second Wind" at level 1
2. A "Human" race note (provider) defines "Extra Language" 
3. A character note (collector) with `class: Fighter` and `race: Human` automatically collects and displays both features

The system's `featureProviders` and `featureCollectors` arrays define which entity types can provide or collect features.

## Basic Example

~~~markdown
```rpg features
state_key: wizard-features
class: "Wizard"
categories:
  - name: "Class Features"
    icon: "⚔️"
    features:
      - name: "Arcane Recovery"
        level: 1
        description: "Recover spell slots on short rest. Slots = {{ceil (divide level 2)}}."
        reset_on: short-rest
        uses: 1
        state_key: arcane-recovery
      - name: "Spell Mastery"
        level: 18
        description: "Choose a 1st and 2nd level spell to cast at will."

  - name: "Subclass: School of Evocation"
    icon: "🔥"
    requires:
      level: 2
    features:
      - name: "Sculpt Spells"
        level: 2
        description: "Protect allies from your evocation spells."
      - name: "Potent Cantrip"
        level: 6
        description: "Cantrips deal half damage on successful save."

  - name: "Feats"
    icon: "🏅"
    features:
      - name: "War Caster"
        description: "Advantage on CON saves for concentration."
        requires:
          attribute: { constitution: 13 }
        optional: true
```
~~~

## YAML Structure

### Top-level fields

- `state_key` (optional): Unique identifier for persisting UI state
- `class` (optional): Character class name for display
- `categories`: Array of feature categories

### Categories

Each category groups related features:

- `name`: Category heading
- `icon` (optional): Emoji or icon to display in header
- `requires` (optional): Category-level requirements (see Requirements section)
- `features` (optional): Array of feature objects
- `choices` (optional): Array of choice objects

### Features

Each feature has:
- `name`: Feature name (required)
- `level` (optional): Character level when feature becomes available
- `type` (optional): Feature type identifier ("action", "bonus_action", "reaction", "passive", "active")
- `description` (optional): Feature description (supports templates)
- `reset_on` (optional): When limited uses reset ("short-rest", "long-rest", etc.)
- `uses` (optional): Number of uses per reset period
- `state_key` (optional): Unique identifier for tracking uses
- `requires` (optional): Feature requirements (see Requirements section)
- `optional` (optional): Boolean indicating if feature is optional

### Feature Types

The `type` field categorizes features by their action cost. Feature types are defined in the system configuration and their **order in the system definition determines the display order** when features are presented.

In D&D 5e, the feature types are (in display order):

| Type | Label | Icon | Usage |
|------|-------|------|-------|
| `action` | Action | ⚔️ | Requires a full action |
| `bonus_action` | Bonus Action | ⚡ | Requires a bonus action |
| `reaction` | Reaction | 🛡️ | Triggered reaction |
| `passive` | Passive | 👁️ | Always active |
| `active` | Active | ✨ | Active ability (not action-based) |

Features are grouped and sorted by their type when displayed, following the order defined in the system's `featureTypes` array.

Example:
```yaml
features:
  - name: "Second Wind"
    type: bonus_action
    description: "Regain 1d10 + fighter level HP."
```

### Requirements

Requirements can be specified at category or feature level:

```yaml
requires:
  level: 6                          # Minimum character level
  feature: "Potent Cantrip"        # Prerequisite feature name
  attribute:                        # Minimum attribute scores
    constitution: 13
    intelligence: 15
```

Features/categories with unmet requirements are displayed dimmed with a tooltip showing what's needed.

### Choices

Choice groups let characters pick from a list:

```yaml
choices:
  - name: "Cantrips Known"
    pick: 3                         # Number to pick
    options:                        # List of options
      - "Fire Bolt"
      - "Mage Hand"
      - "Prestidigitation"
      - "Minor Illusion"
```

## Display Features

- **Class Header**: Shows character class at the top
- **Categorized Features**: Features grouped by category with icons
- **Level Badges**: Shows required level for each feature
- **Requirement Indicators**: Unmet requirements shown with dimmed styling and tooltip
- **Limited Uses**: Displays use counts for features with `uses` field
- **Template Support**: Feature descriptions can use template syntax

## Requirement Checking

The features block automatically checks requirements against:
- **Character level**: From frontmatter `level` field
- **Attribute scores**: From `rpg attributes` block in the same document
- **Other features**: Prerequisite features must have their own requirements met

Requirements are evaluated dynamically, so features automatically become available as your character levels up or gains stats.

## Phase 2 Limitations

In Phase 2, the features block is **read-only**. Future phases will add:
- Limited use tracking with use/restore buttons
- Choice selection with persistence
- Integration with event system for automatic resets
- Write-back to code block YAML for choices
