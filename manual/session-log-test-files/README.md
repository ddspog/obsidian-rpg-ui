# Session Log Testing - Example Entity Files

This directory contains example character and NPC files to use when testing the Session Log feature.

## Setup Instructions

1. Copy these files to your Obsidian vault
2. Maintain the folder structure:
   - `Characters/` - for PC files
   - `NPCs/` - for NPC/monster files
3. Reference these files in your session log `entities:` section

## File Contents

### Characters/Elara.md
5th-level Rogue with stealth focus. Use for testing PC tag parsing and HP tracking.

### Characters/Thorne.md
5th-level Cleric. Use for testing healing effects and multi-entity scenarios.

### NPCs/Goblin.md
Basic monster. Use for testing NPC tags, death states, and status tracking.

## Usage in Session Logs

Reference these entities in your `rpg log` block:

```yaml
entities:
  - file: "Characters/Elara.md"
    type: character
  - file: "Characters/Thorne.md"
    type: character
  - file: "NPCs/Goblin.md"
    type: monster
    count: 3
```

The Session Log will:
- Resolve entity data from these files
- Display entity stats in the HUD
- Track state changes throughout the session
- Show delta summary at the end
