# Test 10: Complete Character Sheet

## Test Objective
Verify all block types work together in a complete character sheet using the new `rpg` namespace, including Phase 2 inventory and features blocks.

## Alternative: Use Test Vault
For a complete character example with entity files, see `manual/vault/Session-Tests/Characters/Elara.md` in the test vault.

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

```rpg inventory
state_key: complete_test_inventory
currency:
  gold: 125
  silver: 45
  copper: 18
sections:
  - name: "Equipped"
    items:
      - name: "Rapier +1"
        weight: 2
        quantity: 1
        tags: [weapon, magical, finesse]
        description: "+1 to attack and damage rolls"
      - name: "Studded Leather Armor"
        weight: 13
        quantity: 1
        tags: [armor, light]
  - name: "Backpack"
    items:
      - name: "Thieves' Tools"
        weight: 1
        quantity: 1
        tags: [tool]
      - name: "Healing Potion"
        weight: 0.5
        quantity: 2
        tags: [potion, consumable]
encumbrance:
  capacity: "{{multiply strength 15}}"
```

```rpg features
state_key: complete_test_features
class: "Rogue"
categories:
  - name: "Class Features"
    icon: "⚔️"
    features:
      - name: "Sneak Attack"
        level: 1
        description: "Deal extra 3d6 damage when you have advantage."
      - name: "Cunning Action"
        level: 2
        description: "Bonus action: Dash, Disengage, or Hide."
      - name: "Uncanny Dodge"
        level: 5
        description: "Use reaction to halve damage from an attack."
        
  - name: "Subclass: Arcane Trickster"
    icon: "🎭"
    requires:
      level: 3
    features:
      - name: "Spellcasting"
        level: 3
        description: "You can cast wizard spells (Intelligence-based)."
      - name: "Mage Hand Legerdemain"
        level: 3
        description: "Your Mage Hand is invisible and can perform tasks."
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
✅ **Inventory** with currency and items (Phase 2)
✅ **Features** with categorized abilities (Phase 2)

### Interactivity
✅ **Consumable checkboxes** toggle
✅ **HP adjustments** work
✅ **Event buttons** trigger resets
✅ **Hit dice** can be used

### Phase 2 Features
✅ **Inventory** shows currency, sections, and encumbrance
✅ **Features** show level badges and category icons
✅ **Features** properly gate high-level abilities (currently level 5)

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

- [ ] All 10 block types render correctly (8 Phase 1 + 2 Phase 2)
- [ ] Character sheet looks complete and professional
- [ ] All interactive elements work
- [ ] No error messages in console
- [ ] All debug messages show successful meta extraction
- [ ] Event buttons reset consumables
- [ ] HP and consumable state persists
- [ ] Inventory displays items, currency, and encumbrance bar
- [ ] Features show with proper level gating and category organization

## Expected Layout Order (top to bottom)

1. Event Buttons (Short Rest, Long Rest)
2. Badges (Level 5, Rogue, Half-Elf)
3. Stats (AC, Speed, Initiative, Prof Bonus)
4. Ability Scores (6 cards in grid)
5. Skills (list with modifiers)
6. Health Points (HP bar and hit dice)
7. Consumables (3 items with checkboxes)
8. Spell Components (V, S, M indicators)
9. **Inventory** (currency, equipped items, backpack) - ✨ NEW
10. **Features** (class features and subclass features) - ✨ NEW

## Notes

This represents a complete D&D 5e character sheet using only the new `rpg` format. It includes both Phase 1 (unified namespace) and Phase 2 (system abstraction + new blocks) features. If this works, it proves both migrations are successful.
