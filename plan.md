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
\`\`\`rpg system
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

## Part 1: Unified `rpg` Code Block Namespace

### Current state

Each view registers its own code block language: `ability`, `skills`, `healthpoints`, `stats`, `badges`, `consumable`, `initiative`, `spell-components`, `event-buttons`. These are all top-level names in Obsidian's code block processor registry.

### New pattern: `rpg <meta>`

All blocks move under a single `rpg` language with a **meta attribute** after the language name:

~~~
```rpg attributes
strength: 10
dexterity: 12
```

```rpg skills
proficiencies:
  - Stealth
  - Perception
```

```rpg healthpoints
state_key: wizard-hp
health: "{{add 6 (multiply (subtract level 1) 4) (multiply constitution (modifier constitution))}}"
```

```rpg system
name: "D&D 5e"
```
~~~

### Block type mapping (old → new)

| Old            | New meta          |
|----------------|-------------------|
| `ability`      | `rpg attributes`  |
| `skills`       | `rpg skills`      |
| `healthpoints` | `rpg healthpoints`|
| `stats`        | `rpg stats`       |
| `badges`       | `rpg badges`      |
| `consumable`   | `rpg consumable`  |
| `initiative`   | `rpg initiative`  |
| `spell-components` | `rpg spell`   |
| `event-buttons`| `rpg events`      |
| _(new)_        | `rpg inventory`   |
| _(new)_        | `rpg features`    |
| _(new)_        | `rpg log`         |
| _(new)_        | `rpg system`      |
| _(new)_        | `rpg expression`  |
| _(new)_        | `rpg skill-list`  |

### Registration approach

Register a **single code block processor** for `"rpg"`. Obsidian passes the full info string to the processor — the text after the triple backticks. The processor:

1. Extracts the meta (first word after `rpg` in the info string, available via `ctx.getSectionInfo()`)
2. Dispatches to the corresponding view's `render()` method
3. If the meta is unknown, renders an error message

```typescript
// main.ts — single registration
this.registerMarkdownCodeBlockProcessor("rpg", (source, el, ctx) => {
  const meta = extractMeta(ctx, el);  // e.g. "attributes", "skills", "system"
  const view = viewRegistry.get(meta);
  if (view) {
    view.register(source, el, ctx);
  } else {
    el.innerHTML = `<div class="notice">Unknown rpg block type: ${meta}</div>`;
  }
});
```

The `extractMeta` function reads the full info string from the source document via `ctx.getSectionInfo()` and parses out the meta attribute after `rpg `.

### Impact on `codeblock-extractor.ts`

The `extractCodeBlocks(text, blockType)` function currently matches `` ```ability ``, `` ```skills ``, etc. It needs to match `` ```rpg attributes ``, `` ```rpg skills ``, etc. instead. The regex changes from matching a bare block type to matching `rpg <blockType>`.

### BaseView changes

The `codeblock` property on each view changes from the language name to just the **meta identifier**:

```typescript
// Before
class AbilityScoreView extends BaseView {
  public codeblock = "ability";
}

// After
class AbilityScoreView extends BaseView {
  public codeblock = "attributes";  // meta, not the language
}
```

Views are collected into a `Map<string, BaseView>` keyed by meta, and the single `rpg` processor dispatches to them.

---

## Part 2: How System Definitions Work

### The system markdown file

A system is a regular Obsidian markdown file (e.g. `Systems/DnD 5e.md`) containing `rpg` code blocks that define the rules. The entry point is a `rpg system` block:

```markdown
# D&D 5e System

This file defines the D&D 5th Edition rules for the RPG UI Toolkit.

\`\`\`rpg system
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

\`\`\`rpg expression
id: modifier
description: "Calculate ability modifier from score"
params:
  - score
formula: "{{floor (divide (subtract score 10) 2)}}"
\`\`\`

## Saving Throw Calculation

\`\`\`rpg expression
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

\`\`\`rpg expression
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

\`\`\`rpg skill-list
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
- Every block uses the unified `rpg <meta>` syntax — system definitions and character sheets share the same namespace
- Each code block is self-contained and identified by its `id`
- The `rpg system` block is the entry point that declares attributes, types, and frontmatter fields
- `rpg expression` blocks define named formulas the plugin evaluates at runtime
- `rpg skill-list` blocks define the skills available in the system
- The existing Handlebars template engine (with `floor`, `ceil`, `add`, `subtract`, `multiply`, `divide` helpers) already supports these formulas

### For a different system (e.g. Fate):

```markdown
# Fate Core System

\`\`\`rpg system
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

\`\`\`rpg expression
id: modifier
params:
  - score
formula: "{{score}}"
\`\`\`
```

No `rpg skill-list` block → no skills panel rendered. Different attributes → the ability view adapts. Different modifier formula → calculations change.

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

Reads a markdown file from the vault, extracts `rpg` code blocks:
1. Find `rpg system` block → parse attributes, types, frontmatter field definitions
2. Find all `rpg expression` blocks → compile formulas via Handlebars into `evaluate` functions
3. Find `rpg skill-list` block → parse skill definitions
4. Return an `RPGSystem` object

Uses the updated `extractCodeBlocks` utility (now matches `rpg <meta>` patterns).

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
```rpg inventory
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
```rpg features
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

## Part 6: New Block — Session Log (Lonelog)

### Purpose

A session play tracker that uses **Lonelog notation** (CC BY-SA 4.0, by Roberto Bisceglie) as the content syntax inside `rpg log` blocks. The plugin parses Lonelog's structured shorthand, renders it as a rich interactive UI, and tracks state changes across entities.

Multiple `rpg log` blocks can appear in a single file (one per scene or session segment).

### Lonelog — the notation system

Lonelog is a lightweight notation for solo RPG session logging. It separates mechanics from fiction using five core symbols:

| Symbol | Meaning | Example |
|--------|---------|---------|
| `@` | Player action | `@ Pick the lock` |
| `?` | Oracle question | `? Is anyone inside?` |
| `d:` | Mechanics roll | `d: d20+5=17 vs DC 15 -> Success` |
| `->` | Resolution (dice or oracle) | `-> Yes, but... (d6=3)` |
| `=>` | Consequence | `=> The door creaks open` |

Plus persistent element tags: `[N:Name|tags]` (NPC), `[L:Location|tags]`, `[E:Event X/Y]`, `[Thread:Name|State]`, `[PC:Name|stats]`, and progress trackers: `[Clock:X/Y]`, `[Track:X/Y]`, `[Timer:X]`.

The full Lonelog spec (v1.0.0) is the authoritative reference. The plugin implements a parser for this notation.

### Block structure

The `rpg log` block has two parts: a **YAML header** (metadata) and a **Lonelog body** (the session content). The header is separated from the body by `---`:

~~~markdown
```rpg log
state_key: session-2024-03-15-scene-1
scene: "The Goblin Ambush"
entities:
  - file: "Characters/Elara.md"
    type: character
  - file: "Characters/Thorne.md"
    type: character
  - file: "NPCs/Goblin Boss.md"
    type: monster
  - file: "NPCs/Goblin.md"
    type: monster
    count: 3
---
S1 *Dark forest clearing, dusk*
@ Elara sneaks toward the goblin camp
d: Stealth d20+5=18 vs DC 14 -> Success
=> She slips between the trees unnoticed. [N:Goblin Lookout|distracted]

? Does the lookout have allies nearby?
-> Yes, but... (d6=4)
=> Two more goblins, but they're arguing. [N:Goblin#2|armed] [N:Goblin#3|armed]

@ Thorne charges in
d: Athletics d20+3=12 vs DC 10 -> Success
=> He crashes through the underbrush, drawing their attention

@ Elara attacks Goblin Lookout
d: d20+7=19 vs AC 15 -> Hit
d: 1d8+4=9 slashing damage
=> [N:Goblin Lookout|HP-9|dead]

? Do the other goblins flee?
-> No, and... (d6=2)
=> They rage and call for the boss. [N:Goblin Boss|hostile|emerging]
[Clock:Reinforcements 1/4]
```
~~~

### What the plugin does with Lonelog

The plugin **parses** the Lonelog body and renders it as structured UI. Each line type gets visual treatment:

| Lonelog line | Rendered as |
|---|---|
| `S1 *Location*` | Scene header with location context |
| `@ Action` | Action card with actor highlight |
| `d: roll -> result` | Dice result badge (color-coded success/fail) |
| `-> Oracle answer` | Oracle answer chip |
| `=> Consequence` | Consequence block (indented, connected to action) |
| `? Question` | Oracle question (italicized) |
| `[N:Name\|tags]` | NPC tag pill (clickable → opens linked file if exists) |
| `[L:Location\|tags]` | Location tag pill |
| `[E:Event X/Y]` / `[Clock:X/Y]` | Progress bar inline |
| `[Track:X/Y]` | Progress track inline |
| `[Timer:X]` | Countdown badge |
| `[Thread:Name\|State]` | Thread pill (Open=green, Closed=gray) |
| `[PC:Name\|stats]` | PC stat changes highlight |
| `N (Name): "..."` | Dialogue bubble |
| `tbl:` / `gen:` | Table/generator result card |
| `(note: ...)` | Meta note (dimmed, italic) |
| Prose between notation | Narrative block (regular text) |

### HUD behavior

The HUD renders at the top of each log block and provides:

1. **Entity selector** — tabs or dropdown to pick the active entity (from the `entities` header list)
2. **Entity summary** — for the selected entity, shows at a glance:
   - HP bar (current / max, reflecting deltas from `[PC:HP-2]` or damage events)
   - AC
   - Equipped items (from `rpg inventory` block in linked file)
   - Available actions / consumables / spell slots
   - Active conditions (from tags like `[N:Name|wounded]`)
3. **Quick-action buttons** — clicking these appends Lonelog notation to the body:
   - **Action** (`@`) — prompts for description, appends `@ [Entity] [action]`
   - **Roll** (`d:`) — dice roller UI, appends `d: [roll] -> [result]`
   - **Oracle** (`?` / `->`) — question input + oracle roller, appends `? [question]` + `-> [answer]`
   - **Damage/Heal** — target picker + amount, appends `=> [PC:HP-X]` or `=> [N:Name|HP-X]`
   - **Use Item** — from inventory, appends `=> [Entity] uses [Item]`
   - **Note** — free text, appends `=> [text]` or `(note: [text])`
4. **Initiative tracker** — when combat starts, shows turn order; advances via button

The HUD reads entity data by resolving linked files through the system registry.

### Lonelog parser

The parser (`lib/domains/lonelog/parser.ts`) tokenizes each line of the Lonelog body into structured events:

```typescript
type LonelogEntry =
  | { type: "scene"; number: string; context: string }
  | { type: "action"; text: string }
  | { type: "roll"; roll: string; result: string; success?: boolean }
  | { type: "oracle_question"; text: string }
  | { type: "oracle_answer"; text: string; roll?: string }
  | { type: "consequence"; text: string; tags: PersistentTag[] }
  | { type: "dialogue"; speaker: string; text: string }
  | { type: "table_roll"; source: string; roll: string; result: string }
  | { type: "generator"; source: string; result: string }
  | { type: "meta_note"; text: string }
  | { type: "narrative"; text: string };

type PersistentTag =
  | { kind: "npc"; name: string; tags: string[]; ref: boolean }
  | { kind: "location"; name: string; tags: string[] }
  | { kind: "event"; name: string; current: number; max: number }
  | { kind: "clock"; name: string; current: number; max: number }
  | { kind: "track"; name: string; current: number; max: number }
  | { kind: "timer"; name: string; value: number }
  | { kind: "thread"; name: string; state: string }
  | { kind: "pc"; name: string; changes: string[] };
```

The parser handles:
- Core symbols (`@`, `?`, `d:`, `->`, `=>`)
- Inline tags (`[N:...]`, `[L:...]`, `[E:...]`, `[Clock:...]`, `[Track:...]`, `[Timer:...]`, `[Thread:...]`, `[PC:...]`)
- Reference tags (`[#N:Name]`)
- Scene markers (`S1`, `S1a`, `T1-S1`, `S1.1`)
- Dialogue (`N (Name): "..."`, `PC: "..."`)
- Table/generator results (`tbl:`, `gen:`)
- Meta notes (`(note: ...)`)
- Comparison shorthand (`5>=4 S`, `2<=4 F`)
- Narrative prose (anything that doesn't match a symbol)

### State tracking from Lonelog

The parser extracts **state mutations** from tags embedded in consequence lines:

| Tag pattern | Mutation |
|---|---|
| `[PC:Alex\|HP-2]` | Alex loses 2 HP |
| `[PC:Alex\|HP+3\|Stress-1]` | Alex gains 3 HP, loses 1 Stress |
| `[N:Goblin\|dead]` | Goblin marked as dead |
| `[N:Guard\|alert→unconscious]` | Guard status change |
| `[N:Guard\|+captured]` | Add tag |
| `[N:Guard\|-wounded]` | Remove tag |
| `[E:AlertClock 2/6]` | Clock progress update |
| `[Clock:Ritual 5/12]` | Clock at 5 of 12 |
| `[Track:Escape 3/8]` | Track at 3 of 8 |
| `[Timer:Dawn 3]` | Timer at 3 |
| `[Thread:Find Sister\|Closed]` | Thread resolved |

These mutations are accumulated as deltas per entity, per scene.

### Change overview (end of file)

After the last `rpg log` block in a file, the plugin automatically renders a **change summary** by replaying all deltas across all log blocks:

```
Session Overview
════════════════
PC: Elara       HP 45 → 37 (-8)  |  Used: Potion of Healing, Fireball (3rd)
PC: Thorne      HP 52 → 52 (—)   |  Gained: Goblin Boss's Key
NPC: Goblin Boss  HP 30 → 0 (dead)
NPC: Goblin #1-3  all dead

Threads: [Find Sister: Open → Closed]
Clocks:  [AlertClock: 0/6 → 4/6]
Items:   +Goblin Boss's Key, +45 gold, -Potion of Healing ×1
Slots:   Elara 3rd level (2 → 1)
```

### Scene numbering support

The plugin understands Lonelog's scene numbering variants:
- **Sequential**: `S1`, `S2`, `S3` — standard linear play
- **Flashbacks**: `S5a`, `S5b` — branching from a scene
- **Parallel threads**: `T1-S1`, `T2-S1` — simultaneous storylines
- **Montages**: `S7.1`, `S7.2`, `S7.3` — time-lapse sequences

Each scene variant is rendered with appropriate visual treatment (flashback = dimmed/italic, parallel = thread-colored sidebar, montage = compact/condensed).

### State management

- **Per-block state** stored in KV store via `state_key`
- The Lonelog body text is the source of truth — events are parsed from it
- State deltas are computed by parsing tags, not stored separately
- The HUD **appends** Lonelog text to the block when buttons are clicked (writes back to the markdown)
- The overview is computed by replaying all parsed deltas across all `rpg log` blocks in the file
- Optional: "Apply changes" button to persist deltas back to entity files at end of session

### Cross-file data access

The log block reads data from entity files (character sheets, monster stat blocks) listed in the `entities` header:
- Resolves `file:` paths to vault files (supports wiki-link syntax too)
- Reads frontmatter (type, attributes via typed frontmatter system)
- Reads code blocks (`rpg attributes`, `rpg inventory`, `rpg features`, `rpg healthpoints`) from those files
- The system registry determines how to interpret each file based on its folder assignment and frontmatter type
- Entity data is cached and refreshed on file change events

### Implementation

- **Parser** (`lib/domains/lonelog/parser.ts`): Tokenizes Lonelog notation into `LonelogEntry[]`
- **Parser tests** (`lib/domains/lonelog/parser.test.ts`): Comprehensive tests for all Lonelog syntax
- **Delta tracker** (`lib/domains/lonelog/deltas.ts`): Extracts state mutations from parsed tags, accumulates per entity
- **Domain** (`lib/domains/session-log.ts`): Orchestrates parsing, delta accumulation, scene management
- **Component** (`lib/components/session-log/`): Folder with sub-components:
  - `hud.tsx` — Entity selector + summary panel + quick-action buttons
  - `event-list.tsx` — Renders parsed `LonelogEntry[]` as styled cards
  - `change-overview.tsx` — End-of-file delta summary
  - `entity-summary.tsx` — Per-entity HP/AC/equipment/actions display
  - `scene-header.tsx` — Scene marker rendering with variant styles
  - `tag-pill.tsx` — Inline tag rendering (NPC, Location, Clock, etc.)
- **View** (`lib/views/SessionLogView.tsx`): Stateful, reads cross-file data, manages HUD interactions that append Lonelog text, renders parsed log
- **Styles** (`lib/styles/components/session-log.css`)
- **Service** (`lib/services/entity-resolver.ts`): Reads and caches entity data from linked vault files

### Key features
- **Lonelog as source of truth** — the notation IS the data; no separate state for events
- **HUD writes Lonelog** — clicking buttons appends proper Lonelog notation to the markdown
- **Round-trip fidelity** — parse → render → edit → re-parse, nothing lost
- **Append-only** — never lose session history
- **Cross-file entity resolution** — pulls live character/monster data from linked files
- **Non-destructive deltas** — state changes tracked from tags but not applied to entity files until confirmed
- **Multi-scene support** — sequential, flashbacks, parallel threads, montages
- **Works with any system** — entity resolution uses system registry and typed frontmatter
- **Works analog too** — Lonelog is readable as plain text if the plugin is absent

---

## Part 7: Phased Delivery

### Phase 1 — Unified `rpg` namespace + new blocks
1. Migrate all existing views to unified `rpg` code block processor with meta dispatch
2. Update `codeblock-extractor.ts` to match `rpg <meta>` patterns
3. Implement Inventory block (domain, component, view, styles)
4. Implement Features block (domain, component, view, styles)

Delivers unified namespace + new user value immediately, D&D-only, no breaking changes to logic.

### Phase 2 — System abstraction
5. Define `RPGSystem` interface
6. Create built-in D&D 5e system (extract from domains)
7. Create system registry
8. Thread system into existing views (refactor `AbilityScoreView`, `SkillsView`, domains)
9. Add `system`, `expression`, `skill-list` meta handlers (read-only, they define rules not render UI)

All existing character sheets continue working — D&D 5e is the default.

### Phase 3 — User-defined systems
10. Implement system markdown parser (reads `rpg system`, `rpg expression`, `rpg skill-list` blocks from vault files)
11. Add folder-to-system settings UI
12. Wire registry to resolve system per file path

### Phase 4 — Session Log (Lonelog)
13. Implement Lonelog parser (`lonelog/parser.ts`) with comprehensive tests
14. Implement delta tracker (`lonelog/deltas.ts`) — extract state mutations from parsed tags
15. Build entity resolver service (cross-file data reading + cache)
16. Implement event-list component (renders `LonelogEntry[]` as styled cards with tag pills, scene headers)
17. Implement HUD component (entity selector, summary, quick-action buttons that append Lonelog text)
18. Implement change overview component (end-of-file delta summary)
19. Wire SessionLogView with KV store, entity resolver, event bus, and Lonelog parser

The log block depends on inventory, features, and system abstraction being in place first — it reads entity data across files through those layers. The Lonelog parser itself (steps 13-14) has no dependencies and can be developed in parallel with Phase 2/3.

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
│   ├── features.ts           # Features parsing & logic
│   ├── session-log.ts        # Orchestrates parsing, delta accumulation, scene management
│   └── lonelog/
│       ├── parser.ts         # Lonelog notation tokenizer → LonelogEntry[]
│       ├── parser.test.ts    # Parser tests for all Lonelog syntax
│       └── deltas.ts         # Extract state mutations from parsed tags
├── services/
│   └── entity-resolver.ts    # Cross-file entity data reading + cache
├── components/
│   ├── inventory.tsx          # Inventory React component
│   ├── features.tsx           # Features React component
│   └── session-log/           # Session log sub-components
│       ├── hud.tsx            # Entity selector + summary + quick actions
│       ├── event-list.tsx     # Renders parsed LonelogEntry[] as styled cards
│       ├── change-overview.tsx # End-of-file delta summary
│       ├── entity-summary.tsx # Per-entity HP/AC/equipment display
│       ├── scene-header.tsx   # Scene marker with variant styles
│       └── tag-pill.tsx       # Inline tag rendering (NPC, Location, etc.)
├── views/
│   ├── InventoryView.tsx      # Inventory code block processor
│   ├── FeaturesView.tsx       # Features code block processor
│   └── SessionLogView.tsx     # Session log code block processor
└── styles/components/
    ├── inventory.css
    ├── features.css
    └── session-log.css
```

## Modified Files

```
main.ts                        # Single "rpg" processor with meta dispatch, create system registry
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
lib/utils/codeblock-extractor.ts  # Match "rpg <meta>" patterns instead of bare block types
lib/utils/codeblock-extractor.test.ts # Update tests for new patterns
```
