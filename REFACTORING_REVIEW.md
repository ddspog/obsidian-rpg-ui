# Refactoring Review: Files with >200 LOC

**Generated:** February 17, 2026  
**Scope:** TypeScript, TSX, JavaScript, and CSS files (excludes tests and markdown)  
**Total Files Analyzed:** 16 files  

---

## Executive Summary

This review identifies 16 files across the Obsidian RPG UI Toolkit that exceed 200 lines of code. These files represent potential refactoring candidates to improve maintainability, testability, and code clarity. The review is organized by severity/impact and includes specific recommendations for each file.

---

## Critical Refactoring Candidates (500+ LOC)

### 1. **styles.css** - 1972 LOC ⚠️ CRITICAL
**Location:** `./styles.css`  
**Type:** CSS Stylesheet  
**Status:** Primary stylesheet - contains all component styles

#### Issues:
- **Monolithic structure**: Single file contains styles for all components, themes, and utilities
- **Hard to maintain**: Changes affect entire stylesheet
- **No organization**: Styles are concatenated without clear separation by component
- **Difficult to locate**: Hard to find specific component styles

#### Recommendations:
1. ✅ **Already partially modularized** - Component CSS files exist (`lib/styles/components/`)
2. **Consolidation opportunity**: Move all component imports into `lib/styles/index.css` instead of concatenating to root
3. **Organization**: Group related style sections with clear comments
4. **Performance**: Consider CSS variables strategy for theming (already in use)

#### Refactoring Priority: **MEDIUM** (15-20 hours)
- Keep as main entry point but improve organization
- Extract repeated patterns into CSS variable definitions
- Consider CSS-in-JS alternative if React component scaling continues

---

### 2. **lib/styles/components/system-definition.css** - 540 LOC
**Location:** `./lib/styles/components/system-definition.css`  
**Type:** CSS Component Styles  

#### Issues:
- Multiple related display components in one file (system-info, skills, expressions, features, spellcasting)
- High specificity selectors with deep nesting potential
- Repeated patterns across similar components

#### Recommendations:
1. **Split into sub-components**:
   - `system-info.css` (50-70 LOC)
   - `skills-display.css` (120-150 LOC)
   - `features-display.css` (100-120 LOC)
   - `spellcasting-display.css` (80-100 LOC)
   - `expressions-display.css` (80-100 LOC)

2. **Extract common patterns**:
   - Container styles (`.system-*-container`)
   - Header styles (`.system-*-header`)
   - Card/grid layouts

3. **Create CSS utility classes**:
   - `.card-layout` for consistent card styling
   - `.header-with-icon` for icon + title patterns

#### Refactoring Priority: **HIGH** (4-6 hours)
- Easy wins with immediate maintainability improvements
- Can be done incrementally without breaking changes

---

### 3. **lib/styles/components/initiative.css** - 460 LOC
**Location:** `./lib/styles/components/initiative.css`  
**Type:** CSS Component Styles  

#### Issues:
- Complex layout for tracker UI with many sub-components
- Repeated styling for similar elements (initiative-item, monster variations)
- Mixed concerns: layout, spacing, and theming

#### Recommendations:
1. **Split logical sections**:
   - **Layout styles** (tracker structure, grid layouts)
   - **Entity styles** (player/monster specific)
   - **HP/combat styles** (health bars, buttons)
   - **Control styles** (input fields, buttons)

2. **Extract reusable patterns**:
   - HP bar styling → utility class
   - Button group layouts → utility
   - Colored text variants (damage/heal/status) → utility

3. **Consider BEM naming** for clarity:
   - `.initiative-tracker` (block)
   - `.initiative-tracker__item` (element)
   - `.initiative-tracker__item--dead` (modifier)

#### Refactoring Priority: **HIGH** (3-5 hours)
- Moderate complexity with good ROI
- Split into 2-3 focused CSS files

---

### 4. **lib/styles/components/session-log.css** - 400 LOC
**Location:** `./lib/styles/components/session-log.css`  
**Type:** CSS Component Styles  

#### Issues:
- Session log UI is complex with many tag types and states
- Repeated color patterns for different tag types
- Mixed event display styles

#### Recommendations:
1. **Create tag-specific files**:
   - `tag-pill.css` (tag styling, ~60 LOC)
   - `event-list.css` (event display, ~100 LOC)
   - `scene-header.css` (scene display, ~40 LOC)
   - `hud.css` (HUD display, ~80 LOC)
   - `change-overview.css` (overview section, ~80 LOC)

2. **Centralize tag color system**:
   - Create a tag color map as CSS variables
   - Define `.tag-*` pattern classes programmatically

3. **Extract event styling patterns**:
   - `.event-card` base variant
   - `.event-card--action`, `--dialogue`, `--consequence`, etc.

#### Refactoring Priority: **MEDIUM** (5-7 hours)
- Complex but well-bounded scope
- Immediate improvement to code readability

---

## High Priority Refactoring Candidates (300-500 LOC)

### 5. **lib/systems/parser.ts** - 637 LOC
**Location:** `./lib/systems/parser.ts`  
**Type:** TypeScript Module  
**Status:** Core system definition parser  

#### Issues:
- Single file contains: Handlebars initialization, YAML parsing, file loading, attribute resolution
- Multiple concerns: parsing, loading, validation
- Long functions with nested conditionals

#### Specific Function Sizes:
- `parseSystemFromMarkdown()`: ~80 LOC
- Helper functions duplicated across categories (skills, expressions, features)

#### Recommendations:
1. **Extract sub-modules**:
   ```
   lib/systems/parser/
   ├── index.ts (main entry, 50 LOC)
   ├── handlebars.ts (helper initialization, 60 LOC)
   ├── attributes.ts (attribute parsing, 80 LOC)
   ├── skills.ts (skill parsing, 100 LOC)
   ├── expressions.ts (expression parsing, 100 LOC)
   ├── features.ts (feature parsing, 100 LOC)
   └── spellcasting.ts (spellcasting parsing, 80 LOC)
   ```

2. **Create common utilities**:
   - `parseFromFileOrInline()` for the 3+ repeated patterns
   - `resolveFileContent()` to handle file loading

3. **Improve error handling**:
   - Add validation layer before parsing
   - Better error messages with context

#### Refactoring Priority: **CRITICAL** (8-12 hours)
- High-impact improvements to maintainability
- Blocks better testing of individual parsers
- Enables easier addition of new system features

---

### 6. **lib/components/initiative.tsx** - 428 LOC
**Location:** `./lib/components/initiative.tsx`  
**Type:** React Component (TSX)  
**Status:** Initiative tracker UI  

#### Issues:
- Component handles: state management, rendering, event handling all in one
- Multiple event handlers with complex logic
- Nested render logic for different states

#### Code Organization:
- Event handlers: ~150 LOC (handleSetInitiative, handleDamage, handleRound, etc.)
- Render logic: ~250 LOC (main component + nested structures)
- Utilities: ~28 LOC

#### Recommendations:
1. **Extract sub-components**:
   - `<InitiativeItemRow />` - Single initiative row
   - `<MonsterHPTracker />` - Monster HP management
   - `<RoundControls />` - Round navigation buttons
   - `<InitiativeEmpty />` - Empty state

2. **Extract custom hooks**:
   - `useInitiativeState()` - State management logic
   - `useInitiativeHandlers()` - All event handlers returner
   - `useInitiativeSort()` - Sorting logic

3. **Separate concerns**:
   - Move event handler logic to domain layer (`lib/domains/initiative.ts`)
   - Domain should be testable without React

#### Code Structure:
```typescript
// Before: 428 LOC in one component
// After: 
//   Initiative.tsx (150 LOC - main component)
//   useInitiativeState.ts (80 LOC - hook)
//   useInitiativeHandlers.ts (100 LOC - hook)
//   InitiativeItemRow.tsx (60 LOC)
//   MonsterHPTracker.tsx (50 LOC)
//   RoundControls.tsx (40 LOC)
```

#### Refactoring Priority: **CRITICAL** (6-8 hours)
- Most complex React component
- Difficult to test currently
- Good candidate for component composition patterns

---

### 7. **lib/domains/lonelog/deltas.ts** - 310 LOC
**Location:** `./lib/domains/lonelog/deltas.ts`  
**Type:** TypeScript Module  
**Status:** Delta extraction and mutation tracking  

#### Issues:
- Switch statement with many cases for tag processing
- Similar logic repeated for PC, NPC, clock, thread processing
- Helper functions could be more generic

#### Recommendations:
1. **Create tag processors**:
   ```
   lib/domains/lonelog/tagging/
   ├── index.ts
   ├── pcTagProcessor.ts
   ├── npcTagProcessor.ts
   ├── entityTagProcessor.ts
   ├── progressTagProcessor.ts
   └── threadTagProcessor.ts
   ```

2. **Use strategy pattern**:
   - Define `TagProcessor` interface
   - Register processors by tag kind
   - Reduce if/else chains

3. **Extract state change builders**:
   - `createHPChange()`
   - `createStatusChange()`
   - `createProgressChange()`

#### Refactoring Priority: **MEDIUM** (4-6 hours)
- Well-contained logic
- Immediate test coverage improvements possible
- Can be refactored incrementally

---

## Medium Priority Refactoring Candidates (200-300 LOC)

### 8. **lib/systems/dnd5e.ts** - 300 LOC
**Location:** `./lib/systems/dnd5e.ts`  
**Type:** TypeScript Module (D&D 5e constants/rules)  

#### Issues:
- Large constant data structures (~250 LOC)
- Should be data-driven instead of code

#### Content Breakdown:
- Attributes: 6 items
- Skills: 18 items  
- Feature types: ~40 items
- Feature behaviors: ~50 LOC
- Expressions: ~60 LOC
- Spellcasting: ~40 LOC

#### Recommendations:
1. **Extract to data files**:
   - `data/dnd5e/attributes.json`
   - `data/dnd5e/skills.json`
   - `data/dnd5e/features.json`
   - `data/dnd5e/spellcasting.json`

2. **Benefits**:
   - ✅ Easy to extend without code changes
   - ✅ Can be loaded from external sources
   - ✅ Version control friendly (data changes only)

3. **Keep only code logic** in dnd5e.ts:
   - Rules engine functions
   - Calculations (modifier formulas)
   - Validation logic

#### Refactoring Priority: **MEDIUM** (4-5 hours)
- Improves flexibility and maintainability
- Data-driven approach scales better
- No breaking changes required

---

### 9. **lib/services/entity-resolver.ts** - 251 LOC
**Location:** `./lib/services/entity-resolver.ts`  
**Type:** TypeScript Service  
**Status:** Entity caching and resolution  

#### Issues:
- Single class handles: file loading, entity parsing, caching, invalidation
- Some methods could be extracted to separate concerns

#### Recommendations:
1. **Separate cache and resolution**:
   - Extract `EntityCache` class (60 LOC)
   - Keep `EntityResolver` for orchestration (100 LOC)

2. **Create EntityParser** helper:
   - Extract entity parsing logic (~50 LOC)
   - Makes testing simpler

3. **Improve invalidation**:
   - Consider cache invalidation strategy pattern
   - LRU cache if memory becomes concern

#### Refactoring Priority: **LOW** (2-3 hours)
- Working well for current scope
- Refactor if entity loading becomes bottleneck
- Good candidate for incremental improvement

---

### 10. **lib/components/health-card.tsx** - 277 LOC
**Location:** `./lib/components/health-card.tsx`  
**Type:** React Component  
**Status:** Health tracking UI  

#### Issues:
- Mix of: state management, event handlers, complex rendering
- Multiple features: HP display, progress bar, temp HP, controls, hit dice

#### Recommendations:
1. **Extract sub-components**:
   - `<HealthDisplay />` (30 LOC) - Read-only health info
   - `<HealthControls />` (60 LOC) - Damage/heal/temp buttons
   - `<HealthProgressBar />` (40 LOC) - Visual bar
   - `<HitDiceTracker />` (50 LOC) - Hit dice management

2. **Extract custom hook**:
   - `useHealthState()` for state logic (80 LOC)

3. **Benefits**:
   - Easier to test individual pieces
   - Reusable components
   - Clearer responsibilities

#### Refactoring Priority: **MEDIUM** (5-6 hours)
- Component is getting complex
- Progressive refactoring approach recommended

---

### 11. **lib/systems/registry.ts** - 267 LOC
**Location:** `./lib/systems/registry.ts`  
**Type:** TypeScript Service (Singleton)  
**Status:** System inventory management  

#### Issues:
- Singleton pattern implementation with multiple responsibilities
- File system integration, configuration, default system handling
- Could benefit from dependency injection

#### Recommendations:
1. **Extract file loader**:
   - Separate file I/O concerns (50 LOC)

2. **Create SystemFactory**:
   - Move system instantiation logic (40 LOC)

3. **Maintain registry with DI**:
   - Inject dependencies instead of managing them
   - Easier to test with mock dependencies

#### Refactoring Priority: **LOW** (3-4 hours)
- Low-frequency changes to this code
- Refactor if adding support for more system types
- Current architecture is acceptable

---

### 12. **lib/views/HealthView.tsx** - 264 LOC
**Location:** `./lib/views/HealthView.tsx`  
**Type:** React View Component  
**Status:** Health block view processor  

#### Issues:
- Single component handles: view registration, state management, rendering
- Event listeners mixed with rendering logic
- Could benefit from separation of concerns

#### Recommendations:
1. **Extract business logic to hook**:
   - Create `useHealthViewLogic()` (100 LOC)
   - Keep component focused on render (50 LOC)

2. **Extract event handlers**:
   - Separate `onFrontmatterChange`, `onResetEvent` handlers
   - Use custom hook for event subscriptions

3. **Consider base view pattern**:
   - Already extends BaseView ✅
   - Standardize event handling across views

#### Refactoring Priority: **MEDIUM** (3-4 hours)
- Improves testability
- Template for other View components

---

### 13. **lib/domains/lonelog/parser.ts** - 262 LOC
**Location:** `./lib/domains/lonelog/parser.ts`  
**Type:** TypeScript Parser  
**Status:** Session log parsing  

#### Issues:
- Regex patterns embedded in code (hard to modify)
- Complex parsing state machine
- Intertwined parsing and AST building

#### Recommendations:
1. **Extract regex patterns**:
   - Create `patterns.ts` with named regex constants
   - Makes patterns more readable and testable

2. **Create AST builder**:
   - Separate parsing from tree construction
   - Makes testing easier (can test building separately)

3. **Document parsing state machine**:
   - Add state transition comments
   - Consider enum for states

#### Refactoring Priority: **LOW** (3-4 hours)
- Works well for current parsing needs
- Refactor if custom DSL becomes requirement
- Good candidate for documentation improvement first

---

### 14. **lib/views/ConsumableView.tsx** - 219 LOC
**Location:** `./lib/views/ConsumableView.tsx`  
**Type:** React View Component  
**Status:** Consumable item management view  

#### Issues:
- Similar structure to HealthView - likely extraction opportunity

#### Recommendations:
1. **Extract to custom hook**: (same pattern as HealthView)
   - `useConsumableViewLogic()` 
   - Reduce component to ~50 LOC

2. **Create view base utilities**:
   - Common event handling pattern
   - Shared initialization logic

#### Refactoring Priority: **LOW** (2-3 hours)
- Follow improvements made to HealthView
- Maintain consistency across views

---

### 15. **lib/systems/types.ts** - 206 LOC
**Location:** `./lib/systems/types.ts`  
**Type:** TypeScript Type Definitions  
**Status:** System type interfaces  

#### Issues:
- Large number of type definitions could indicate unclear domain model
- Some types might benefit from more specific interfaces

#### Current Types:
- `RPGSystem` (root type)
- `EntityTypeDef`, `FrontmatterFieldDef`
- `ExpressionDef`, `SkillDefinition`
- `FeatureSystemConfig`, `SpellcastingSystemConfig`
- And various sub-types

#### Recommendations:
1. **Organize by concern**:
   ```
   lib/systems/types/
   ├── index.ts (main exports)
   ├── system.ts (RPGSystem and related)
   ├── entities.ts (EntityTypeDef)
   ├── expressions.ts (ExpressionDef)
   ├── skills.ts (SkillDefinition)
   ├── features.ts (FeatureSystemConfig)
   └── spellcasting.ts (SpellcastingSystemConfig)
   ```

2. **Add documentation**:
   - Each type needs JSDoc comments
   - Document constraints and relationships

#### Refactoring Priority: **LOW** (2-3 hours)
- Improve organization
- Add comprehensive documentation
- Types are well-designed overall

---

### 16. **lib/domains/lonelog/types.ts** - 200 LOC
**Location:** `./lib/domains/lonelog/types.ts`  
**Type:** TypeScript Type Definitions  
**Status:** Session log domain types  

#### Issues:
- Large union types for events and tags
- Could benefit from factory functions/helpers

#### Recommendations:
1. **Create type builders**:
   - `createLonelogEntry()` factory helpers
   - Type guards for each entry type
   - Reduce creation errors

2. **Document domain model**:
   - Add comprehensive JSDoc
   - Clarify relationships between types

#### Refactoring Priority: **LOW** (2-3 hours)
- Types are well-structured
- Focus on documentation
- Consider type guards for runtime safety

---

## Summary Table

| File | LOC | Type | Priority | Est. Hours | Key Issue |
|------|-----|------|----------|-----------|-----------|
| styles.css | 1972 | CSS | MEDIUM | 15-20 | Monolithic structure |
| system-definition.css | 540 | CSS | HIGH | 4-6 | Multiple components in one file |
| initiative.css | 460 | CSS | HIGH | 3-5 | Complex layout with repetition |
| session-log.css | 400 | CSS | MEDIUM | 5-7 | Many tag types and states |
| lib/systems/parser.ts | 637 | TS | CRITICAL | 8-12 | Multiple concerns, repetition |
| lib/components/initiative.tsx | 428 | TSX | CRITICAL | 6-8 | Complex component, poor testability |
| lib/domains/lonelog/deltas.ts | 310 | TS | MEDIUM | 4-6 | Switch statement, repetition |
| lib/systems/dnd5e.ts | 300 | TS | MEDIUM | 4-5 | Data hardcoded in code |
| lib/services/entity-resolver.ts | 251 | TS | LOW | 2-3 | Multiple concerns (minor) |
| lib/components/health-card.tsx | 277 | TSX | MEDIUM | 5-6 | Getting too complex |
| lib/systems/registry.ts | 267 | TS | LOW | 3-4 | Singleton pattern, testability |
| lib/views/HealthView.tsx | 264 | TSX | MEDIUM | 3-4 | Can follow BaseView pattern |
| lib/domains/lonelog/parser.ts | 262 | TS | LOW | 3-4 | Could improve readability |
| lib/views/ConsumableView.tsx | 219 | TSX | LOW | 2-3 | Follow HealthView pattern |
| lib/systems/types.ts | 206 | TS | LOW | 2-3 | Organizational improvement |
| lib/domains/lonelog/types.ts | 200 | TS | LOW | 2-3 | Add documentation |

---

## Recommended Refactoring Order

### Phase 1: Critical Path (20-24 hours)
1. **lib/systems/parser.ts** (8-12 hours) - Unblocks other improvements
2. **lib/components/initiative.tsx** (6-8 hours) - Highest complexity component
3. **lib/styles/components/system-definition.css** (4-6 hours) - Quick wins

### Phase 2: High Value (12-18 hours)
4. **lib/styles/components/initiative.css** (3-5 hours)
5. **lib/styles/components/session-log.css** (5-7 hours)
6. **lib/components/health-card.tsx** (5-6 hours)

### Phase 3: Maintenance (10-15 hours)
7. **lib/systems/dnd5e.ts** (4-5 hours) - Extract to data
8. **lib/domains/lonelog/deltas.ts** (4-6 hours)
9. **Testing & Documentation** (2-4 hours)

### Phase 4: Polish (7-13 hours)
10. Remaining items in priority order
11. Cross-file consistency improvements
12. Documentation enhancements

---

## Quick Wins (Can be done immediately)

- ✅ Add detailed comments to parser.ts for clarity
- ✅ Extract CSS utility classes from component stylesheets
- ✅ Add JSDoc comments to types.ts and lonelog/types.ts
- ✅ Create CSS variables for repeated color values in session-log.css
- ✅ Extract named regex patterns in lonelog/parser.ts

---

## Notes for Implementation

1. **Testing Strategy**: Add tests for extracted modules immediately after extraction
2. **Version Control**: Each refactoring should be a separate commit with clear messages
3. **Backwards Compatibility**: Ensure public APIs don't break during refactoring
4. **Performance**: Monitor bundle size, especially for component split operations
5. **Documentation**: Update README and CLAUDE.md as architectural changes occur

---

**Total Estimated Effort:** 50-75 hours across all phases  
**Recommended Timeline:** 2-3 week sprint with 20-25 hours/week allocation
