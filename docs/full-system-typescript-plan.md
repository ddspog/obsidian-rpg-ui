## Plan: Extensible System Typing with Entity Blocks & Markdown-based Content

This plan improves `CreateSystem` and entity typing to support multi-entity (character, class, spell, feature, statblock) markdown-based authoring with typed React component blocks, configurable resources, and a JSON export representing the fully-compiled system.

---

## Context

The plugin already supports:
- TypeScript-based system definitions via `CreateSystem` / `CreateEntity` factories
- Unified `rpg <meta>` code block processor dispatching to view components
- System registry with folder-based system resolution
- Features, spellcasting, traits, conditions in system config types

---

## Goals

### Entity Types
Support as first-class entities:
- **character** — multi-class header, features, spells, resources, XP/spell progression
- **class** — markdown page authored as a feature-provider; class-level surfaces are rendered by the general `character.features` collector rather than a dedicated `class.features` block
- **spell** — markdown page describing a spell; rendered inside the character's `spells` collector, no per-spell info/effects split
- **feature** — markdown page authored with feature blocks (`feature.details`, `feature.choice`, `feature.unlock`, `feature.level`); aspects are inlined on the feature rather than carried by a standalone block
- **statblock** — four blocks: header, traits, attributes, features

### System Features
- **Blocks as typed React components**: Defined as `blocks: Record<string, React.FC<Props>>` with YAML → props mapping
- **Aspects** (renamed from sub-features): `{type: 'action'|'bonus'|'passive', ...}` authored inline on a feature
- **Traits**: Proficiencies, languages, expertise produced by features (entity-dependent, not system defaults)
- **Choices**: Stored in entity block YAML (features, spells)
- **Resources**: Modeled via entity blocks (health, slots, etc.) with no special distinction
- **Progression tables**: `xpTable: number[]`, `spellcastTable: number[][]` in character entity
- **Caster types**: System-level conversion functions (full/half/third)
- **JSON export**: Compiled system with entity configs and component references

---

## Implementation Phases

### Phase 1: Type System & Core Infrastructure

**Goal**: Establish type system for entity blocks, progression tables, and caster types.

**Tasks**:

1. **Extend `SystemConfig` in [lib/systems/api.d.ts](lib/systems/api.d.ts#L1-L330)**  
   - Add `casterTypes?: Record<string, CasterTypeDefinition>`:
     ```ts
     interface CasterTypeDefinition {
       name: string;
       levelConversion: (characterLevel: number) => number;
     }
     ```

2. **Extend `EntityConfig` in [lib/systems/api.d.ts](lib/systems/api.d.ts#L1-L330)**  
   - Add progression table fields:
     - `xpTable?: number[]` — XP thresholds indexed by level - 1
     - `spellcastTable?: number[][]` — spell slot arrays per level
       - Example: `[[2], [3], [4, 2]]` = level 1: 2×1st, level 2: 3×1st, level 3: 4×1st + 2×2nd

3. **Update terminology: subfeatures → aspects**  
   - Search/replace "subfeatures" with "aspects" in all type definitions and documentation

4. **Update `CreateSystem` normalization in [lib/systems/create-system.ts](lib/systems/create-system.ts#L1-L265)**  
   - Parse `casterTypes` from system config
   - Parse `xpTable`, `spellcastTable` from entity configs
   - Store in `RPGSystem` internal type ([lib/systems/types.ts](lib/systems/types.ts#L1-L282))
   - Validate entity blocks: ensure `component` is function, props schema is well-formed

**Verification**:
- Run `npm run typecheck` — no errors
- Run `npm run test` — all pass

---

### Phase 2: UI Components & Export

**Goal**: Ship the entity block components the system definitions will wire up in Phase 4 and export them from the toolkit.

**Tasks**:

1. **Entity block components** (under `lib/ui/`):
   - Character surface: header, health, features collector, spells collector, and any additional character-scoped blocks the character sheet needs.
   - Statblock surface: header, traits, attributes, features.
   - Each block authored as a typed React component with YAML → props mapping.

2. **Toolkit exports** — expose the entity block components (alongside `CreateSystem` / `CreateEntity`) from [lib/systems/api.d.ts](lib/systems/api.d.ts#L1-L330) so system definitions can import them by name.

> Earlier drafts scoped separate `class.features`, `spell.info` / `spell.effects`, and `feature.*` block components; those were dropped in Phase 4 in favor of the general `character.features` collector, the `spells` collector, and inlined feature aspects. See Phase 4 for the final surface.

**Verification**:
- Import components in test file: `import { CharacterHeaderBlock } from "rpg-ui-toolkit"`
- Run `npm run build` — no errors

---

### Phase 3: Runtime Block Registration

**Goal**: Register entity blocks dynamically at runtime based on system config.

**Tasks**:

1. **Register entity blocks in [main.ts](main.ts#L92-L109)**  
   - After system loads, introspect `system.entities[entityType].blocks`
   - For each block, register: `rpg <entityType>.<blockName>`
   - Pass parsed YAML + entity/system context:
     ```ts
     this.registerMarkdownCodeBlockProcessor(`rpg character.header`, (source, el, ctx) => {
       const system = registry.getSystemForFile(ctx.sourcePath);
       const blockDef = system.entities.character.blocks.header;
       const props = parseYAML(source);
       const entityData = entityResolver.resolveEntity({ file: ctx.sourcePath });
       // Render: blockDef.component({ ...props, entity: entityData, system })
     });
     ```

2. **Update [EntityResolver](lib/services/entity-resolver.ts#L1-L122)**  
   - Replace hardcoded `blockTypes` with system introspection:
     ```ts
     const system = systemRegistry.getSystemForFile(filePath);
     const entityType = determineEntityType(frontmatter, filePath);
     const blockTypes = Object.keys(system.entities[entityType]?.blocks || {})
       .map(b => `${entityType}.${b}`);
     ```

**Verification**:
- Create test note with `rpg character.header` block
- Verify block renders with placeholder UI
- Check console for no registration errors

---

### Phase 4: Example System Definition

**Goal**: Wire the entity block components into the Tales of the Valiant system definition and add sample vault pages that exercise them.

**Scope decisions** (narrowed from earlier drafts):
- **No `class.features` block** — class-scoped features surface through the general `character.features` collector.
- **No `spell.info` / `spell.effects` split** — spells are authored as plain pages and rendered inside the character's `spells` collector.
- **No `feature.feature` / `feature.aspects` blocks** — the `feature.*` surface is built from `details` / `choice` / `unlock` / `level`, with aspects inlined on the feature itself.
- **`statblock.*` blocks still in scope** — `header`, `traits`, `attributes`, `features` are wired in this phase.

**Tasks**:

1. **Wire character blocks into the system definition**
   - `character` entity registers the full block surface (header, health, features, spells, and any other character blocks the system author wants to expose).
   - `casterTypes` (full / half / third) live at system level.
   - `xpTable` / `spellcastTable` live on the character entity.

2. **Wire statblock blocks**
   - `statblock` entity registers `{ header, traits, attributes, features }`.

3. **Create sample markdown pages** in vault:
   - Character page exercising the character blocks (multi-class YAML, XP, spells).
   - Statblock page exercising all four `statblock.*` blocks.
   - Supporting class / spell / feature pages as plain authored content (no dedicated code blocks required).

**Verification**:
- Open each sample page in Obsidian; blocks render without errors.
- Character header shows total level from multi-class.
- XP milestone display uses `xpTable`.
- All four statblock blocks render from a single sample page.

---

### Phase 5: Enhanced Functionality

**Goal**: Implement multi-class logic, JSON export, and documentation.

**Tasks**:

1. **Enhance `CharacterHeaderBlock`**  
   - Parse `classes: [{ name, level }]` from YAML
   - Compute total level via sum
   - Display XP milestone from `entity.xpTable[totalLevel - 1]`
   - Show spell slots from `entity.spellcastTable[spellcastLevel - 1]` with caster type conversion

2. **Add JSON export utility**  
   - Create `exportSystemJSON(system: RPGSystem): object` in [lib/systems/create-system.ts](lib/systems/create-system.ts#L1-L265)
   - Serialize: entities, blocks (as component names), attributes, skills, casterTypes, progression tables
   - Add npm script: `npm run export:system` → writes to `data.json`

3. **Create skills documentation**  
   - `.github/skills/rpg-system-definition/SKILL.md`:
     - CreateSystem API guide
     - casterTypes, xpTable, spellcastTable configuration
     - Entity blocks pattern with component imports
     - Full example system
   - `.github/skills/rpg-system-usage/SKILL.md`:
     - Entity block syntax
     - YAML prop examples
     - Multi-class character walkthrough
     - Feature/spell/statblock authoring

4. **Update [CLAUDE.md](CLAUDE.md#L1-L100)**  
   - Document `lib/ui/` directory
   - Entity block registration flow
   - casterTypes + progression table examples

**Verification**:
- Character header displays correct total level + XP/slots
- Run `npm run export:system` → `data.json` contains all fields
- Read skills files — clear and complete
- Run `npm run test` — all pass

---

## Key Decisions

- **XP/spell tables in character entity**: Entity-specific progression (not system-wide)
- **Spell slots as `number[][]`**: Simple array of slot distributions
- **Caster types at system level**: Shared conversion functions
- **Aspects vs sub-features**: Clearer terminology for feature components
- **No defaultTraits**: Traits are entity-dependent
- **UI components in `lib/ui/`**: Centralized, exported via api.d.ts
- **Blocks as React.FC**: Simpler authoring, fully typed props
- **Choices in YAML**: State close to UI, no KV store needed
- **Resources as blocks**: Uniform pattern across entities
- **Skills for docs**: Reusable, discoverable guidance
