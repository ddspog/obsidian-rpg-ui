# Test 7: Initiative Tracker

## Test Objective
Verify that initiative blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- Initiative tracker with entity list
- Initiative values shown
- Interactive controls for combat tracking

### Step 2: View New Format
**Expected Result:**
- Identical initiative tracker

---

## Old Format (Should Work)

```initiative
state_key: test_old_initiative
entities:
  - name: Goblin 1
    ac: 15
    initiative: 12
  - name: Goblin 2
    ac: 15
    initiative: 8
  - name: Player Character
    ac: 16
    initiative: 14
```

---

## New Format (Should Also Work)

```rpg initiative
state_key: test_new_initiative
entities:
  - name: Goblin 1
    ac: 15
    initiative: 12
  - name: Goblin 2
    ac: 15
    initiative: 8
  - name: Player Character
    ac: 16
    initiative: 14
```

---

## What to Check

✅ **Both render initiative tracker**
✅ **Entities listed in initiative order**
✅ **AC values shown correctly**
✅ **Interactive controls work**

## Success Criteria

- [ ] Old format renders initiative tracker
- [ ] New format renders initiative tracker
- [ ] Entities in correct order (PC:14, Goblin1:12, Goblin2:8)
- [ ] AC displayed for each entity
- [ ] Both formats look identical
