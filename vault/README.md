# Obsidian RPG UI Toolkit - Test Vault

This folder is a **ready-to-use Obsidian vault** for testing the RPG UI Toolkit plugin.

## Quick Start

1. **Copy this entire `vault` folder** to a location of your choice
2. **Open it as an Obsidian vault**:
   - In Obsidian: `Open folder as vault`
   - Select the `vault` folder
3. **Enable the RPG UI Toolkit plugin** in Settings → Community Plugins
4. **Open test files** and switch to Reading View to see rendered components

## Folder Structure

```
vault/
├── System-Inline/          # Test system with all components in one file
│   └── DnD5e-System.md     # Complete inline system definition
│
├── System-Split/           # Test system with components in separate files
│   ├── System/
│   │   └── DnD5e-System.md              # Main system (references other files)
│   ├── Skills/
│   │   └── DnD5e-Skills.md              # External skills file (rpg system.skills)
│   ├── Attributes/
│   │   └── DnD5e-Attributes.md          # Detailed attribute cards (rpg system.attributes)
│   └── Expressions/
│       ├── DnD5e-Core-Expressions.md    # Core math expressions
│       └── DnD5e-Combat-Expressions.md  # Combat expressions
│
└── Session-Tests/          # Session Log feature tests
    ├── Characters/
    │   ├── Elara.md        # Test character (Rogue)
    │   └── Thorne.md       # Test character (Cleric)
    ├── NPCs/
    │   └── Goblin.md       # Test monster
    ├── Test-01-Basic-Combat.md      # Combat with actions, rolls, HP tracking
    ├── Test-02-Scene-Variants.md    # Scene types & progress trackers
    └── Test-03-Dialogue-Tables.md   # Dialogue, tables, generators, meta notes
```

## Test Scenarios

### System Definition Tests

#### Test 1: Inline System Format
**File:** `System-Inline/DnD5e-System.md`

**What to test:**
- ✅ System loads from single file
- ✅ Skills defined inline with `rpg skill-list`
- ✅ Expressions defined inline with `rpg expression`
- ✅ All 18 D&D 5e skills present
- ✅ 5 core expressions working

**How to verify:**
1. Open the file
2. Check console for "Loaded system: D&D 5e"
3. No visible UI (definition blocks don't render)
4. System available for use in character files

#### Test 2: Split System Format
**File:** `System-Split/System/DnD5e-System.md`

**What to test:**
- ✅ System references external skill file (single file)
- ✅ System references multiple expression files (array)
- ✅ Skills loaded from `System-Split/Skills/DnD5e-Skills.md`
- ✅ Expressions loaded from both expression files
- ✅ New dot notation format (`rpg system.skills`, `rpg system.expressions`)
- ✅ No wrapper fields (direct arrays in YAML)

**How to verify:**
1. Open `System-Split/System/DnD5e-System.md`
2. Check console for file loading messages
3. Check that all skills from external file are loaded
4. Check that expressions from both files are merged
5. Verify system works in character files

**Related files to inspect:**
- `System-Split/Skills/DnD5e-Skills.md` - Uses `rpg system.skills` with direct array
- `System-Split/Expressions/DnD5e-Core-Expressions.md` - Core expressions
- `System-Split/Expressions/DnD5e-Combat-Expressions.md` - Combat expressions

### Session Log Tests

#### Test 1: Basic Combat
**File:** `Session-Tests/Test-01-Basic-Combat.md`

**Features tested:**
- ✅ Scene headers (S1)
- ✅ Action events (@)
- ✅ Dice rolls (d:) with success/failure
- ✅ Consequences (=>)
- ✅ NPC tags with HP tracking
- ✅ PC tags with HP tracking
- ✅ Status tracking (dead, alert, victorious)
- ✅ Change overview delta summary

**Expected results:**
- Rendered scene with styled cards for each event type
- Tags show HP deltas (HP-9, HP-5)
- Death status visible on dead NPCs
- Final summary shows all HP changes

#### Test 2: Scene Variants & Progress Trackers
**File:** `Session-Tests/Test-02-Scene-Variants.md`

**Features tested:**
- ✅ Normal scenes (S1, S2, S3)
- ✅ Flashback scenes (S1a) - different visual style
- ✅ Parallel scenes (T1-S2) - different visual style
- ✅ Montage scenes (S2.1) - different visual style
- ✅ Track progress (Track:Name X/Y)
- ✅ Clock progress (Clock:Name X/Y)
- ✅ Thread tracking (Thread:Name|status)
- ✅ Timer tracking (Timer:Name X/Y)
- ✅ Equipment tags (E:)
- ✅ Oracle queries (?)

**Expected results:**
- Different visual styling for S1a, T1-S2, S2.1
- Progress bars for tracks and clocks
- Thread markers with status
- Equipment acquisition tags
- Oracle query formatting

#### Test 3: Dialogue, Tables & Meta Notes
**File:** `Session-Tests/Test-03-Dialogue-Tables.md`

**Features tested:**
- ✅ NPC dialogue (N (Name): "text")
- ✅ PC dialogue (PC (Name): "text")
- ✅ Table rolls (tbl:)
- ✅ Generator rolls (gen:)
- ✅ Meta notes ((note: text))
- ✅ Mixed content flow

**Expected results:**
- Dialogue has distinct styling for PC vs NPC
- Speaker names clearly identified
- Table/generator rolls formatted differently from combat rolls
- Meta notes visually distinct (GM info)

## Visual Inspection Checklist

For each test file, verify:

### Scene Headers
- [ ] Scene markers (S1, S2, etc.) are prominent
- [ ] Scene context text is visible
- [ ] Flashback (S1a) has different styling
- [ ] Parallel (T1-S2) has different styling
- [ ] Montage (S2.1) has different styling

### Event Cards
- [ ] Actions (@) have action card styling
- [ ] Rolls (d:) have dice card styling
- [ ] Consequences (=>) have outcome card styling
- [ ] Oracle queries (?) have query card styling
- [ ] Dialogue has speech bubble/quote styling
- [ ] Tables/generators have distinct styling

### Tags & Trackers
- [ ] NPC tags (N:) have NPC styling
- [ ] PC tags (PC:) have PC styling
- [ ] Location tags (L:) visible
- [ ] Equipment tags (E:) visible
- [ ] HP deltas show (+/- numbers)
- [ ] Status text visible (dead, alert, etc.)
- [ ] Progress bars render (Clock, Track, Timer)
- [ ] Thread status visible

### Change Overview
- [ ] Summary section at end of log
- [ ] All entity changes listed
- [ ] HP changes show before → after
- [ ] Status changes noted
- [ ] Tracker progress shown

### Console
- [ ] No errors
- [ ] Debug messages for entity resolution
- [ ] System loading messages
- [ ] File loading confirmations

## Troubleshooting

### System not loading
**Problem:** Console shows "No rpg system block found"
**Solution:** 
- Check file paths in system definition
- Ensure referenced files exist
- Verify YAML syntax (indentation matters)

### Skills/Expressions not loading
**Problem:** Skills or expressions missing
**Solution:**
- Check file paths are relative to vault root
- Open referenced files to ensure blocks exist
- Check console for file loading errors
- Verify new format: `rpg system.skills` not `rpg system-skills`

### Session log not rendering
**Problem:** Session log shows as plain text
**Solution:**
- Ensure you're in Reading View (not Edit Mode)
- Check that plugin is enabled
- Verify entity files exist at specified paths
- Check console for errors

### Tags not styling correctly
**Problem:** Tags appear as plain text
**Solution:**
- Check tag syntax: [N:Name|HP-5|dead]
- Ensure no spaces inside brackets
- Verify tag type prefix (N:, PC:, L:, E:)

### Entity resolution failing
**Problem:** Console shows "Failed to load entity"
**Solution:**
- Check entity file paths in log header
- Ensure paths are correct relative to vault
- Verify entity files have required frontmatter
- Check entity type matches file content

### Test 15: Detailed Attribute Cards (NEW)

**File:** `System-Split/Attributes/DnD5e-Attributes.md`

**Features tested:**
- ✅ D&D-style attribute card display
- ✅ Attribute name with alias (e.g., "STRENGTH (STR)")
- ✅ Subtitle with associated skills
- ✅ Markdown-formatted descriptions
- ✅ Responsive grid layout
- ✅ Professional card styling with hover effects

**Expected results:**
- Each attribute appears as a distinct card
- Header shows attribute name in uppercase with alias
- Subtitle displays associated skills in italic
- Description supports full markdown (lists, bold, etc.)
- Cards have colored headers and hover effects
- Layout adapts to screen size (responsive grid)

**How to test:**
1. Open `System-Split/Attributes/DnD5e-Attributes.md`
2. Switch to Reading View
3. Verify all 6 attributes (STR, DEX, CON, INT, WIS, CHA) render as cards
4. Hover over cards to see hover effect
5. Check that bullet lists and markdown formatting display correctly
6. Resize window to verify responsive layout

## Settings Test

### Test 14: System Mapping (NEW)

**File:** `14-TEST-SYSTEM-MAPPING.md`

**Features tested:**
- ✅ File autocomplete for system selection
- ✅ Folder-to-system mappings
- ✅ Multiple mapping support
- ✅ Default system fallback
- ✅ Mapping add/remove functionality

**How to test:**
1. Open Plugin Settings → DnD UI Toolkit → Systems
2. Click "Add System Mapping"
3. Test autocomplete in system file field
4. Create mappings for test folders
5. Verify files in mapped folders use correct system
6. See `14-TEST-SYSTEM-MAPPING.md` for detailed test steps

## Success Criteria Summary

✅ **System Inline:** All components in one file work  
✅ **System Split:** External file references work  
✅ **Multiple Files:** Array of expression files merge correctly  
✅ **New Format:** Dot notation (`rpg system.X`) works  
✅ **No Wrappers:** Direct arrays parse correctly  
✅ **Session Logs:** All Lonelog notation renders  
✅ **Scene Variants:** Different scene types styled distinctly  
✅ **Progress Trackers:** Clocks, tracks, timers, threads work  
✅ **Dialogue:** PC and NPC speech formatted correctly  
✅ **Tables/Generators:** Special formatting for procedural content  
✅ **Meta Notes:** GM notes visually distinct  
✅ **HUD Buttons:** Quick-action buttons append to log (NEW)  
✅ **System Mapping:** File autocomplete and folder mappings work (NEW)  
✅ **Attribute Cards:** D&D-style detailed attribute display (NEW)  
✅ **Entity Resolution:** Character/NPC data loads from files  
✅ **Delta Tracking:** All state changes captured and displayed  
✅ **No Console Errors:** Clean execution

## Next Steps

After verifying all tests pass:

1. Try creating your own system definition
2. Create custom character sheets
3. Run actual game sessions with session logs
4. Experiment with custom expressions
5. Build your own skill lists
6. Create campaign-specific tags and trackers

Enjoy testing! 🎲
