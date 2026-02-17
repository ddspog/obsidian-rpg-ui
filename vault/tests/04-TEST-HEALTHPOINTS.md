# Test 4: Health Points

## Test Objective
Verify that healthpoints blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- HP tracker with current/max HP display
- Buttons to adjust HP
- Hit dice tracker
- Temp HP input

### Step 2: View New Format
**Expected Result:**
- Identical HP tracker
- Same interactive controls

### Step 3: Test Interactivity
**Expected Result:**
- HP adjustment buttons work
- Hit dice can be used
- Temp HP can be added

---

## Old Format (Should Work)

```healthpoints
state_key: test_old_hp
health: 28
hitdice:
  dice: d8
  value: 3
```

---

## New Format (Should Also Work)

```rpg healthpoints
state_key: test_new_hp
health: 28
hitdice:
  dice: d8
  value: 3
```

---

## What to Check

✅ **Both render HP tracker**
✅ **HP displays correctly (28)**
✅ **Hit dice shows d8 x3**
✅ **Adjustment buttons work**
✅ **State persists**

## Success Criteria

- [ ] Old format renders HP tracker
- [ ] New format renders HP tracker
- [ ] Both show HP: 28/28
- [ ] Both show 3d8 hit dice
- [ ] HP can be adjusted in both
- [ ] State persists across reloads
- [ ] Both formats look identical
