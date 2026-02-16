# Test 1: Consumable Blocks

## Test Objective
Verify that consumable blocks render correctly in both old and new formats.

## Prerequisites
- Plugin installed in Obsidian
- This file open in Obsidian
- Switch to **Reading View** to see rendered output

## Test Steps

### Step 1: View Old Format
Look at the "Old Format" section below in Reading View.

**Expected Result:**
- Should see two consumable trackers
- "Level 1 Spells" with 3 checkboxes
- "Sneak Attack" with 1 checkbox
- Checkboxes should be interactive (clickable)

### Step 2: View New Format
Look at the "New Format" section below in Reading View.

**Expected Result:**
- Should see identical consumable trackers
- "Level 1 Spells" with 3 checkboxes
- "Sneak Attack" with 1 checkbox
- Should look exactly like the old format

### Step 3: Check Console
Open browser console (Ctrl+Shift+I or Cmd+Option+I).

**Expected Console Messages:**
```
DnD UI Toolkit: Fence line: "```rpg consumable"
DnD UI Toolkit: Extracted meta: "consumable"
DnD UI Toolkit: Processing rpg block with meta: consumable
```

### Step 4: Test Interactivity
Click checkboxes in both sections.

**Expected Result:**
- Checkboxes should toggle on/off
- State should persist when switching between Edit and Reading view
- Both formats should work identically

---

## Old Format (Should Work)

```consumable
items:
  - label: "Level 1 Spells"
    state_key: test_old_spells_1
    uses: 3
    reset_on: "long-rest"
  - label: "Sneak Attack"
    state_key: test_old_sneak_attack
    uses: 1
    reset_on: ["short-rest", "long-rest"]
```

---

## New Format (Should Also Work)

```rpg consumable
items:
  - label: "Level 1 Spells"
    state_key: test_new_spells_1
    uses: 3
    reset_on: "long-rest"
  - label: "Sneak Attack"
    state_key: test_new_sneak_attack
    uses: 1
    reset_on: ["short-rest", "long-rest"]
```

---

## What to Check

✅ **Both sections should render UI components**
✅ **Both should look identical**
✅ **Both should be interactive**
✅ **Console should show debug messages for new format**

## If Test Fails

**If old format works but new format doesn't:**
1. Take screenshot showing the difference
2. Copy all console messages
3. Share in PR comments

**If both formats fail:**
1. Check plugin is loaded (Settings > Community Plugins)
2. Try reloading Obsidian
3. Check for console errors

**If new format shows error notice:**
1. Note the exact error message
2. Check console for details
3. Report the error text and console log

## Success Criteria

- [ ] Old format renders consumable checkboxes
- [ ] New format renders consumable checkboxes  
- [ ] Both formats look identical
- [ ] Checkboxes are clickable in both
- [ ] Console shows successful meta extraction for new format
- [ ] No error messages in console
