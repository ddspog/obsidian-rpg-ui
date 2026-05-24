# Test 11b: Inventory Block (new schema)

## Test Objective
Verify that the `rpg inventory` block renders the **new** schema: flat `items:`
list with wikilink resolution, fixed sections (Weapons / Armor / Visible /
Main Containers / Other Containers), container collapse/expand, and
auto-encumbrance from STR.

## Prerequisites
- Plugin installed in Obsidian
- This file open in Reading View
- Compendium items under `tales-of-the-valiant/worldbuilding/items/`
  resolved via wikilinks — look for notes whose frontmatter has `weight`, `type`,
  `cost`, etc. (e.g. `Longsword.md`, `Quarterstaff.md`).

## Frontmatter

```yaml
---
proficiency_bonus: 2
level: 5
strength: 14
dexterity: 12
constitution: 12
intelligence: 10
wisdom: 10
charisma: 10
---
```

---

## Basic Inventory (wikilink-resolved)

```rpg inventory
state_key: test-inv-new-basic
items:
  - "[[Longsword]]"
  - "[[Shield]]"
  - "[[Quarterstaff]]"
  - name: "[[Dagger]]"
    qty: 2
  - name: "[[Longsword]]"
    equipped: true
    notes: "+1 magical"
currency:
  pp: 0
  gp: 42
  sp: 15
  cp: 3
```

**Expected:**
- Weapons section lists Longsword, Quarterstaff, Dagger (x2), and the equipped +1 Longsword
- Armor section lists Shield
- Visible section is hidden (empty)
- Currency row shows `PP (0) · GP (42) · EP () · SP (15) · CP (3)` with the empty denominations dimmed
- Encumbrance bar sits in the "free" band for STR 14 (carry = 210 lb.)

---

## Containers & Nesting

```rpg inventory
state_key: test-inv-new-containers
items:
  - "[[Longsword]]"
  - "[[Quarterstaff]]"
  - name: "[[Dagger]]"
    qty: 2
  - name: "[[Longsword]]"
    section: visible
    notes: "display piece on the mantle"
  - name: "Backpack"
    container: main
    contents:
      - name: "[[Quarterstaff]]"
      - "[[Dagger]]"
  - name: "Saddlebags"
    container: other
    contents:
      - "[[Longsword]]"
      - name: "[[Dagger]]"
        qty: 5
currency:
  gp: 10
```

**Expected:**
- Weapons section: Longsword, Quarterstaff, Dagger x2
- Visible section: Longsword (because of explicit `section: visible`) — "display piece on the mantle"
- Main Containers: Backpack (collapsible, click caret to expand/collapse)
- Other Containers: Saddlebags (collapsible)
- Each container's summary row shows its combined weight
- No Armor section (hidden when empty)

---

## Encumbrance Overrides

```rpg inventory
state_key: test-inv-new-encumbrance
items:
  - "[[Longsword]]"
encumbrance:
  carry: 60
  heavy: 40
  push: 120
```

**Expected:**
- Encumbrance row shows `40 lb. - 40 lb. - 60 lb.` (carry band) and `120 lb.` push
- The band ratio reflects the overrides, not STR × 15

---

## Legacy Fallback

Old-shape YAML (using `sections:`) still renders via the legacy renderer:

```rpg inventory
state_key: test-inv-new-legacy-fallback
currency:
  gold: 50
sections:
  - name: "Equipped"
    items:
      - name: "Longbow +1"
        weight: 2
        tags: [weapon, magical]
```

**Expected:**
- This block renders using the original "sections" layout (no wikilink
  resolution, no fixed section routing) — confirms back-compat.

---

## Success Criteria

- [ ] Wikilinks resolve: item names display without `[[]]`; clicking opens the note
- [ ] Weight/damage/type are pulled from the item's frontmatter (not from YAML)
- [ ] Fixed sections render only when non-empty (in the correct order)
- [ ] Containers collapse/expand on click (transient state in Phase A)
- [ ] Encumbrance bands reflect STR changes in frontmatter without reload
- [ ] Legacy `sections:`-shaped YAML still renders via the legacy component
- [ ] No console errors
