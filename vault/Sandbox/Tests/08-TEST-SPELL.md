# Test 8: Spell Components

## Test Objective
Verify that spell component blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- Spell component indicators
- V, S, M markers for verbal, somatic, material

### Step 2: View New Format
**Expected Result:**
- Identical spell component display

---

## Old Format (Should Work)

```spell-components
verbal: true
somatic: true
material: false
```

---

## New Format (Should Also Work)

```rpg spell
verbal: true
somatic: true
material: false
```

---

## What to Check

✅ **Both render spell components**
✅ **Verbal component shown**
✅ **Somatic component shown**
✅ **Material component not shown**

## Success Criteria

- [ ] Old format renders spell components
- [ ] New format renders spell components
- [ ] V and S shown, M not shown
- [ ] Both formats look identical
