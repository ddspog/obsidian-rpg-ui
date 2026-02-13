# Plan: Multi-System RPG Support + New Blocks

## Overview

Evolve the plugin from D&D 5e-only into a multi-system RPG toolkit. System rules are defined in **markdown files using code blocks** — the same pattern already used for character sheets. D&D 5e is the built-in default when no system is assigned.

---

## Part 0: Typed Frontmatter

### The problem today

Currently, frontmatter parsing is **untyped and D&D-hardcoded**:

- `frontmatter.ts` has a hardcoded alias map (`FrontMatterKeys`) that only knows about `proficiency_bonus` and `level`
- `levelToProficiencyBonus()` is a D&D 5e-specific lookup table baked into the parser
- The `Frontmatter` type has `proficiency_bonus: number` as a fixed required field
- Every view reads frontmatter the same way regardless of what the markdown file represents (character, monster, item, etc.)

### The solution: `type` field in frontmatter

Users declare what kind of entity the file represents:

```yaml
---
type: character
level: 5
class: Wizard
---
```

```yaml
---
type: monster
cr: 5
size: large
creature_type: dragon
---
```

```yaml
---
type: item
rarity: rare
attunement: true
weight: 3
---
```

### How it works

The `system` code block in the system definition file declares **which frontmatter fields each type expects**:

```markdown
\`\`\`system
name: "D&D 5e"

types:
  character:
    fields:
      - name: level
        type: number
        default: 1
      - name: proficiency_bonus
        type: number
        derived: "{{level_to_proficiency level}}"
        aliases: [proficiencyBonus, "Proficiency Bonus"]
      - name: class
        type: string
      - name: subclass
        type: string

  monster:
    fields:
      - name: cr
        type: number
        default: 0
      - name: size
        type: string
        default: medium
      - name: creature_type
        type: string
      - name: legendary_actions
        type: number
        default: 0

  item:
    fields:
      - name: rarity
        type: string
        default: common
      - name: attunement
        type: boolean
        default: false
      - name: weight
        type: number
        default: 0
\`\`\`
```

### Parsing flow (revised)

1. Read raw frontmatter from Obsidian's `metadataCache`
2. Look for `type` field (defaults to `"character"` if missing — backwards compatible)
3. Look up the type definition from the active system
4. For each field in the type definition:
   - Check frontmatter for the field name and its aliases (case-insensitive)
   - If missing, check if there's a `derived` formula and evaluate it
   - If still missing, use the `default` value
5. Pass through any extra frontmatter keys as-is (preserves existing behavior)

### What changes in `frontmatter.ts`

The current code:
```typescript
const FrontMatterKeys: Record<keyof Frontmatter, string[]> = {
  proficiency_bonus: ["proficiencyBonus", "Proficiency Bonus", "proficiency_bonus"],
  level: ["level", "Level"],
};
```

Becomes driven by the system's type definitions instead of a hardcoded map. The `levelToProficiencyBonus()` function moves into a `derived` expression in the D&D 5e system definition (or an `expression` code block like `level_to_proficiency`).

### Type in `Frontmatter`

```typescript
export type Frontmatter = {
  type: string;              // "character" | "monster" | "item" | custom
  [key: string]: any;        // All other fields are dynamic, driven by type definition
};
```

No more hardcoded `proficiency_bonus` as a required field. The system definition decides what exists.

### Impact on views

Views that currently read `frontmatter.proficiency_bonus` directly will instead access it as `frontmatter["proficiency_bonus"]`. Since the type system guarantees the field exists (with a default), this is safe. Views can also check `frontmatter.type` to conditionally render — e.g. show hit dice only for `character`, show CR badge only for `monster`.

### Backwards compatibility

- If `type` is missing from frontmatter → defaults to `"character"`
- If no system is assigned → built-in D&D 5e type definitions apply
- Existing character sheets with `proficiency_bonus` or `level` continue working unchanged
- The alias system (`proficiencyBonus` → `proficiency_bonus`) is preserved, just moved from hardcoded map to system definition

---

## Part 1: How System Definitions Work

### The system markdown file

A system is a regular Obsidian markdown file (e.g. `Systems/DnD 5e.md`) containing code blocks that define the rules. The entry point is a `system` code block:

```markdown
# D&D 5e System

This file defines the D&D 5th Edition rules for the RPG UI Toolkit.

\`\`\`system
name: "D&D 5e"
version: "1.0"

attributes:
  - strength
  - dexterity
  - constitution
  - intelligence
  - wisdom
  - charisma

types:
  character:
    fields:
      - name: level
        type: number
        default: 1
      - name: proficiency_bonus
        type: number
        derived: "{{level_to_proficiency level}}"
        aliases: [proficiencyBonus, "Proficiency Bonus"]
      - name: class
        type: string
      - name: subclass
        type: string

  monster:
    fields:
      - name: cr
        type: number
        default: 0
      - name: size
        type: string
        default: medium
      - name: creature_type
        type: string

  item:
    fields:
      - name: rarity
        type: string
        default: common
      - name: attunement
        type: boolean
        default: false
      - name: weight
        type: number
        default: 0
\`\`\`

## Modifier Calculation

How ability modifiers are derived from scores:

\`\`\`expression
id: modifier
description: "Calculate ability modifier from score"
params:
  - score
formula: "{{floor (divide (subtract score 10) 2)}}"
\`\`\`

## Saving Throw Calculation

\`\`\`expression
id: saving_throw
description: "Calculate saving throw bonus"
params:
  - modifier
  - proficient
  - proficiency_bonus
  - bonus
formula: "{{add modifier (if proficient proficiency_bonus 0) bonus}}"
\`\`\`

## Skill Modifier

\`\`\`expression
id: skill_modifier
description: "Calculate skill modifier"
params:
  - attribute_mod
  - proficiency_bonus
  - proficiency_level
  - bonus
formula: "{{add attribute_mod (multiply proficiency_bonus proficiency_level) bonus}}"
\`\`\`
```

Then in a separate section (or the same file), skills are defined with a `skill-list` code block:

```markdown
## Skills

\`\`\`skill-list
skills:
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Animal Handling"
    attribute: wisdom
  - label: "Arcana"
    attribute: intelligence
  # ... etc
\`\`\`
```

### Key insight: it's markdown all the way down

- The system file is **browsable in Obsidian** — users can read the descriptions, see the formulas, and understand the rules
- Each code block is self-contained and identified by its `id`
- The `system` code block is the entry point that declares attributes and frontmatter fields
- `expression` blocks define named formulas the plugin evaluates at runtime
- `skill-list` blocks define the skills available in the system
- The existing Handlebars template engine (with `floor`, `ceil`, `add`, `subtract`, `multiply`, `divide` helpers) already supports these formulas

### For a different system (e.g. Fate):

```markdown
# Fate Core System

\`\`\`system
name: "Fate Core"
version: "1.0"

attributes:
  - careful
  - clever
  - flashy
  - forceful
  - quick
  - sneaky

types:
  character:
    fields:
      - name: refresh
        type: number
        default: 3
      - name: high_concept
        type: string
      - name: trouble
        type: string

  npc:
    fields:
      - name: refresh
        type: number
        default: 1
      - name: aspects
        type: number
        default: 2
\`\`\`

## Approach Modifier

\`\`\`expression
id: modifier
params:
  - score
formula: "{{score}}"
\`\`\`
```

No skills block → no skills panel rendered. Different attributes → the ability view adapts. Different modifier formula → calculations change.

---

## Part 2: Settings — Folder-to-System Assignment

In plugin settings, users map vault folders to system definition markdown files:

```
Settings → Systems
┌────────────────────────────────────────────────────────┐
│  Folder             │  System File                     │
│  (default)          │  Built-in D&D 5e                 │
│  /campaigns/fate    │  Systems/Fate Core.md            │
│  /campaigns/pf2e    │  Systems/Pathfinder 2e.md        │
└────────────────────────────────────────────────────────┘
[+ Add Assignment]
```

**Resolution order** (most specific folder wins):
1. Exact match on current file's folder
2. Walk up parent folders
3. Fall back to built-in D&D 5e (hardcoded, no file needed)

Settings type change:

```typescript
interface RPGUIToolkitSettings {
  // existing fields unchanged...

  // new
  systemAssignments: { folder: string; systemFile: string }[];
  // no defaultSystem needed — built-in D&D 5e is always the fallback
}
```

---

## Part 3: Implementation — System Abstraction Layer

### Step 1: Define `RPGSystem` interface (`lib/systems/types.ts`)

```typescript
export interface RPGSystem {
  name: string;
  attributes: string[];
  types: Record<string, EntityTypeDef>;     // "character" | "monster" | "item" | custom
  skills: SkillDefinition[];
  expressions: Map<string, ExpressionDef>;  // id → compiled expression
}

export interface EntityTypeDef {
  fields: FrontmatterFieldDef[];
}

export interface FrontmatterFieldDef {
  name: string;
  type: "number" | "string" | "boolean";
  default?: any;
  derived?: string;                         // Handlebars formula, evaluated if value not set
  aliases?: string[];                       // Alternative frontmatter key names
}

export interface ExpressionDef {
  id: string;
  params: string[];
  formula: string;                          // Handlebars template string
  evaluate: (context: Record<string, number | boolean>) => number;
}

export interface SkillDefinition {
  label: string;
  attribute: string;
}
```

### Step 2: Built-in D&D 5e system (`lib/systems/dnd5e.ts`)

Implements `RPGSystem` using the current hardcoded values:
- Attributes: the six D&D abilities
- Skills: the 18 D&D skills (moved from `domains/skills.ts`)
- Expressions: `modifier` → `floor((score - 10) / 2)`, `saving_throw`, `skill_modifier`
- Frontmatter: `proficiency_bonus`, `level`

This is a pure refactor — extracts existing constants, no behavior change.

### Step 3: System parser (`lib/systems/parser.ts`)

Reads a markdown file from the vault, extracts code blocks:
1. Find `system` code block → parse attributes, frontmatter fields
2. Find all `expression` code blocks → compile formulas via Handlebars into `evaluate` functions
3. Find `skill-list` code block → parse skill definitions
4. Return an `RPGSystem` object

Uses the existing `extractFirstCodeBlock` utility (extended to extract all blocks of a type).

### Step 4: System registry (`lib/systems/registry.ts`)

- Holds folder → system mapping from settings
- Caches parsed systems (invalidated on file change)
- `resolve(filePath: string): RPGSystem` — walks folders up, returns matching system or D&D 5e default
- Listens to vault file changes to invalidate cache when system files are modified

### Step 5: Thread system into Views

- `BaseView` constructor receives the system registry
- `register()` resolves the active system for the current file path
- Domain functions that use D&D-specific logic (e.g. `calculateModifier`) are replaced with `system.expressions.get("modifier").evaluate({ score })`
- Views that render attributes/skills use `system.attributes` and `system.skills` instead of hardcoded lists

**Affected files:**
- `AbilityScoreView.tsx` — uses `system.attributes`, `system.expressions.get("modifier")`
- `SkillsView.tsx` — uses `system.skills`, `system.expressions.get("skill_modifier")`
- `domains/abilities.ts` — `calculateModifier` delegates to system expression
- `domains/skills.ts` — `Skills` array replaced by `system.skills`
- `utils/template.ts` — `modifier` helper delegates to active system
- `main.ts` — creates registry, passes to views

### Step 6: Settings UI

Add a "Systems" section in settings tab:
- List of folder → file assignments with remove buttons
- "Add" button with text inputs for folder path and file path
- "(default)" row showing the built-in D&D 5e fallback (not removable)

---

## Part 4: New Block — Inventory

### Purpose
Track items, equipment, currency, and encumbrance.

### YAML syntax

~~~markdown
```inventory
state_key: ranger-inventory
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
encumbrance:
  capacity: "{{multiply strength 15}}"
```
~~~

### Implementation
- **Domain** (`lib/domains/inventory.ts`): Parse YAML, weight calculation, consumable state
- **Component** (`lib/components/inventory.tsx`): Collapsible sections, currency row, weight/encumbrance bar, consumable use buttons
- **View** (`lib/views/InventoryView.tsx`): Stateful (KV store for quantities, consumable usage, section collapse)
- **Styles** (`lib/styles/components/inventory.css`)
- Consumable items integrate with event system (reset_on rest events)
- Template support for computed values like carry capacity

---

## Part 5: New Block — Features

### Purpose
Track class features, racial traits, feats — level-gated, optional, and with choices.

### YAML syntax

~~~markdown
```features
state_key: wizard-features
class: "Wizard"
sections:
  - name: "Class Features"
    features:
      - name: "Arcane Recovery"
        level: 1
        description: "Recover spell slots on short rest. Slots = {{ceil (divide level 2)}}."
        reset_on: long-rest
        uses: 1
        state_key: arcane-recovery
      - name: "Spell Mastery"
        level: 18
        description: "Choose a 1st and 2nd level spell to cast at will."

  - name: "Subclass: School of Evocation"
    features:
      - name: "Sculpt Spells"
        level: 2
        description: "Protect allies from your evocation spells."
      - name: "Potent Cantrip"
        level: 6
        description: "Cantrips deal half damage on successful save."

  - name: "Feats"
    features:
      - name: "War Caster"
        description: "Advantage on CON saves for concentration."
        optional: true

  - name: "Choices"
    choices:
      - name: "Cantrips Known"
        pick: 3
        options:
          - "Fire Bolt"
          - "Mage Hand"
          - "Prestidigitation"
          - "Minor Illusion"
          - "Light"
```
~~~

### Implementation
- **Domain** (`lib/domains/features.ts`): Parse YAML, level filtering (from frontmatter `level`), choice management
- **Component** (`lib/components/features.tsx`): Collapsible sections, level badges, limited-use tracking (reuses consumable pattern), choice picker
- **View** (`lib/views/FeaturesView.tsx`): Stateful (KV store for choices + limited-use counts), listens to `fm:changed` for level gating
- **Styles** (`lib/styles/components/features.css`)
- Limited-use features reuse the existing consumable/reset infrastructure
- Template support in descriptions

---

## Part 6: Phased Delivery

### Phase 1 — New blocks (no system changes)
1. Implement Inventory block (domain, component, view, styles)
2. Implement Features block (domain, component, view, styles)
3. Register both in `main.ts`

Delivers user value immediately, D&D-only, no breaking changes.

### Phase 2 — System abstraction
4. Define `RPGSystem` interface
5. Create built-in D&D 5e system (extract from domains)
6. Create system registry
7. Thread system into existing views (refactor `AbilityScoreView`, `SkillsView`, domains)
8. Register `system`, `expression`, `skill-list` code block parsers (read-only, they define rules not render UI)

All existing character sheets continue working — D&D 5e is the default.

### Phase 3 — User-defined systems
9. Implement system markdown parser (reads `system`, `expression`, `skill-list` blocks from vault files)
10. Add folder-to-system settings UI
11. Wire registry to resolve system per file path

---

## Summary of New Files

```
lib/
├── systems/
│   ├── types.ts              # RPGSystem, ExpressionDef, SkillDefinition interfaces
│   ├── dnd5e.ts              # Built-in D&D 5e system
│   ├── registry.ts           # Folder → system resolution + cache
│   └── parser.ts             # Parse system markdown files into RPGSystem
├── domains/
│   ├── inventory.ts          # Inventory parsing & logic
│   └── features.ts           # Features parsing & logic
├── components/
│   ├── inventory.tsx          # Inventory React component
│   └── features.tsx           # Features React component
├── views/
│   ├── InventoryView.tsx      # Inventory code block processor
│   └── FeaturesView.tsx       # Features code block processor
└── styles/components/
    ├── inventory.css
    └── features.css
```

## Modified Files

```
main.ts                        # Register new views, create system registry
settings.ts                    # Add systemAssignments field + settings UI
lib/types.ts                   # Frontmatter type becomes { type: string; [key: string]: any }
lib/domains/frontmatter.ts     # Type-driven parsing; remove hardcoded FrontMatterKeys and levelToProficiencyBonus
lib/domains/frontmatter.test.ts # Update tests for type-driven parsing
lib/views/BaseView.ts          # Accept system registry
lib/views/filecontext.ts       # Resolve system + entity type when building frontmatter
lib/views/AbilityScoreView.tsx # Use system.expressions instead of hardcoded modifier
lib/views/SkillsView.tsx       # Use system.skills instead of hardcoded list
lib/views/HealthView.tsx       # Can check frontmatter.type for conditional rendering
lib/views/BadgesView.tsx       # Template context uses typed frontmatter
lib/domains/abilities.ts       # calculateModifier delegates to system expression
lib/domains/skills.ts          # Skills array replaced by system.skills
lib/utils/template.ts          # modifier helper delegates to active system
```
