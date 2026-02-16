# Test 9: Event Buttons

## Test Objective
Verify that event button blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- Buttons for Short Rest and Long Rest
- Clickable buttons

### Step 2: View New Format
**Expected Result:**
- Identical event buttons

### Step 3: Test Interactivity
**Expected Result:**
- Clicking buttons triggers reset events
- Consumables in same file reset appropriately

---

## Old Format (Should Work)

```event-btns
items:
  - name: Short Rest
    value: short-rest
  - name: Long Rest
    value: long-rest
```

---

## New Format (Should Also Work)

```rpg events
items:
  - name: Short Rest
    value: short-rest
  - name: Long Rest
    value: long-rest
```

---

## What to Check

✅ **Both render event buttons**
✅ **Short Rest button visible**
✅ **Long Rest button visible**
✅ **Buttons are clickable**

## Success Criteria

- [ ] Old format renders event buttons
- [ ] New format renders event buttons
- [ ] Both show Short Rest button
- [ ] Both show Long Rest button
- [ ] Buttons work when clicked
- [ ] Both formats look identical
