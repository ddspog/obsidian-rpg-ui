# Test 6: Badges

## Test Objective
Verify that badges blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- Badge display showing Level and Class
- Formatted as labeled values

### Step 2: View New Format
**Expected Result:**
- Identical badge display

---

## Old Format (Should Work)

```badges
- label: Level
  value: 5
- label: Class
  value: Fighter
- label: Background
  value: Soldier
```

---

## New Format (Should Also Work)

```rpg badges
- label: Level
  value: 5
- label: Class
  value: Fighter
- label: Background
  value: Soldier
```

---

## What to Check

✅ **Both render badges**
✅ **Level shows as 5**
✅ **Class shows as Fighter**
✅ **Background shows as Soldier**

## Success Criteria

- [ ] Old format renders badges
- [ ] New format renders badges
- [ ] All badge values correct
- [ ] Both formats look identical
