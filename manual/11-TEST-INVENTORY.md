# Test 11: Inventory Block

## Test Objective
Verify that the inventory block renders correctly with items, currency, and encumbrance display.

## Prerequisites
- Plugin installed in Obsidian
- This file open in Obsidian
- Switch to **Reading View** to see rendered output
- Add frontmatter with strength attribute for encumbrance calculation

## Frontmatter Setup
Add this frontmatter at the top of this file for testing:

```yaml
---
proficiency_bonus: 2
level: 5
---
```

## Test Steps

### Step 1: View Basic Inventory
Look at the "Basic Inventory" section below in Reading View.

**Expected Result:**
- Should see currency display showing: 50 GP, 120 SP, 30 CP
- Should see two sections: "Equipped" and "Backpack"
- Each section shows items with names, quantities, weights, and tags
- Items should display descriptions where provided

### Step 2: View Inventory with Encumbrance
Look at the "Inventory with Encumbrance" section below in Reading View.

**Expected Result:**
- Should see currency display
- Should see "Carrying: X / Y lbs" label with encumbrance bar
- The bar should visually represent the weight ratio
- Should see items grouped in sections

### Step 3: Check Item Display
**Expected Item Details:**
- Item names should be prominent
- Quantities > 1 should show "×N" badge
- Weights should display total (weight × quantity)
- Tags should appear as small pills/badges below items
- Descriptions should be visible and readable

### Step 4: Check Console
**Expected Console Messages:**
```
DnD UI Toolkit: Fence line: "```rpg inventory"
DnD UI Toolkit: Extracted meta: "inventory"
```

---

## Basic Inventory

```rpg inventory
state_key: test-basic-inventory
currency:
  gold: 50
  silver: 120
  copper: 30
sections:
  - name: "Equipped"
    items:
      - name: "Longbow +1"
        weight: 2
        quantity: 1
        tags: [weapon, magical]
        description: "+1 to attack and damage rolls"
      - name: "Studded Leather Armor"
        weight: 13
        quantity: 1
        tags: [armor]
  - name: "Backpack"
    items:
      - name: "Rope (50 ft)"
        weight: 10
        quantity: 1
      - name: "Rations"
        weight: 1
        quantity: 5
        consumable: true
```

---

## Inventory with Encumbrance

For this test, we need ability scores to calculate encumbrance. Add an attributes block above:

```rpg attributes
abilities:
  strength: 16
  dexterity: 14
  constitution: 13
  intelligence: 10
  wisdom: 12
  charisma: 8
```

Now the inventory with encumbrance tracking:

```rpg inventory
state_key: test-encumbrance-inventory
currency:
  platinum: 2
  gold: 150
  silver: 45
sections:
  - name: "Weapons"
    items:
      - name: "Greatsword"
        weight: 6
        quantity: 1
        tags: [weapon, two-handed]
      - name: "Dagger"
        weight: 1
        quantity: 2
        tags: [weapon, light, finesse]
  - name: "Armor & Gear"
    items:
      - name: "Plate Armor"
        weight: 65
        quantity: 1
        tags: [armor, heavy]
      - name: "Backpack"
        weight: 5
        quantity: 1
      - name: "Bedroll"
        weight: 7
        quantity: 1
      - name: "Torches"
        weight: 1
        quantity: 10
encumbrance:
  capacity: "{{multiply strength 15}}"
```

---

## Multiple Currency Types

```rpg inventory
state_key: test-currency-inventory
currency:
  platinum: 5
  gold: 123
  electrum: 8
  silver: 456
  copper: 789
sections:
  - name: "Treasure"
    items:
      - name: "Ruby Ring"
        weight: 0
        quantity: 1
        tags: [jewelry, valuable]
        description: "Worth approximately 500 gp"
```

---

## What to Check

✅ **Currency Display**
- All currency types show with correct values
- Currency is displayed in order: PP, GP, EP, SP, CP
- Zero or missing currency types don't appear

✅ **Item Sections**
- Sections have clear headings
- Items are organized within sections
- Section styling is clear and readable

✅ **Item Details**
- Item names are displayed
- Quantities > 1 show multiplication badge (×N)
- Weights show total weight (weight × quantity)
- Tags appear as badges/pills
- Descriptions are readable

✅ **Encumbrance Tracking**
- Encumbrance bar appears when capacity is specified
- Label shows "Carrying: X / Y lbs"
- Bar visually represents the weight ratio
- Capacity calculation uses strength attribute correctly (STR 16 = 240 lbs capacity with formula `{{multiply strength 15}}`)

## Expected Calculations

For "Inventory with Encumbrance" (STR 16):
- **Capacity**: 16 × 15 = 240 lbs
- **Total Weight**: 
  - Greatsword: 6 lbs
  - Daggers: 1 × 2 = 2 lbs
  - Plate Armor: 65 lbs
  - Backpack: 5 lbs
  - Bedroll: 7 lbs
  - Torches: 1 × 10 = 10 lbs
  - **Total**: 95 lbs
- **Encumbrance**: 95 / 240 = ~39.6%

## Success Criteria

- [ ] Currency displays correctly with all types
- [ ] Item sections render with clear headings
- [ ] Individual items show all details (name, quantity, weight, tags, description)
- [ ] Encumbrance bar appears with capacity calculation
- [ ] Encumbrance calculation is accurate based on strength
- [ ] Tags display as styled badges
- [ ] Overall layout is clean and readable
- [ ] Console shows successful meta extraction
- [ ] No error messages in console

## Phase 2 Note

This is a **read-only** display in Phase 2. Future phases will add:
- Add/remove items via UI
- Edit quantities inline
- Consumable item tracking
- Write-back to YAML code block
