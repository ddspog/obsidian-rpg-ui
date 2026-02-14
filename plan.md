# Plan: Multi-System RPG Support + New Blocks

## Overview

Evolve the plugin from D&D 5e-only into a multi-system RPG toolkit. System rules are defined in **markdown files using code blocks** — the same pattern already used for character sheets. D&D 5e is the built-in default when no system is assigned.

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
| _(new)_        | `rpg map`         |
| _(new)_        | `rpg system`      | _(definition block — not rendered as UI)_ |
| _(new)_        | `rpg expression`  | _(definition block — not rendered as UI)_ |
| _(new)_        | `rpg skill-list`  | _(definition block — not rendered as UI)_ |

> **Note:** System definition blocks (`system`, `expression`, `skill-list`) define rules and formulas — they are parsed but not rendered as interactive UI. Character sheet blocks (`attributes`, `skills`, etc.) render interactive components. The naming avoids collision: `rpg skills` (character sheet) vs `rpg skill-list` (system definition). Attributes are defined inline in the `rpg system` block, so no separate `rpg attributes-list` block is needed.

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

The `extractMeta` function works as follows:
1. Calls `ctx.getSectionInfo(el)` to get the section's line range in the source document
2. Reads the opening fence line (e.g. `` ```rpg attributes ``) from `sectionInfo.text` using `sectionInfo.lineStart`
3. Strips the `rpg ` prefix to extract the meta identifier (e.g. `"attributes"`)

This approach is necessary because Obsidian's `registerMarkdownCodeBlockProcessor` only passes the **body** of the code block as `source` — the info string (text after the language name on the fence line) is not directly available. `getSectionInfo()` provides access to the raw markdown to recover it.

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

### Typed frontmatter (replaces hardcoded parsing)

Currently, frontmatter parsing is **untyped and D&D-hardcoded**: `frontmatter.ts` has a hardcoded alias map (`FrontMatterKeys`) for `proficiency_bonus` and `level`, a baked-in `levelToProficiencyBonus()` lookup, and a fixed `Frontmatter` type with `proficiency_bonus: number`.

The system definition solves this. Users declare what kind of entity a file represents via a `type` field in frontmatter:

```yaml
---
type: character  # or "monster", "item", custom types
level: 5
class: Wizard
---
```

The `types:` section in the `rpg system` block defines which frontmatter fields each type expects, with defaults, derived values, and aliases. The `Frontmatter` TypeScript type becomes dynamic:

```typescript
export type Frontmatter = {
  type: string;              // "character" | "monster" | "item" | custom
  [key: string]: any;        // All fields driven by type definition
};
```

**Parsing flow:** Read raw frontmatter → look for `type` (defaults to `"character"`) → look up type definition from active system → resolve each field (check aliases, evaluate `derived` formulas, apply `default`) → pass through extra keys as-is.

**Backwards compatibility:** Missing `type` defaults to `"character"`, no system defaults to built-in D&D 5e, existing aliases preserved via system definition.

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

### Template engine and expression registration

The plugin already uses a Handlebars-based template engine (`lib/utils/template.ts`) for dynamic content in YAML values (e.g. `"{{dex_mod}}"` in ability descriptions). System expressions extend this:

1. **Built-in helpers** (already exist): `floor`, `ceil`, `add`, `subtract`, `multiply`, `divide`, `if`
2. **Expression registration**: When a system is loaded, each `rpg expression` block is compiled into a Handlebars template and registered as a **named helper**. This means expressions can call other expressions — e.g. `saving_throw` can reference `modifier` because `modifier` is registered as a helper.
3. **Registration order**: Expressions are registered in document order. Forward references work because Handlebars resolves helpers at render time, not registration time.
4. **Expression scope**: Expressions from the active system are available in all template contexts (YAML values, `derived` frontmatter fields, ability descriptions, etc.)
5. **Return types**: Expressions can return `number`, `string`, or `boolean` — the formula result is coerced based on the context where it's used (e.g. a `derived` field with `type: number` coerces the result to a number)

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

## Part 3: Settings — Folder-to-System Assignment

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

  tilePacksFolder: string; // vault folder containing terrain tile assets (SVG/PNG)
  // default: "" (uses built-in SVG pattern fills)
}
```

---

## Part 4: Implementation — System Abstraction Layer

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
  evaluate: (context: Record<string, number | string | boolean>) => number | string | boolean;
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

Add a "Map Tiles" section in settings tab:
- **Tile Packs Folder** — vault folder containing terrain tile assets (SVG or PNG files organized in subfolders per pack)
- When empty (default), the renderer uses built-in SVG pattern fills (color-based: grass green, water blue, etc.)
- When set, the renderer loads tile images from `<tilePacksFolder>/<pack>/<terrain>.<ext>` (e.g. `Tiles/fantasy/forest.svg`)
- Pack name matches the `pack:` field in the `rpg map` YAML header
- Tile packs are organized by grid type, then by pack name:
  ```
  Tiles/              ← tilePacksFolder setting
  ├── hex/            ← hex grid tiles
  │   ├── fantasy/    ← pack name
  │   │   ├── grass.svg
  │   │   ├── forest.svg
  │   │   ├── forest-snowy.svg   ← variant: forest[snowy]
  │   │   ├── water.svg
  │   │   ├── mountain.svg
  │   │   └── mountain-rocky.svg ← variant: mountain[rocky]
  │   └── scifi/      ← another pack
  │       ├── metal.svg
  │       └── void.svg
  └── square/         ← square grid tiles
      └── dungeon/    ← pack name
          ├── stone.png
          ├── grass.png
          └── water.png
  ```
- **Square grid background images**: Square maps can also use a full `background:` image (e.g. a dungeon map scan) with the grid overlaid as a transparent layer. The legend's `color` becomes the fallback when no background is set.

---

## Part 5: New Block — Inventory

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

### Editing via UI

The inventory component supports **inline editing** that writes changes back to the code block in the markdown file:

- **Add item**: Button opens a form; on submit, appends a new item YAML entry to the section
- **Remove item**: Swipe or delete button removes the item's YAML entry from the code block
- **Update quantity**: +/- buttons modify the `quantity:` value in-place in the YAML
- **Use consumable**: Decrements quantity (removes item at 0)
- **Edit currency**: Inline editable currency values written back to the YAML

All edits use Obsidian's `vault.process()` API to atomically read-modify-write the code block content. The component re-renders from the updated YAML on each change — no separate state needed for item lists.

> **KV store vs code block**: Transient UI state (section collapse, scroll position) uses the KV store. Persistent game data (items, quantities, currency) lives in the code block YAML itself, so it's version-controllable and visible in plain text.

### Implementation
- **Domain** (`lib/domains/inventory.ts`): Parse YAML, weight calculation, consumable state, YAML serialization for write-back
- **Component** (`lib/components/inventory.tsx`): Collapsible sections, currency row, weight/encumbrance bar, consumable use buttons, add/remove/edit UI
- **View** (`lib/views/InventoryView.tsx`): Stateful (KV store for UI state like section collapse); uses `vault.process()` for code block edits
- **Styles** (`lib/styles/components/inventory.css`)
- Consumable items integrate with event system (reset_on rest events)
- Template support for computed values like carry capacity

---

## Part 6: New Block — Features

### Purpose
Track class features, racial traits, feats — with categories, level gating, prerequisite requirements, limited uses, and choices.

### YAML syntax

~~~markdown
```rpg features
state_key: wizard-features
class: "Wizard"
categories:
  - name: "Class Features"
    icon: "⚔️"
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
      - name: "Overchannel"
        level: 14
        requires:
          feature: "Potent Cantrip"
        description: "Deal max damage with a spell of 5th level or lower."

  - name: "Feats"
    icon: "🏅"
    features:
      - name: "War Caster"
        description: "Advantage on CON saves for concentration."
        requires:
          attribute: { constitution: 13 }
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

### Category system

Categories group related features visually (collapsible sections with optional icons). Each category can have:
- `name` — section heading
- `icon` — optional emoji or icon string displayed in the header
- `requires` — category-level gate (e.g. `level: 2` hides the whole section until level 2)
- `features` — list of features in this category
- `choices` — list of pick-N-from-M choice groups

### Requirement tracking

Features and categories support a `requires` block for prerequisite checks:

| Requirement | Example | Behavior |
|---|---|---|
| Level gate | `level: 6` | Hidden/dimmed until character reaches level 6 |
| Feature prerequisite | `feature: "Potent Cantrip"` | Dimmed until the named feature is available (i.e. its own level gate is met) |
| Attribute minimum | `attribute: { constitution: 13 }` | Dimmed until attribute score meets threshold |

Requirements are evaluated against frontmatter (level, attributes) and the feature list itself (feature prerequisites). Unmet requirements show the feature as dimmed with a tooltip explaining what's needed.

### Implementation
- **Domain** (`lib/domains/features.ts`): Parse YAML, category management, requirement evaluation (level, feature, attribute), choice management
- **Component** (`lib/components/features.tsx`): Collapsible categories with icons, level badges, requirement status indicators, limited-use tracking (reuses consumable pattern), choice picker
- **View** (`lib/views/FeaturesView.tsx`): Stateful (KV store for choices + limited-use counts), listens to `fm:changed` for level gating and attribute requirements
- **Styles** (`lib/styles/components/features.css`)
- Limited-use features reuse the existing consumable/reset infrastructure
- Template support in descriptions

---

## Part 7: New Block — Session Log (Lonelog)

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
- The HUD **appends** Lonelog text to the end of the block body when buttons are clicked (writes back to the markdown via `vault.process()`)
- Append-only design avoids conflicts: the HUD never modifies existing lines, only adds new ones at the end. Since Lonelog is sequential, appending is always safe — no concurrent edit conflicts can occur within a single block.
- The overview is computed by replaying all parsed deltas across all `rpg log` blocks in the file
- Optional: "Apply changes" button to persist deltas back to entity files at end of session

### Cross-file data access

The log block reads data from entity files (character sheets, monster stat blocks) listed in the `entities` header:
- Resolves `file:` paths to vault files (supports wiki-link syntax too)
- Reads frontmatter (type, attributes via typed frontmatter system)
- Reads code blocks (`rpg attributes`, `rpg inventory`, `rpg features`, `rpg healthpoints`) from those files
- The system registry determines how to interpret each file based on its folder assignment and frontmatter type
- Entity data is cached and refreshed on file change events
- **Cache invalidation**: The entity resolver listens to Obsidian's `vault.on('modify', ...)` event. When a referenced entity file changes, its cache entry is evicted and re-parsed on next access. The resolver also invalidates when the system registry detects a system file change (since that may alter how frontmatter fields are interpreted).

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

## Part 8: New Block — Battle Map (`rpg map`)

### Purpose

Render hex and square grid maps from a text-based syntax. Maps are **static renderings of state** — they don't support drag-and-drop, but show positions and can step through moves already made. Integrated with the session log to visualize combat scenes.

The hex syntax is ported from the **hex-map-editor** project (same author), adapted to fit the `rpg` block namespace.

### Hex-map-editor syntax (existing, to be ported)

The hex-map-editor uses a code block with three-layer rendering:

```
t(q,r): content   — terrain layer (ground: grass, water, forest, mountain)
s(q,r): content   — stack layer (structures: buildings, towers, monuments)
p(q,r): content   — path layer (roads, rivers, walls)
```

Coordinates are **axial (q, r)** for flat-top hex grids. Content follows the pattern:
```
type(q,r): (Label) terrain[variant] + #color
```

All parts optional:
- `(Label)` — text displayed on the hex
- `terrain` — terrain type name (e.g. `grass`, `forest`, `water`, `mountain`)
- `[variant]` — specific variant (e.g. `forest[snowy]`, `mountain[rocky]`)
- `+ #color` — color tint overlay

Height groups create topological layers:
```
0m:
  * t(0,0): grass
  * t(1,0): water
100m:
  * t(2,0): mountain[rocky]
```

### Syntax differences from Lonelog

The hex-map-editor syntax uses `[` brackets for variants (e.g. `forest[snowy]`), which could be confused with Lonelog's persistent element tags (e.g. `[N:Name]`). To avoid ambiguity:
- **Variants** always appear immediately after a terrain name with no space: `forest[snowy]`
- **Entity tokens** always start with `[PC:` or `[N:` — these prefixes never appear as terrain variant names
- The parser distinguishes them by context: variants follow terrain names, tokens appear at the end of a cell line or in the `tokens:` section

### Adapted syntax for `rpg map`

The `rpg map` block extends the hex-map-editor syntax with:
- Square grid support (`grid: square`)
- Entity token placement using Lonelog tags (`[PC:Name]`, `[N:Name]`) — supported on **both** hex and square grid cells
- Step-by-step move replay
- YAML header separated from map body by `---`

#### Hex grid example

~~~markdown
```rpg map
state_key: goblin-ambush-map
grid: hex
pack: svg
title: "The Goblin Ambush"
---
0m:
  * t(0,0): forest
  * t(1,0): grass
  * t(2,0): grass [PC:Elara]
  * t(0,1): grass
  * t(1,1): (Bridge) grass + #8a7a5a
  * t(2,1): grass [N:Goblin#1]
  * t(0,2): water
  * t(1,2): water
  * t(2,2): forest [N:Goblin Boss]

  * s(1,1): (Watchtower) stone + #654321
  * p(0,1): roads[clean]
  * p(1,1): roads[clean]
```
~~~

#### Square grid example

~~~markdown
```rpg map
state_key: dungeon-room-1
grid: square
size: 8x6
title: "Dungeon Entrance"
legend:
  "#": { terrain: stone, color: "#444" }
  ".": { terrain: grass, color: "#888" }
  D: { terrain: stone, color: "#a0522d" }
  ~: { terrain: water, color: "#2196F3" }
---
# # # # D # # #
# . . . . . . #
# . . . . . . #
# . . ~ ~ . . #
# . . . . . . #
# # # # # # # #

tokens:
  1,2 [PC:Elara]
  4,3 [N:Goblin Boss]
  5,4 [N:Goblin#1]
```
~~~

The hex grid uses the existing hex-map-editor syntax (axial coordinates, terrain/stack/path layers, packs, variants, height groups). The square grid uses a simpler character-based layout with a legend. Both grid types support entity tokens via either inline placement (appended to a cell line) or a dedicated `tokens:` section.

### Entity tokens on the map

Entities are placed using Lonelog tag syntax, either inline on a hex cell or in a `tokens:` section:
- `[PC:Name]` — player character token
- `[N:Name]` — NPC/monster token
- Tokens link to entity files (same resolution as session log)
- Clicking a token opens a tooltip with entity summary (HP, AC, conditions)

### Step-by-step replay

Maps can include a **moves** section for sequential state changes. The UI renders step controls to walk through:

~~~markdown
```rpg map
state_key: ambush-replay
grid: hex
pack: svg
---
0m:
  * t(0,0): forest
  * t(1,0): grass [PC:Elara]
  * t(2,0): grass [N:Goblin#1]
  * t(3,0): grass [PC:Thorne]

moves:
  - step: 1
    label: "Elara sneaks forward"
    move: [PC:Elara] (1,0) -> (2,0)
  - step: 2
    label: "Goblin spots Thorne"
    move: [N:Goblin#1] (2,0) -> (3,0)
    note: "@ Goblin attacks Thorne"
  - step: 3
    label: "Elara flanks"
    move: [PC:Elara] (2,0) -> (2,1)
    add: [N:Goblin#1|HP-8]
    note: "d: d20+7=19 vs AC 15 -> Hit, 8 slashing"
```
~~~

The UI shows:
- The map at its initial state
- Step controls: `|< < Step 2/3 > >|` (first, prev, current, next, last)
- Current step label and note displayed below the map
- Tokens animate (slide) between positions on step change
- State changes (damage, conditions) reflected in token tooltips

### Integration with session log

When a `rpg log` block references entities and includes combat, a `rpg map` block in the same file can visualize positions. The connection is implicit via shared entity tags — if `[PC:Elara]` appears in both the log and the map, they refer to the same entity.

Future: the HUD's quick-action buttons could auto-generate `moves:` entries in a linked map block.

### Rendering

- **SVG-based** — renders as inline SVG for crisp scaling (same approach as hex-map-editor)
- Hex cells: flat-top hexagons using axial coordinate → pixel position math
- Terrain: if a tile packs folder is configured in settings, loads SVG/PNG tile images from `<tilePacksFolder>/<pack>/<terrain>.<ext>`; otherwise falls back to built-in SVG pattern fills (color-based)
- Three-layer rendering: terrain (bottom) → stack (middle) → path (top), same z-ordering as hex-map-editor
- Height groups: higher altitude renders on top
- Square cells: `<rect>` elements with character-based layout
- Entity tokens: labeled circles/icons overlaid on cells
- CSS variables for theming (uses the plugin's existing color system)
- Responsive — scales to container width

### What to port from hex-map-editor

| Component | Source | Action |
|---|---|---|
| Parser | `src/lib/hexmap-parser.ts` | Port to `lib/domains/battlemap/hex-parser.ts`, adapt for `rpg map` header |
| Types | `src/lib/types.ts` | Port `HexCell`, `HexMap`, `ParsedContent` interfaces |
| Hex geometry | `src/components/HexGrid.tsx` | Extract coordinate math into `hex-grid.ts`, port SVG renderer to React component |
| Terrain loader | `src/lib/terrain-loader.ts` | Adapt — load tiles from vault's tile packs folder (configured in settings); fall back to built-in SVG pattern fills when no folder is set |
| Pack config | `src/lib/pack-config.ts` | Port display config (zoom, offset) for terrain types |
| Fallback patterns | `HexGrid.tsx` fallbacks | Port SVG pattern defs for water, forest, mountain, grass, etc. |

### What NOT to port
- External WebP/PNG image assets (too heavy for an Obsidian plugin — use SVG patterns and color fills)
- The editor UI (TextEditor, tabs) — the code block IS the editor
- Vite-specific asset loading (`import.meta.glob`) — assets will be embedded

### Implementation

- **Domain** (`lib/domains/battlemap/`):
  - `hex-parser.ts` — Ported hex-map-editor parser, adapted for `rpg map` header + entity tokens
  - `hex-parser.test.ts` — Parser tests
  - `square-parser.ts` — New parser for character-based square grid layout
  - `hex-grid.ts` — Hex coordinate math (axial → pixel, neighbors), ported from HexGrid.tsx
  - `square-grid.ts` — Square coordinate math
  - `replay.ts` — Step-through state machine for moves section
  - `terrain-loader.ts` — Loads tile images from vault's tile packs folder; falls back to embedded SVG patterns
- **Component** (`lib/components/battlemap/`):
  - `hex-renderer.tsx` — SVG hex grid renderer (ported from HexGrid.tsx)
  - `square-renderer.tsx` — SVG square grid renderer
  - `token.tsx` — Entity token overlay with tooltip
  - `step-controls.tsx` — Replay step slider/buttons
  - `legend.tsx` — Map legend display
- **View** (`lib/views/BattleMapView.tsx`): Stateful (current replay step in KV store)
- **Styles** (`lib/styles/components/battlemap.css`)

### Key features
- **Text-based maps** — define maps in plain text, version-controllable, readable without the plugin
- **Hex-map-editor syntax** — ported from existing project, proven syntax with terrain/stack/path layers
- **Hex and square grids** — two grid types covering most TTRPG needs
- **Height groups** — topological layering for elevation
- **Terrain variants** — `forest[snowy]`, `mountain[rocky]`, seeded randomization for consistency
- **Step-by-step replay** — walk through combat moves with a slider
- **Entity integration** — tokens use the same `[PC:]`/`[N:]` tags as Lonelog
- **SVG rendering** — crisp at any zoom, themeable via CSS variables
- **Static by design** — shows what happened, not a live VTT; complements the session log

---

## Part 9: Phased Delivery

### Phase 1 — Unified `rpg` namespace
1. Migrate all existing views to unified `rpg` code block processor with meta dispatch
2. Update `codeblock-extractor.ts` to match `rpg <meta>` patterns

Delivers unified namespace with no breaking changes to logic. All existing blocks work under `rpg <meta>`.

### Phase 2 — System abstraction + new blocks
3. Define `RPGSystem` interface
4. Create built-in D&D 5e system (extract from domains)
5. Create system registry
6. Thread system into existing views (refactor `AbilityScoreView`, `SkillsView`, domains)
7. Add `system`, `expression`, `skill-list` meta handlers (read-only, they define rules not render UI)
8. Implement Inventory block (domain, component, view, styles)
9. Implement Features block (domain, component, view, styles)

All existing character sheets continue working — D&D 5e is the default. Inventory and features are built on top of the system abstraction so they can use typed frontmatter and expressions from the start.

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

The log block depends on inventory, features, and system abstraction being in place first — it reads entity data across files through those layers. The Lonelog parser itself (steps 13–14) has no dependencies and can be developed in parallel with Phase 2/3.

### Phase 5 — Battle Maps
20. Port hex-map-editor parser (`hexmap-parser.ts`) → `lib/domains/battlemap/hex-parser.ts`, extend with `rpg map` YAML header + entity token parsing
21. Port hex geometry from `HexGrid.tsx` → `hex-grid.ts` (axial → pixel, flat-top layout, z-ordering)
22. Create terrain loader (`terrain-loader.ts`) — loads tiles from vault's tile packs folder (per settings), falls back to embedded SVG patterns
23. Port SVG hex renderer from `HexGrid.tsx` → `hex-renderer.tsx` (three-layer terrain/stack/path rendering)
24. Implement square grid parser + renderer (new, character-based layout with legend)
25. Implement step-by-step replay (moves parser, state machine, step controls)
26. Wire entity tokens to entity resolver (shared `[PC:]`/`[N:]` tags with Lonelog)

The hex parser/renderer port (steps 20–23) has no dependencies and can be built in parallel with Phase 4. Step 26 requires the entity resolver from Phase 4.

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
├── domains/battlemap/
│   ├── hex-parser.ts          # Ported hex-map-editor parser + entity tokens
│   ├── hex-parser.test.ts     # Hex parser tests
│   ├── square-parser.ts       # Character-based square grid parser
│   ├── hex-grid.ts            # Hex coordinate math (axial → pixel, neighbors)
│   ├── square-grid.ts         # Square coordinate math
│   ├── replay.ts              # Step-through state machine for moves
│   └── terrain-loader.ts      # Loads tiles from vault folder; built-in SVG pattern fallbacks
├── components/battlemap/
│   ├── hex-renderer.tsx        # SVG hex grid renderer (ported from HexGrid.tsx)
│   ├── square-renderer.tsx     # SVG square grid renderer
│   ├── token.tsx               # Entity token overlay with tooltip
│   ├── step-controls.tsx       # Replay step slider/buttons
│   └── legend.tsx              # Map legend display
├── views/
│   ├── InventoryView.tsx      # Inventory code block processor
│   ├── FeaturesView.tsx       # Features code block processor
│   ├── SessionLogView.tsx     # Session log code block processor
│   └── BattleMapView.tsx      # Battle map code block processor
└── styles/components/
    ├── inventory.css
    ├── features.css
    ├── session-log.css
    └── battlemap.css
```

## Modified Files

```
main.ts                        # Single "rpg" processor with meta dispatch, create system registry
settings.ts                    # Add systemAssignments + tilePacksFolder fields + settings UI
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
