# Test 3: Skills

## Test Objective
Verify that skills blocks render correctly in both old and new formats.

## Test Steps

### Step 1: View Old Format
**Expected Result:**
- Should see a skills list with modifiers
- Stealth should show expertise (double proficiency)
- Perception and Investigation should show proficiency
- All skill modifiers calculated correctly

### Step 2: View New Format
**Expected Result:**
- Should see identical skills list
- Same proficiency and expertise indicators

---

## Old Format (Should Work)

```skills
proficiencies:
  - stealth
  - perception
  - investigation

expertise:
  - stealth
```

---

## New Format (Should Also Work)

```rpg skills
proficiencies:
  - stealth
  - perception
  - investigation

expertise:
  - stealth
```

---

## What to Check

✅ **Both formats render skills list**
✅ **Proficiency indicators visible**
✅ **Expertise indicator visible for Stealth**
✅ **Skill modifiers calculated correctly**

## Expected Skills

With DEX +3 and proficiency +2:
- **Stealth (DEX)**: +7 (expertise = +3 + 4)
- **Perception (WIS)**: +2 (proficient = +0 + 2)
- **Investigation (INT)**: +3 (proficient = +1 + 2)

## Success Criteria

- [ ] Old format renders skills
- [ ] New format renders skills
- [ ] Both show proficiency markers
- [ ] Both show expertise markers
- [ ] Modifiers are correct
- [ ] Both formats look identical
