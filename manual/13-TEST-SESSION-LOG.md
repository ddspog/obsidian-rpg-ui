# Test 13: Session Log (Lonelog)

## Test Objective
Verify that the session log block renders correctly with Lonelog notation parsing, entity resolution, delta tracking, and interactive HUD.

## Prerequisites
- Plugin installed in Obsidian
- **Recommended:** Use the ready-to-use test vault at `manual/vault/` for complete visual testing
- **Alternative:** This file can be opened in Obsidian (switch to **Reading View**)

## Easy Testing Option 🎯

**For the best testing experience, use the complete test vault:**

1. Copy the entire `manual/vault/` folder to a location of your choice
2. Open it as an Obsidian vault
3. Open the session test files in Reading View:
   - `Session-Tests/Test-01-Basic-Combat.md`
   - `Session-Tests/Test-02-Scene-Variants.md`
   - `Session-Tests/Test-03-Dialogue-Tables.md`

The vault includes all necessary entity files (characters, NPCs) and is ready to use immediately.

See `manual/vault/START-HERE.md` for quick start instructions.

## Manual Testing (Alternative)

If you prefer to test in your own vault, you'll need character entity files for entity resolution.
Use the files from `manual/vault/Session-Tests/Characters/` and `manual/vault/Session-Tests/NPCs/` as templates.

## Test Steps

### Step 1: Basic Scene and Actions
Look at "Test 1: Basic Scene" section below in Reading View.

**Expected Result:**
- ✅ Scene header with "S1" number and "Dark forest clearing" context
- ✅ Action card with "@" symbol and "Elara sneaks forward"
- ✅ Oracle question with "?" symbol in italics
- ✅ Oracle answer with "→" symbol
- ✅ Consequence card indented

**Console Check:**
```
DnD UI Toolkit: Fence line: "```rpg log"
DnD UI Toolkit: Extracted meta: "log"
```

### Step 2: Dice Rolls and Success/Failure
Look at "Test 2: Dice Rolls" section below.

**Expected Result:**
- ✅ Roll cards with "🎲" symbol
- ✅ Green border for successful rolls
- ✅ Red border for failed rolls
- ✅ Roll expression and result clearly separated

### Step 3: NPC and PC Tags
Look at "Test 3: Entity Tags" section below.

**Expected Result:**
- ✅ NPC tags with green background `[N:Goblin|wounded]`
- ✅ PC tags with accent background `[PC:Elara|HP-5]`
- ✅ Location tags with blue background `[L:Forest Camp]`
- ✅ Reference tags with "#" prefix `[#N:Goblin]`

### Step 4: Progress Trackers
Look at "Test 4: Progress Trackers" section below.

**Expected Result:**
- ✅ Clock tags show progress bar: `[Clock:Reinforcements 2/6]`
- ✅ Track tags show progress: `[Track:Escape 3/8]`
- ✅ Timer tags show countdown: `[Timer:Dawn 3]`
- ✅ Thread tags show state: `[Thread:Find Sister|Open]`
- ✅ Progress bars fill proportionally

### Step 5: Scene Variants
Look at "Test 5: Scene Variants" section below.

**Expected Result:**
- ✅ Flashback scene (S1a) is dimmed/italic
- ✅ Parallel thread (T1-S1) has thicker border
- ✅ Montage (S1.1) is compact
- ✅ Each variant has distinct visual style

### Step 6: Dialogue
Look at "Test 6: Dialogue" section below.

**Expected Result:**
- ✅ NPC dialogue formatted: `Guard: "Halt!"`
- ✅ PC dialogue formatted: `PC: "I mean no harm"`
- ✅ Italic styling for dialogue
- ✅ Speaker name is bold

### Step 7: Entity Resolution and HUD
Look at "Test 7: Complete Session with Entities" section below.

**Expected Result:**
- ✅ HUD appears at top with entity selector
- ✅ Entity dropdown shows "Elara", "Thorne", "Goblin"
- ✅ Entity summary shows stats from linked files
- ✅ Quick action buttons present: Action, Oracle, Roll, Consequence, Note
- ✅ Clicking buttons logs to console (append functionality placeholder)

### Step 8: Change Overview
Look at the bottom of "Test 7" section.

**Expected Result:**
- ✅ "Session Overview" section appears at end
- ✅ Shows entity HP changes: "PC: Elara HP -8", "PC: Thorne HP +0"
- ✅ Shows NPC status: "NPC: Goblin dead"
- ✅ Shows progress trackers: "Clock: Reinforcements 1/4"
- ✅ Color coding: green for gains, red for losses

### Step 9: Complex Combat Sequence
Look at "Test 8: Complex Combat" section below.

**Expected Result:**
- ✅ All event types render in sequence
- ✅ Multiple tags in one line parse correctly
- ✅ State changes accumulate properly
- ✅ Final overview shows total changes

### Step 10: Table Rolls and Generators
Look at "Test 9: Tables and Generators" section below.

**Expected Result:**
- ✅ Table roll card: `tbl: WeatherTable d6=4 Heavy Rain`
- ✅ Generator card: `gen: NameGenerator Thorin Ironshield`
- ✅ Distinct icons and styling

---

## Test 1: Basic Scene

```rpg log
state_key: test-basic-scene
scene: "Introduction"
---
S1 *Dark forest clearing*
@ Elara sneaks forward
? Is the path clear?
-> Yes, but...
=> She spots movement ahead
```

## Test 2: Dice Rolls

```rpg log
state_key: test-dice-rolls
---
@ Elara makes a stealth check
d: Stealth d20+5=18 vs DC 14 -> Success
=> She remains hidden

@ Thorne tries to pick a lock
d: Thieves' Tools d20+0=8 vs DC 15 -> Fail
=> The lock doesn't budge
```

## Test 3: Entity Tags

```rpg log
state_key: test-entity-tags
---
@ Elara spots enemies
=> She sees three goblins. [N:Goblin #1|alert] [N:Goblin #2|sleeping] [N:Goblin #3|wounded]
=> They're camped at [L:Old Ruins|abandoned|dangerous]

@ Elara takes damage
=> [PC:Elara|HP-5|+wounded]

@ Reference to earlier NPC
=> [#N:Goblin #1] notices the party
```

## Test 4: Progress Trackers

```rpg log
state_key: test-progress-trackers
---
@ The alarm is raised
=> [Clock:Reinforcements 2/6]

@ Party tries to escape
=> [Track:Escape 3/8]

@ Time is running out
=> [Timer:Dawn 3]

@ Investigation continues
=> [Thread:Find the Artifact|Open]

@ Quest completed
=> [Thread:Rescue Mission|Closed]
```

## Test 5: Scene Variants

```rpg log
state_key: test-scene-variants
---
S1 *Present time - The ambush*
@ Elara draws her blade

S1a *Flashback - Earlier that morning*
@ Elara receives the mission

T1-S1 *Meanwhile - At the castle*
@ The king plots

S1.1 *Training montage begins*
@ Elara practices her swordplay
```

## Test 6: Dialogue

```rpg log
state_key: test-dialogue
---
@ A guard approaches
N (Guard): "Halt! Who goes there?"
PC: "I mean no harm, friend."
N (Guard): "That's what they all say."
=> Tension rises
```

## Test 7: Complete Session with Entities

```rpg log
state_key: test-complete-session
scene: "The Goblin Ambush"
entities:
  - file: "Characters/Elara.md"
    type: character
  - file: "Characters/Thorne.md"
    type: character
  - file: "NPCs/Goblin.md"
    type: monster
    count: 3
---
S1 *Dark forest clearing, dusk*
@ Elara sneaks toward the goblin camp
d: Stealth d20+7=18 vs DC 14 -> Success
=> She slips between the trees unnoticed. [N:Goblin Lookout|distracted]

? Does the lookout have allies nearby?
-> Yes, but... (d6=4)
=> Two more goblins, but they're arguing. [N:Goblin#2|armed] [N:Goblin#3|armed]

@ Thorne charges in
d: Athletics d20+3=12 vs DC 10 -> Success
=> He crashes through the underbrush, drawing their attention

@ Elara attacks Goblin Lookout
d: d20+7=19 vs AC 15 -> Hit
d: 1d8+4=9 slashing damage
=> [N:Goblin Lookout|HP-9|dead]

? Do the other goblins flee?
-> No, and... (d6=2)
=> They rage and call for the boss. [N:Goblin Boss|hostile|emerging]
[Clock:Reinforcements 1/4]

@ Goblin#2 attacks Elara
d: d20+4=15 vs AC 15 -> Hit
d: 1d6+2=5 slashing damage
=> [PC:Elara|HP-5]

@ Thorne casts Healing Word on Elara
=> [PC:Elara|HP+7]

@ Elara finishes the fight
d: d20+7=20 vs AC 15 -> Hit
d: 1d8+4=10 slashing damage
=> [N:Goblin#2|HP-10|dead]
=> The last goblin flees

(note: This was a close encounter)
```

## Test 8: Complex Combat

```rpg log
state_key: test-complex-combat
---
S1 *Boss Fight*
@ Elara uses Action Surge
=> Multiple attacks incoming

@ First attack
d: d20+7=18 vs AC 16 -> Hit
d: 1d8+4=8 damage
=> [N:Boss|HP-8]

@ Second attack
d: d20+7=15 vs AC 16 -> Miss
=> The boss dodges

@ Boss counter-attacks
d: d20+8=22 vs AC 15 -> Critical Hit!
d: 2d10+4=18 damage
=> [PC:Elara|HP-18|+wounded|+bleeding]

@ Thorne heals and removes conditions
=> [PC:Elara|HP+12|-wounded|-bleeding]

@ Final blow
d: d20+7=19 vs AC 16 -> Hit
d: 1d8+4=12 damage
=> [N:Boss|HP-12|dead]
=> Victory! [Thread:Defeat the Boss|Closed]
```

## Test 9: Tables and Generators

```rpg log
state_key: test-tables-generators
---
@ Check the weather
tbl: WeatherTable d6=4 Heavy Rain
=> The rain makes travel difficult

@ Generate random NPC
gen: NameGenerator Thorin Ironshield
=> A dwarf merchant approaches

@ Generate treasure
gen: TreasureTables 450 gold, +1 Longsword
=> The party finds valuable loot
```

## Test 10: Meta Notes

```rpg log
state_key: test-meta-notes
---
@ Combat begins
(note: Using simplified combat rules)

@ Roll initiative
d: d20+4=15
(note: Remember to add DEX modifier)

=> Combat resolved
(note: Party gained 200 XP each)
```

---

## Troubleshooting

### HUD Not Appearing
- Check that entity files exist in your vault
- Verify file paths match exactly
- Check console for entity resolution errors

### Tags Not Rendering
- Ensure proper tag syntax: `[N:Name|tags]`
- Check for matching brackets
- Verify tag kind is recognized (N, L, PC, Clock, Track, Timer, Thread, E)

### Progress Bars Not Showing
- Ensure format is `[Clock:Name X/Y]` not `[Clock:Name|X/Y]`
- Numbers must be valid integers

### Scene Headers Not Styling
- Check scene number format: `S1`, `S1a`, `T1-S1`, `S1.1`
- Scene marker must be at start of line

### Entity Resolution Fails
- Files must exist in vault
- Paths are case-sensitive
- Wiki-link syntax `[[Filename]]` is supported
- Files need `.md` extension in path

### Delta Summary Not Accurate
- Check tag syntax in consequence lines
- HP changes must be `HP+X` or `HP-X`
- Status changes must be recognized keywords or use `→` for transitions

## Expected Console Output

When viewing any log block in Reading View:
```
DnD UI Toolkit: Fence line: "```rpg log"
DnD UI Toolkit: Extracted meta: "log"
DnD UI Toolkit: Processing rpg block with meta: log
```

## What to Report

If rendering fails:
1. Which test section?
2. What's missing or incorrect?
3. Console error messages?
4. Screenshot of the issue
5. Entity file paths used (if applicable)

## Success Criteria

✅ All 10 tests render correctly
✅ HUD appears with entity selector
✅ All tag types render with proper styling
✅ Progress bars display and fill correctly
✅ Scene variants have distinct visual styles
✅ Change overview shows accurate deltas
✅ No console errors
✅ Quick action buttons are clickable (log to console)
