# D&D 5e Spellcasting Configuration

This file contains the spellcasting system configuration for D&D 5e.

**Note:** This uses the new `rpg system.spellcasting` dot notation format. For a complete working example, see `systems/inline-system/DnD5e-System.md`.

```rpg system.spellcasting
circles:
  - id: cantrip
    label: Cantrip
    icon: ✨
  - id: "1"
    label: 1st Level
    icon: "1️⃣"
  - id: "2"
    label: 2nd Level
    icon: "2️⃣"
  - id: "3"
    label: 3rd Level
    icon: "3️⃣"
  - id: "4"
    label: 4th Level
    icon: "4️⃣"
  - id: "5"
    label: 5th Level
    icon: "5️⃣"
  - id: "6"
    label: 6th Level
    icon: "6️⃣"
  - id: "7"
    label: 7th Level
    icon: "7️⃣"
  - id: "8"
    label: 8th Level
    icon: "8️⃣"
  - id: "9"
    label: 9th Level
    icon: "9️⃣"

lists:
  - id: wizard
    label: Wizard Spells
    icon: 🧙
  - id: cleric
    label: Cleric Spells
    icon: ⛪
  - id: druid
    label: Druid Spells
    icon: 🌿
  - id: bard
    label: Bard Spells
    icon: 🎵
  - id: paladin
    label: Paladin Spells
    icon: ⚔️
  - id: ranger
    label: Ranger Spells
    icon: 🏹
  - id: sorcerer
    label: Sorcerer Spells
    icon: 🔥
  - id: warlock
    label: Warlock Spells
    icon: 👁️

providers:
  - class
  - subclass
  - race

collectors:
  - character
```

## Usage

Reference this file in your system definition:

```yaml
rpg system
name: "My D&D System"
spellcasting: "DnD5e-Spellcasting-Example.md"
```
