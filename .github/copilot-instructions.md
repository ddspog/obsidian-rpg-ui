# Copilot Instructions

## Commands

```bash
npm run dev              # Watch mode (no TypeScript check)
npm run build            # TypeScript check + bundle (production)
npm run typecheck        # TypeScript only (no emit)
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run test             # Vitest run (all tests)
npm run test:watch       # Vitest watch mode
npm run test path/to/file.test.ts          # Single test file
npm run test -- --grep "pattern"           # Filter by name
task pr                  # format + lint + typecheck + test (pre-PR check)
```

After fixing test failures, always run `npm run build` — TypeScript errors won't surface in Vitest.

## Architecture

This is an **Obsidian plugin** that renders interactive D&D 5e character sheet components from YAML code blocks. All blocks use the `rpg` processor family registered in `main.ts`.

### Code Block → View → Component pipeline

```
Markdown (```rpg healthpoints```)
  → main.ts: registerMarkdownCodeBlockProcessor("rpg", ...)
  → ViewRegistry dispatches to matching View class (lib/views/)
  → View parses YAML and either:
      (a) renders static HTML string (stats, badges, spell, features, etc.)
      (b) mounts a React component via MarkdownRenderChild (health, consumable, initiative, sessionlog)
```

**Static views** return a rendered HTML string from `render()`.  
**Dynamic views** create a `MarkdownRenderChild` subclass that mounts React on `onload()` and unmounts on `onunload()`. State is loaded from KV store before React renders.

### Persistent State

`lib/services/kv/` — `KeyValueStore` wraps a `DataStore` interface (production: `JsonDataStore` → `.dnd-ui-toolkit-state.json` in the vault). State is scoped by `filePath + componentId`. Components call `kv.get(key)` on load and `kv.set(key, value)` on every change.

### Event System

`lib/services/event-bus.ts` — `msgbus` is a scoped pub/sub bus. Topics are namespaced as `filepath:topic`. Key topics:

- `reset` — `ResetEvent { filePath, eventType, amount? }` — components restore state (full if `amount` undefined)
- `fm:changed` — Obsidian frontmatter changed; components re-read proficiency/level
- `abilities:changed` — ability scores changed; skill totals need recalculation

Components subscribe in `onload()` and unsubscribe in `onunload()`.

### D&D 5e Domain Model (`lib/domains/`)

All game mechanics live here, not in components. Key modules:

- `abilities.ts` — modifier = `floor((score - 10) / 2)`; saving throw = modifier + proficiency (if proficient)
- `skills.ts` — 18 skills, each tied to an ability; bonus = ability mod + proficiency × multiplier (0, 0.5, 1, or 2)
- `healthpoints.ts` — current/temp HP, hit dice tracking, death saves
- `initiative.ts` — combat round state, per-creature HP/initiative

Frontmatter keys `proficiency_bonus` and `level` are read from the active file and fed into all calculations. Changes trigger `fm:changed` events.

### Template System

`lib/utils/template.ts` — Handlebars-style `{{variable}}` evaluated against frontmatter + computed ability data. Used in feature descriptions, health blocks, etc.

### RPG Systems (`lib/systems/`)

Pluggable system definitions beyond D&D 5e. Systems are TypeScript files loaded at runtime via `ts-loader`. They define entities, conditions, traits, and custom block types. The system registry resolves `rpg <entityType>.<blockName>` code blocks dynamically.

## Key Conventions

### Adding a new view

1. Create `lib/views/my-view.ts` extending `BaseView` — set `codeblock = "my-type"`
2. Implement `render(source, el, ctx)`: parse YAML, return HTML string or mount React
3. Register in `lib/plugin/view-registry.ts`
4. For dynamic (stateful) views: create a `MarkdownRenderChild` subclass alongside the component

### Component props pattern

```typescript
interface MyComponentProps {
  config: ParsedBlock;                      // YAML-derived static config
  state: MyState;                           // runtime state
  onStateChange: (s: MyState) => void;      // persists via KV + triggers re-render
}
```

### State key convention

State keys follow `<viewType>/<elementId>` scoped to file path. Never use bare IDs — always scope to both file and view type to avoid collisions across notes.

### Reset events

Components that consume resources must listen for `reset` events with their `eventType` string (e.g., `"short-rest"`, `"long-rest"`). If `ResetEvent.amount` is defined, restore that amount; otherwise restore fully.

### CSS

All styles are prefixed with the plugin namespace (see `styles.css` + `lib/styles/components/`). Never use unscoped selectors.

### TypeScript paths

`rpg-ui-toolkit` is aliased to `lib/systems/api.d.ts` — the public API surface for external system definitions. Use this import path in system files, not relative paths.

### Test placement

Tests live next to source files as `*.test.ts`. Mock `DataStore` with `MockDataStore`. Do not test view rendering — test domain logic and utilities.
