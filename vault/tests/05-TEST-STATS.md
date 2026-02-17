# Test 5: Stats Display

## Test Objective
Verify that stats blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- Stat display showing AC, Speed, Initiative
- Clean, formatted layout

### Step 2: View New Format
**Expected Result:**
- Identical stat display

---

## Old Format (Should Work)

```stats
AC: 15
Speed: 30 ft
Initiative: +2
```

---

## New Format (Should Also Work)

```rpg stats
AC: 15
Speed: 30 ft
Initiative: +2
```

---

## What to Check

✅ **Both render stat display**
✅ **AC shows as 15**
✅ **Speed shows as 30 ft**
✅ **Initiative shows as +2**

## Success Criteria

- [ ] Old format renders stats
- [ ] New format renders stats
- [ ] All stats display correctly
- [ ] Both formats look identical
