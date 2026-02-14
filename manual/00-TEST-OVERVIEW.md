# Manual Testing Overview

This directory contains step-by-step manual test cases to verify that the unified `rpg` namespace is working correctly in Obsidian.

## ⚠️ IMPORTANT: Build Verification First!

**Before running any tests, verify the plugin is built correctly:**

👉 **Start with `00-BUILD-VERIFICATION.md`** 👈

This ensures:
- Plugin is built with latest changes
- `rpg` processor is registered
- Debug logging is active
- No console messages = plugin not loaded correctly

## Purpose

Phase 1 migrates all code block types to a unified `rpg` namespace. Both old and new formats should work:

- **Old format**: `` ```consumable ``
- **New format**: `` ```rpg consumable ``

Phase 2 adds system abstraction and new blocks for inventory and features.

## Test Files

0. **00-BUILD-VERIFICATION.md** - ⚠️ **START HERE** - Verify plugin build and loading
1. **01-TEST-CONSUMABLE.md** - Test consumable blocks
2. **02-TEST-ATTRIBUTES.md** - Test ability/attributes blocks  
3. **03-TEST-SKILLS.md** - Test skills blocks
4. **04-TEST-HEALTHPOINTS.md** - Test health tracking
5. **05-TEST-STATS.md** - Test stats display
6. **06-TEST-BADGES.md** - Test badges
7. **07-TEST-INITIATIVE.md** - Test initiative tracker
8. **08-TEST-SPELL.md** - Test spell components
9. **09-TEST-EVENTS.md** - Test event buttons
10. **10-TEST-ALL-BLOCKS.md** - Complete character sheet test
11. **11-TEST-INVENTORY.md** - ✨ **NEW** - Test inventory block (Phase 2)
12. **12-TEST-FEATURES.md** - ✨ **NEW** - Test features block (Phase 2)

## How to Test

1. Install the plugin in your Obsidian vault using BRAT
2. Open each test file in Obsidian
3. Switch to **Reading View** (Preview Mode)
4. Compare the rendered output
5. Check browser console (Ctrl+Shift+I / Cmd+Option+I) for debug messages

## Expected Results

✅ **Both formats should render identically**
- Old format (`` ```consumable ``) should render UI
- New format (`` ```rpg consumable ``) should render UI
- Both should show the same interactive components

## Debug Messages

When viewing in Reading Mode, check console for:
- `DnD UI Toolkit: Fence line: "```rpg consumable"`
- `DnD UI Toolkit: Extracted meta: "consumable"`
- `DnD UI Toolkit: Processing rpg block with meta: consumable`

## What to Report

If a block doesn't render:
1. Which test file?
2. Old or new format (or both)?
3. Any error messages in console?
4. Screenshot of the issue
5. Full console log output

## Block Type Reference

| Old Format | New Format | Component |
|------------|------------|-----------|
| `ability` | `rpg attributes` | Ability Scores |
| `skills` | `rpg skills` | Skills |
| `healthpoints` | `rpg healthpoints` | HP Tracker |
| `stats` | `rpg stats` | Stat Display |
| `badges` | `rpg badges` | Badges |
| `consumable` | `rpg consumable` | Consumables |
| `initiative` | `rpg initiative` | Initiative |
| `spell-components` | `rpg spell` | Spell Info |
| `event-btns` | `rpg events` | Event Buttons |
| _(none)_ | `rpg inventory` | ✨ **NEW** - Inventory (Phase 2) |
| _(none)_ | `rpg features` | ✨ **NEW** - Features (Phase 2) |
