# 🎲 RPG UI Toolkit Test Vault - Quick Start

Welcome! This is a **ready-to-use test vault** for the Obsidian RPG UI Toolkit plugin.

## 🚀 Getting Started (3 steps)

1. **Open this folder as an Obsidian vault**
   - Launch Obsidian
   - Click "Open folder as vault"
   - Select this `vault` folder

2. **Enable the RPG UI Toolkit plugin**
   - Go to Settings → Community Plugins
   - Find and enable "D&D UI Toolkit" or "RPG UI Toolkit"

3. **Open any test file and switch to Reading View**
   - Try `sessions/Test-01-Basic-Combat.md` first
   - Press `Ctrl/Cmd + E` to toggle Reading View

## 📋 What's Inside

### 🔧 System Tests (2 formats)

- **systems/inline-system/DnD5e-System.md** - Everything in one file
- **systems/split-system/System/DnD5e-System.md** - Split across multiple files

👉 **Try both to see the difference!**

### 📚 Example Files (Component Documentation)

- **DnD5e-Attributes-Example.md** - System attributes block configuration
- **DnD5e-Features-Example.md** - Features block setup and configuration
- **DnD5e-Spellcasting-Example.md** - Spellcasting system configuration

👉 **Reference guides - copy & adapt for your own systems!**

### 🎮 Session Log Tests (3 scenarios)

- **sessions/Test-01-Basic-Combat.md** - Combat, rolls, HP tracking
- **sessions/Test-02-Scene-Variants.md** - Flashbacks, progress trackers, threads
- **sessions/Test-03-Dialogue-Tables.md** - Dialogue, random tables, GM notes

👉 **Visual tests - see the rendered output!**

## ✅ Quick Visual Check

Open `sessions/Test-01-Basic-Combat.md` in Reading View.

**You should see:**
- ✨ Styled scene header (S1)
- 🎯 Action cards with @ symbol
- 🎲 Dice roll cards with results
- 💬 Consequence cards with outcomes
- 🏷️ Colored tags for NPCs and PCs
- 📊 HP changes tracked
- 📈 Summary at the end

**If you see plain markdown instead**, you're in Edit Mode. Press `Ctrl/Cmd + E`.

## 📖 Detailed Testing Guide

See **README.md** for:
- Comprehensive test scenarios
- Expected results for each test
- Troubleshooting guide
- Success criteria checklist
- Console verification steps

## 🎯 Key Features to Test

### System Definitions
- ✅ Inline format (all in one file)
- ✅ Split format (external file references)
- ✅ New `rpg system.skills` dot notation
- ✅ Direct arrays (no wrapper fields)
- ✅ Multiple expression files

### Session Logs
- ✅ Scene markers (S1, S1a, T1-S2, S2.1)
- ✅ Actions, rolls, consequences
- ✅ NPC and PC tags
- ✅ HP and status tracking
- ✅ Progress trackers (clocks, tracks, timers, threads)
- ✅ Dialogue formatting
- ✅ Random tables and generators
- ✅ Meta notes (GM info)
- ✅ Change overview summary

## 🐛 Troubleshooting

**Nothing renders?**
- Check you're in Reading View (`Ctrl/Cmd + E`)
- Verify plugin is enabled in Settings
- Check browser console (F12) for errors

**Entity files not found?**
- Paths are relative to vault root
- Character files: `sessions/Characters/`
- NPC files: `sessions/NPCs/`

**System not loading?**
- Open the system file first
- Check console for loading messages
- Verify file paths in split format

## 💡 Tips

- **Reading View is required** - Edit Mode shows source markdown
- **Check the browser console (F12)** - See debug messages
- **Try modifying** - Edit session logs to see live updates
- **Experiment** - Add your own scenes, characters, rolls!

## 📝 File Structure

```
vault/
├── START-HERE.md (you are here!)
├── README.md (detailed guide)
├── DnD5e-Attributes-Example.md (📚 example)
├── DnD5e-Features-Example.md (📚 example)
├── DnD5e-Spellcasting-Example.md (📚 example)
├── system-example.md
├── systems/
│   ├── inline-system/
│   │   └── DnD5e-System.md
│   └── split-system/
│       ├── System/
│       ├── Attributes/
│       ├── Skills/
│       └── Expressions/
├── sessions/
│   ├── Characters/
│   ├── NPCs/
│   └── Test-*.md files
└── tests/
   └── 00-TEST-OVERVIEW.md
```

## 🎉 Have Fun!

This vault demonstrates all major features of the plugin. Use it as:
- A visual reference
- A starting template
- A learning tool
- A quick test environment

Happy gaming! 🎲✨
