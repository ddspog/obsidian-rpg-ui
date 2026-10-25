# Test 11c: Character Entity Inventory Block

## Test Objective
Verify the `rpg character.inventory` entity block: wikilink-resolved items,
fixed sections, auto-encumbrance from sibling stats block STR, and container
collapse/expand.

## Prerequisites
- Plugin installed & loaded in Obsidian
- Switch to **Reading View**

## Frontmatter

```yaml
---
proficiency_bonus: 2
level: 3
---
```

---

## Minimal character with inventory

```rpg character.header
name: Test Fighter
classes:
  - name: Fighter
    level: 3
lineage: Human
```

```rpg character.stats
STR:
  value: 16
DEX:
  value: 12
CON:
  value: 14
INT:
  value: 10
WIS:
  value: 10
CHA:
  value: 8
```

```rpg character.inventory
items:
  - "[[Longsword]]"
  - name: "[[Longsword]]"
    equipped: true
    notes: "+1 magical"
  - "[[Shield]]"
  - name: "[[Dagger]]"
    qty: 2
  - name: "[[Quarterstaff]]"
    notes: "SC Focus"
  - name: Backpack
    container: main
    contents:
      - "[[Rope, Hempen (50 ft.)]]"
      - name: "[[Rations, Trail (1 day)]]"
        qty: 5
  - name: Saddlebags
    container: other
    contents:
      - "[[Crossbow, light]]"
currency:
  pp: 0
  gp: 42
  sp: 15
  cp: 3
```

---

## What to check

- [ ] **Currency row**: `PP` (dim, no value) · `GP 42` · `EP` (dim) · `SP 15` · `CP 3`.
- [ ] **Weapons** section: Longsword (x1), equipped Longsword +1 magical, Dagger x2, Quarterstaff with `SC Focus` in the meta column. Damage / properties pulled from each item note's frontmatter.
- [ ] **Armor** section: Shield with AC bonus from its frontmatter (`ac: +2` or similar).
- [ ] **Visible** section: hidden (no Visible-routed items in this fixture).
- [ ] **Main Containers**: `Backpack` expandable. Contents listed one level indented: Rope, Rations x5.
- [ ] **Other Containers**: `Saddlebags` expandable. Contains a Crossbow.
- [ ] **Encumbrance**:
  - STR 16 → carry = 240 lb., heavy = 160, push = 480.
  - Total weight sum shown; marker sits in the correct band.
  - Labels and values don't wrap mid-line.
- [ ] **Item links click-through**: clicking Longsword/Shield/etc. opens the item note.

## Change STR and re-render

Edit the stats block above to `STR.value: 8` and save. Reopen the note in
reading view. Encumbrance re-computes to carry = 120, heavy = 80, push = 240
— the marker should jump rightward toward the "over" band (items weigh more
than capacity).

## Expected fixes from Phase A screenshot

- Druidic Focus–style notes no longer show a stray leading `,`.
- `Carry Capacity` label + values don't break lines.
- Currency cells for empty denominations are just dimmed `PP` (no empty `()`).
