# D&D 5e System Attributes Configuration

This file demonstrates how to define and configure system attributes using the `rpg system.attributes` block. This is part of the system definition framework that allows you to specify the core attributes/abilities for your RPG system.

**Note:** This uses the `rpg system.attributes` dot notation format. For a complete working example, see the system definition files in `systems/inline-system/` or `systems/split-system/` directories.

## Basic Usage

```rpg system.attributes
- name: strength
  subtitle: STR
- name: dexterity
  subtitle: DEX
- name: constitution
  subtitle: CON
- name: intelligence
  subtitle: INT
- name: wisdom
  subtitle: WIS
- name: charisma
  subtitle: CHA
```

## Extended Format with Descriptions

```rpg system.attributes
- name: strength
  subtitle: STR
  description: "Physical power and athletic ability"
  alias: str
  
- name: dexterity
  subtitle: DEX
  description: "Agility, reflexes, and balance"
  alias: dex
  
- name: constitution
  subtitle: CON
  description: "Endurance, health, and vitality"
  alias: con
  
- name: intelligence
  subtitle: INT
  description: "Reasoning and memory"
  alias: int
  
- name: wisdom
  subtitle: WIS
  description: "Awareness and insight"
  alias: wis
  
- name: charisma
  subtitle: CHA
  description: "Force of personality and leadership"
  alias: cha
```

## Custom System Example

```rpg system.attributes
- name: might
  subtitle: MIG
  description: "Raw physical power"
  
- name: agility
  subtitle: AGI
  description: "Speed and coordination"
  
- name: mind
  subtitle: MND
  description: "Mental acuity and intellect"
  
- name: spirit
  subtitle: SPI
  description: "Spiritual connection and willpower"
```

## Configuration Reference

### Attribute Properties

| Property      | Type   | Required | Description                                              |
| ------------- | ------ | -------- | -------------------------------------------------------- |
| `name`        | String | Yes      | Unique identifier for the attribute                      |
| `subtitle`    | String | No       | Short label (typically 2-3 characters)                   |
| `description` | String | No       | Detailed explanation of the attribute's purpose          |
| `alias`       | String | No       | Alternative name for the attribute (for templates)       |

## Integration with System Definition

Reference this file in your complete system definition:

```yaml
rpg system
name: "My Custom RPG System"
attributes: "systems/MySystem-Attributes.md"
# ... other system definitions
```

Or include it inline:

```yaml
rpg system
name: "D&D 5th Edition"
attributes:
  - strength
  - dexterity
  - constitution
  - intelligence
  - wisdom
  - charisma
```

## See Also

- [System Architecture Documentation](../docs/concepts/system-architecture.md)
- [Dynamic Content & Templating](../docs/concepts/dynamic-content.md)
- [Complete D&D 5e Examples](./systems/inline-system/) and [Split Format](./systems/split-system/)
