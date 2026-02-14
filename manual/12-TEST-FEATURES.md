# Test 12: Features Block

## Test Objective
Verify that the features block renders correctly with categorized features, level gating, and prerequisite checking.

## Prerequisites
- Plugin installed in Obsidian
- This file open in Obsidian
- Switch to **Reading View** to see rendered output
- Add frontmatter with level for level gating tests

## Frontmatter Setup
Add this frontmatter at the top of this file for testing:

```yaml
---
proficiency_bonus: 2
level: 3
---
```

## Test Steps

### Step 1: View Basic Features (Level 3)
Look at the "Wizard Features - Level 3" section below in Reading View.

**Expected Result:**
- Should see "Wizard" class header
- Should see "Class Features" category with ⚔️ icon
- "Arcane Recovery" should be visible and available (level 1 feature)
- "Spell Mastery" should be dimmed/disabled (requires level 18)

### Step 2: View Features with Subclass Requirements
Look at the same wizard features block.

**Expected Result:**
- "Subclass: School of Evocation" category should be visible (requires level 2, character is level 3)
- "Sculpt Spells" should be available (level 2, character meets requirement)
- "Potent Cantrip" should be dimmed (level 6, character doesn't meet requirement)

### Step 3: Test Attribute Requirements
Look at the "Features with Attribute Requirements" section below.

**Expected Result:**
- "War Caster" feat should be visible
- Its availability depends on constitution score from attributes block
- Should show requirement text if not met

### Step 4: Test Feature with Choices
Look at the "Features with Choices" section below.

**Expected Result:**
- Should see "Cantrips Known" choice group
- Shows "Pick 3 of 5" indicator
- Lists all 5 cantrip options

### Step 5: Check Console
**Expected Console Messages:**
```
DnD UI Toolkit: Fence line: "```rpg features"
DnD UI Toolkit: Extracted meta: "features"
```

---

## Wizard Features - Level 3

```rpg features
state_key: test-wizard-features
class: "Wizard"
categories:
  - name: "Class Features"
    icon: "⚔️"
    features:
      - name: "Arcane Recovery"
        level: 1
        description: "Recover spell slots on short rest. Slots = {{ceil (divide level 2)}}."
        reset_on: short-rest
        uses: 1
        state_key: arcane-recovery
      - name: "Spell Mastery"
        level: 18
        description: "Choose a 1st and 2nd level spell to cast at will."

  - name: "Subclass: School of Evocation"
    icon: "🔥"
    requires:
      level: 2
    features:
      - name: "Sculpt Spells"
        level: 2
        description: "Protect allies from your evocation spells."
      - name: "Potent Cantrip"
        level: 6
        description: "Cantrips deal half damage on successful save."
      - name: "Empowered Evocation"
        level: 10
        description: "Add Intelligence modifier to evocation spell damage."
      - name: "Overchannel"
        level: 14
        requires:
          feature: "Potent Cantrip"
        description: "Deal max damage with a spell of 5th level or lower."
```

---

## Features with Attribute Requirements

First, we need ability scores for attribute requirement checking:

```rpg attributes
abilities:
  strength: 10
  dexterity: 14
  constitution: 12
  intelligence: 16
  wisdom: 11
  charisma: 8
```

Now the features that require specific attributes:

```rpg features
state_key: test-feat-features
categories:
  - name: "Feats"
    icon: "🏅"
    features:
      - name: "War Caster"
        description: "Advantage on CON saves for concentration. Requires CON 13+."
        requires:
          attribute: { constitution: 13 }
        optional: true
      - name: "Alert"
        description: "+5 to initiative, can't be surprised."
        optional: true
      - name: "Heavily Armored"
        description: "Gain proficiency with heavy armor. Requires STR 13+."
        requires:
          attribute: { strength: 13 }
        optional: true
```

**Expected Results:**
- "War Caster": Should be **dimmed** (requires CON 13, character has 12)
- "Alert": Should be **available** (no requirements)
- "Heavily Armored": Should be **dimmed** (requires STR 13, character has 10)

---

## Features with Choices

```rpg features
state_key: test-choice-features
class: "Sorcerer"
categories:
  - name: "Spell Selection"
    icon: "✨"
    choices:
      - name: "Cantrips Known"
        pick: 4
        options:
          - "Fire Bolt"
          - "Mage Hand"
          - "Prestidigitation"
          - "Ray of Frost"
          - "Light"
          - "Shocking Grasp"
      - name: "1st Level Spells"
        pick: 2
        options:
          - "Magic Missile"
          - "Shield"
          - "Burning Hands"
          - "Chromatic Orb"
          - "Disguise Self"
```

---

## Features with Limited Uses

```rpg features
state_key: test-limited-features
class: "Fighter"
categories:
  - name: "Combat Abilities"
    icon: "⚔️"
    features:
      - name: "Second Wind"
        level: 1
        description: "Regain 1d10 + fighter level HP as a bonus action."
        uses: 1
        reset_on: short-rest
        state_key: second-wind
      - name: "Action Surge"
        level: 2
        description: "Take one additional action on your turn."
        uses: 1
        reset_on: short-rest
        state_key: action-surge
      - name: "Indomitable"
        level: 9
        description: "Reroll a failed saving throw."
        uses: 1
        reset_on: long-rest
        state_key: indomitable
```

---

## Category-Level Requirements

```rpg features
state_key: test-category-requirements
class: "Rogue"
categories:
  - name: "Base Features"
    features:
      - name: "Sneak Attack"
        level: 1
        description: "Deal extra 2d6 damage when you have advantage."
      - name: "Cunning Action"
        level: 2
        description: "Bonus action: Dash, Disengage, or Hide."

  - name: "Subclass: Arcane Trickster"
    icon: "🎭"
    requires:
      level: 3
    features:
      - name: "Spellcasting"
        level: 3
        description: "You learn to cast wizard spells."
      - name: "Mage Hand Legerdemain"
        level: 3
        description: "Enhanced invisible Mage Hand."

  - name: "High-Level Features"
    requires:
      level: 10
    features:
      - name: "Magical Ambush"
        level: 9
        description: "Advantage on spell attack rolls while hidden."
      - name: "Versatile Trickster"
        level: 13
        description: "Use Mage Hand to grant advantage."
```

**Expected Results with Level 3:**
- "Base Features" category: **Fully visible**
- "Subclass: Arcane Trickster" category: **Visible** (requires level 3)
- "High-Level Features" category: **May be hidden or dimmed** (requires level 10)

---

## What to Check

✅ **Class Header**
- Class name displays prominently if specified
- Header styling is clear

✅ **Categories**
- Categories have clear headings
- Icons appear correctly before category names
- Categories can have different icons (or no icon)

✅ **Features**
- Feature names are displayed
- Level badges show when feature has a level requirement
- Descriptions are readable and can contain templates
- Limited use counts display (e.g., "1 use")

✅ **Level Gating**
- Features below character level are available (normal styling)
- Features above character level are dimmed/disabled
- Requirement text shows what level is needed

✅ **Attribute Requirements**
- Features check attribute scores correctly
- Unmet attribute requirements show the feature as dimmed
- Requirement text explains what attributes are needed

✅ **Feature Prerequisites**
- Features requiring other features check correctly
- Prerequisite chains work (e.g., Overchannel requires Potent Cantrip)

✅ **Choices**
- Choice groups display clearly
- "Pick N of M" indicator shows correctly
- All options are listed and readable

✅ **Category Requirements**
- Categories with unmet level requirements behave correctly
- Features within category inherit category requirements

## Success Criteria

- [ ] Class header displays when specified
- [ ] All categories render with proper icons
- [ ] Features show names, levels, and descriptions
- [ ] Level gating works (features dimmed when level requirement not met)
- [ ] Attribute requirements work (features dimmed when attribute requirement not met)
- [ ] Feature prerequisites work correctly
- [ ] Choice groups display with pick count and options
- [ ] Limited uses show use counts
- [ ] Category-level requirements apply to all features in category
- [ ] Requirement tooltips/text explain what's needed
- [ ] Overall layout is organized and readable
- [ ] Console shows successful meta extraction
- [ ] No error messages in console

## Phase 2 Note

This is a **read-only** display in Phase 2. Future phases will add:
- Limited use tracking with buttons to use/restore
- Choice selection with persistence
- Integration with event system for automatic resets
- Write-back to code block for selected choices
