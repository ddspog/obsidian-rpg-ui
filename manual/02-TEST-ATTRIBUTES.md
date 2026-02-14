# Test 2: Attributes (Ability Scores)

## Test Objective
Verify that ability score blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
Look at the "Old Format" section below in Reading View.

**Expected Result:**
- Should see 6 ability score cards (STR, DEX, CON, INT, WIS, CHA)
- Each card shows: ability name, score, modifier, saving throw
- DEX and INT should show as proficient (different styling)

### Step 2: View New Format
Look at the "New Format" section below in Reading View.

**Expected Result:**
- Should see identical ability score cards
- Same layout, same proficiency indicators
- Should look exactly like the old format

### Step 3: Check Console
**Expected Console Messages:**
```
DnD UI Toolkit: Fence line: "```rpg attributes"
DnD UI Toolkit: Extracted meta: "attributes"
DnD UI Toolkit: Processing rpg block with meta: attributes
```

---

## Old Format (Should Work)

```ability
abilities:
  strength: 14
  dexterity: 16
  constitution: 13
  intelligence: 12
  wisdom: 10
  charisma: 8

proficiencies:
  - dexterity
  - intelligence
```

---

## New Format (Should Also Work)

```rpg attributes
abilities:
  strength: 14
  dexterity: 16
  constitution: 13
  intelligence: 12
  wisdom: 10
  charisma: 8

proficiencies:
  - dexterity
  - intelligence
```

---

## What to Check

✅ **Both sections render ability cards**
✅ **Cards show correct modifiers** (e.g., STR 14 = +2)
✅ **Proficient saves highlighted** (DEX +5, INT +3 with +2 prof bonus)
✅ **Both formats look identical**

## Expected Modifiers

With proficiency bonus +2:
- **STR 14**: +2 modifier, +2 save (not proficient)
- **DEX 16**: +3 modifier, +5 save (proficient)
- **CON 13**: +1 modifier, +1 save (not proficient)
- **INT 12**: +1 modifier, +3 save (proficient)
- **WIS 10**: +0 modifier, +0 save (not proficient)
- **CHA 8**: -1 modifier, -1 save (not proficient)

## Success Criteria

- [ ] Old format renders ability score cards
- [ ] New format renders ability score cards
- [ ] Both show correct modifiers
- [ ] Both highlight proficient saves
- [ ] Both formats look identical
- [ ] Console shows successful meta extraction
