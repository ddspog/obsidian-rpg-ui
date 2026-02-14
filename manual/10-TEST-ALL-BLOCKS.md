# Test 10: Complete Character Sheet

## Test Objective
Verify all block types work together in a complete character sheet using the new `rpg` namespace.

## Test Steps

1. Open this file in Reading View
2. Verify all components render correctly
3. Test interactivity (checkboxes, HP adjustments, buttons)
4. Check console for debug messages

---

## Character Sheet with New Format

```rpg events
items:
  - name: Short Rest
    value: short-rest
  - name: Long Rest
    value: long-rest
```

```rpg badges
- label: Level
  value: 5
- label: Class
  value: Rogue
- label: Race
  value: Half-Elf
```

```rpg stats
AC: 15
Speed: 30 ft
Initiative: +3
Proficiency Bonus: +3
```

```rpg attributes
abilities:
  strength: 10
  dexterity: 16
  constitution: 14
  intelligence: 12
  wisdom: 13
  charisma: 14

proficiencies:
  - dexterity
  - intelligence
```

```rpg skills
proficiencies:
  - stealth
  - perception
  - investigation
  - deception
  - persuasion

expertise:
  - stealth
  - perception
```

```rpg healthpoints
state_key: complete_test_hp
health: 35
hitdice:
  dice: d8
  value: 5
```

```rpg consumable
items:
  - label: "Sneak Attack"
    state_key: complete_test_sneak
    uses: 1
    reset_on: ["short-rest", "long-rest"]
  - label: "Level 1 Spell Slots"
    state_key: complete_test_slots_1
    uses: 4
    reset_on: "long-rest"
  - label: "Level 2 Spell Slots"
    state_key: complete_test_slots_2
    uses: 3
    reset_on: "long-rest"
```

```rpg spell
verbal: true
somatic: true
material: true
```

---

## What to Check

### Visual Components
✅ **Event buttons** at top
✅ **Badges** showing character info
✅ **Stats** display
✅ **Ability scores** with modifiers
✅ **Skills list** with proficiency markers
✅ **HP tracker** with hit dice
✅ **Consumables** with checkboxes
✅ **Spell components** display

### Interactivity
✅ **Consumable checkboxes** toggle
✅ **HP adjustments** work
✅ **Event buttons** trigger resets
✅ **Hit dice** can be used

### Console Output
Check for these messages (should appear multiple times):
```
DnD UI Toolkit: Fence line: "```rpg events"
DnD UI Toolkit: Extracted meta: "events"
DnD UI Toolkit: Processing rpg block with meta: events

DnD UI Toolkit: Fence line: "```rpg badges"
DnD UI Toolkit: Extracted meta: "badges"
DnD UI Toolkit: Processing rpg block with meta: badges

... (similar for all block types)
```

## Success Criteria

- [ ] All 8 block types render correctly
- [ ] Character sheet looks complete and professional
- [ ] All interactive elements work
- [ ] No error messages in console
- [ ] All debug messages show successful meta extraction
- [ ] Event buttons reset consumables
- [ ] HP and consumable state persists

## Expected Layout Order (top to bottom)

1. Event Buttons (Short Rest, Long Rest)
2. Badges (Level 5, Rogue, Half-Elf)
3. Stats (AC, Speed, Initiative, Prof Bonus)
4. Ability Scores (6 cards in grid)
5. Skills (list with modifiers)
6. Health Points (HP bar and hit dice)
7. Consumables (3 items with checkboxes)
8. Spell Components (V, S, M indicators)

## Notes

This represents a typical D&D 5e character sheet using only the new `rpg` format. If this works, it proves the migration is successful.
