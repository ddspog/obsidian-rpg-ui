# Features Block

The `rpg features` block allows you to track class features, racial traits, feats, and other character abilities with level gating and prerequisite tracking.

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
- `description` (optional): Feature description (supports templates)
- `reset_on` (optional): When limited uses reset ("short-rest", "long-rest", etc.)
- `uses` (optional): Number of uses per reset period
- `state_key` (optional): Unique identifier for tracking uses
- `requires` (optional): Feature requirements (see Requirements section)
- `optional` (optional): Boolean indicating if feature is optional

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
