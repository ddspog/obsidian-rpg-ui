# Plan: TypeScript-Based System Definitions

**TL;DR** — Replace markdown-based system definitions (`rpg system`, `rpg system.*`, `rpg expression`, `rpg skill-list` blocks) with a TypeScript authoring experience. Users create an `index.ts` in a vault folder (e.g., `systems/dnd5e/index.ts`) that exports `const system = CreateSystem({...})`. The plugin uses **esbuild-wasm** at runtime to bundle + transpile user `.ts` files (resolving cross-file imports), then evaluates the result to load the `RPGSystem`. Settings map a system folder → content folders. The `CreateSystem` function is type-safe via a shipped `.d.ts` file. Expressions move into entity definitions as computed functions. A new `traits` top-level property is added for character capabilities (proficiency, expertise, racial traits).

**Steps**

## Phase 1: `CreateSystem` API & Types

1. Define `SystemConfig` input type in `lib/systems/types.ts` — this is the user-facing config shape passed to `CreateSystem`. Key changes from current `RPGSystem`:
   - `expressions` removed from top-level; moved into each entity's definition as `computed: Record<string, (...args) => unknown>`
   - New `traits` property: `TraitDefinition[]` with `{ name, description?, mechanical?: boolean, effect?: (context) => void }`
   - `attributes` accepts both `string[]` and `AttributeDefinition[]` (sugar: strings auto-expand)
   - `skills`, `conditions`, `features`, `spellcasting` keep current shapes but are plain objects (no `Map`)

2. Create `lib/systems/create-system.ts` — the `CreateSystem(config: SystemConfig): RPGSystem` factory function. It:
   - Validates required fields
   - Normalizes `attributes` (string → `AttributeDefinition`)
   - Converts entity `computed` functions into the internal `ExpressionDef` format (with `evaluate` function + auto-generated `formula` description string)
   - Builds the `expressions` `Map` by collecting all entity computed functions
   - Returns a fully realized `RPGSystem`

3. Create `lib/systems/create-system.test.ts` — unit tests for the factory, covering validation, normalization, and edge cases.

## Phase 2: esbuild-wasm Runtime Bundler

4. Add `esbuild-wasm` as a **runtime dependency** in `package.json`. This is ~10MB but enables full TS transpilation + import resolution in-browser.

5. Create `lib/systems/ts-loader.ts` — the TypeScript system loader:
   - Initialize esbuild-wasm with the WASM binary (bundled or fetched on first use)
   - Given a system folder path, use esbuild's `build()` API with a virtual filesystem plugin that reads `.ts` files from the Obsidian vault via `vault.cachedRead()`
   - Entry point: `index.ts` in the system folder
   - Bundle to a single JS string (format `iife`, globalName `__system_module`)
   - Evaluate the bundle via `new Function()` (consistent with existing pattern in `lib/systems/parser/function-expressions.ts`)
   - Extract the exported `system` object (the `RPGSystem` returned by `CreateSystem`)

6. Create `lib/systems/ts-loader.test.ts` — tests with mock vault reads, verifying that a simple TS system definition compiles and loads correctly.

## Phase 3: Registry & Settings Integration

7. Update `SystemRegistry` in `lib/systems/registry.ts`:
   - Change `loadSystemAsync()` to detect whether the mapping points to a `.ts`/folder (new) vs `.md` file (removed)
   - New loader path: given a system folder path, call `ts-loader.ts` to bundle + evaluate
   - Cache the resulting `RPGSystem` as before
   - File watching: watch the system folder for `.ts` file changes → invalidate cache + reload

8. Update `SystemMapping` in `settings.ts`:
   - Change `systemFilePath: string` → `systemFolderPath: string` (path to folder containing `index.ts`)
   - Update settings UI: folder picker for system definition, multi-folder picker for content folders
   - Migration logic: detect old `.md` paths and warn user (or ignore since we're removing md support)

9. Update `main.ts` initialization:
   - Initialize esbuild-wasm early in `onload()`
   - Pass the initialized esbuild instance to `SystemRegistry`
   - Update `convertSystemMappings()` for new `systemFolderPath` field

## Phase 4: Remove Markdown System Blocks

10. Remove the following views and their registrations:
    - `SystemDefinitionView` (`rpg system` block)
    - `SystemExpressionsDefinitionView` (`rpg system.expressions`)
    - `SystemSkillsDefinitionView` (`rpg system.skills`)
    - `SystemAttributesDefinitionView` (`rpg system.attributes`)
    - `SystemFeaturesDefinitionView` (`rpg system.features`)
    - `SystemSpellcastingDefinitionView` (`rpg system.spellcasting`)
    - `SystemConditionsDefinitionView` (`rpg system.conditions`)
    - `ExpressionDefinitionView` (`rpg expression` — legacy)
    - `SkillListDefinitionView` (`rpg skill-list` — legacy)

11. Remove parser modules that are no longer needed:
    - `lib/systems/parser/index.ts` (main markdown parser)
    - `lib/systems/parser/attributes.ts`
    - `lib/systems/parser/expressions.ts`
    - `lib/systems/parser/function-expressions.ts`
    - `lib/systems/parser/skills.ts`
    - `lib/systems/parser/skills-file-loader.ts`
    - `lib/systems/parser/features.ts`
    - `lib/systems/parser/spellcasting.ts`
    - `lib/systems/parser/conditions.ts`
    - `lib/systems/parser/fields.ts`
    - `lib/systems/parser/handlebars.ts` (Handlebars helpers no longer needed)
    - `lib/systems/parser/wikilink-ref.ts`
    - `lib/systems/system-file-loader.ts` (vault markdown loader)
    - `lib/systems/parser.ts` (deprecated re-export shim)
    - All corresponding `.test.ts` files

12. Remove display components for system definition blocks:
    - All files in `lib/components/system-definition/`

13. Remove `handlebars` from runtime dependencies in `package.json` (unless still used elsewhere — check usages in template rendering for features/abilities).

## Phase 5: Type Declaration Export

14. Create `lib/systems/api.d.ts` — the public type declaration file that users import for autocompletion:
    - Exports `CreateSystem`, `SystemConfig`, `AttributeDefinition`, `SkillDefinition`, `ConditionDefinition`, `FeatureSystemConfig`, `SpellcastingSystemConfig`, `TraitDefinition`, `EntityConfig`
    - This file is copied to the plugin's output directory on build

15. Update `esbuild.config.mjs` to copy `api.d.ts` to the build output so it's available at `.obsidian/plugins/obsidian-rpg-ui/api.d.ts`.

16. Document the user workflow: create a `tsconfig.json` in the vault (or system folder) with paths pointing to the plugin's `.d.ts` for IDE autocompletion when writing system definitions.

## Phase 6: Update D&D 5e Built-in System

17. Rewrite `lib/systems/dnd5e/loader.ts` to use `CreateSystem()` internally — the existing data files in `lib/systems/dnd5e/data/` become the arguments to `CreateSystem`, proving the API works for a real system.

18. Move expressions from `lib/systems/dnd5e/expressions.ts` into entity definitions inside `lib/systems/dnd5e/data/entities.ts` as `computed` functions.

## Phase 7: Vault Example System

19. Create an example vault system at `vault/systems/dnd5e/index.ts` that mirrors the built-in D&D 5e system using the `CreateSystem` API — serves as both documentation and test fixture.

20. Update `vault/` test fixtures and example files that currently reference markdown system definitions.

## Verification

- `npm run test` — all existing UI block tests still pass; new `create-system.test.ts` and `ts-loader.test.ts` pass
- `npm run build` — plugin builds successfully; `api.d.ts` is present in output
- `npm run typecheck` — no type errors
- Manual test: create a system `index.ts` in the vault, map it in settings, verify components render correctly with the TS-defined system
- Verify esbuild-wasm initializes correctly in Obsidian (test on desktop)
- Verify import resolution works: a system split across multiple `.ts` files loads correctly

## Decisions

- **esbuild-wasm over Sucrase**: chosen for multi-file import resolution. Adds ~10MB but enables users to organize systems across multiple `.ts` files
- **Expressions in entities**: expressions move from top-level `Map<string, ExpressionDef>` to per-entity `computed` functions. The internal `RPGSystem.expressions` map is still built by `CreateSystem` (collected from all entities) for backward compat with views
- **Traits as new property**: added alongside features. Traits represent capabilities (proficiency, expertise, racial traits) vs features which are actions/abilities
- **Handlebars removed**: with TS expressions, Handlebars templating for formulas is no longer needed. Feature roll formulas in notes will use a different syntax (TBD in lonelog work)
- **Only `rpg system*` blocks removed**: all UI blocks (`rpg attributes`, `rpg skills`, etc.) remain unchanged
