# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run dev` - Start compilation in watch mode
- `npm run build` - Build production version (with TypeScript checks)
- `npm version patch|minor|major` - Bump version
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier (CI pins Prettier 3.6.2; if `npx prettier --version` differs, use `npx prettier@3.6.2` so a local `--write` doesn't reformat unrelated lines)
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Lint and fix code with ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run docs:dev` - Start VitePress documentation server
- `npm run docs:build` - Build documentation
- `task build` - Build and optionally copy to plugin directory (if PLUGIN_DIR is set)
- `task pr` - Prepare for PR (format, lint, type check, and test)
- `task release` - Release a new minor version (includes format, lint, type check, and test)

Recommended workflow: After running tests and fixing any issues, run `npm run build` to catch TypeScript or bundling errors that tests may not surface.

## Code Style

- **TypeScript:** Use strict typing (noImplicitAny, strictNullChecks)
- **React:** Use functional components with explicit props interfaces
- **JSX:** Use React JSX syntax with function components
- **Imports:** Group by: 1) external packages, 2) local files; sort alphabetically within groups
- **Naming:** PascalCase for components/classes/interfaces, camelCase for functions/variables
- **Types:** Define in lib/types.ts with explicit interfaces; use TypeScript generics where appropriate
- **Error Handling:** Use nullable types with default values or early returns; avoid unchecked nulls
- **Components:** Place reusable UI components in lib/components/; use props interfaces
- **Domain Logic:** Place domain-specific code in lib/domains/
- **Views:** Place UI views in lib/views/; extend BaseView where applicable
- **Formatting:** Use consistent indentation (2 spaces), trailing commas, and semi-colons
- **State Management:** Use React hooks (useState) for component state
- **CSS:** Prefix all styles with plugin namespace; place component styles in lib/styles/components/
- **File Structure:** Keep code aligned with domain separation (domains, components, views)

## UI Components (Storybook)

- **Story files** live in `stories/` and follow Storybook 9 conventions (import from `@storybook/react-vite`, test utils from `storybook/test`)
- **Run Storybook** with `npm run storybook` (uses portless for a stable URL)
- When working on components, read their source files in `lib/components/` and existing stories in `stories/` directly — do not rely on a Storybook MCP

## Architecture

- **Plugin Structure:** Obsidian plugin with React components for D&D UI elements
- **Code Block Processors:** Each View class processes specific YAML code blocks (ability, skills, stats, etc.)
- **State Management:** Uses KeyValueStore with JsonDataStore for persistent state across sessions
- **Component Architecture:**
  - Views: Handle code block parsing and rendering (extend BaseView)
  - Components: React components for UI elements
  - Domains: Business logic for D&D mechanics (abilities, skills, combat)
  - Services: KV store for state persistence and event bus for communication
- **Rendering:** Views register markdown post-processors that transform YAML into interactive React components
- **Plugin Settings:** Configurable color scheme and state file path in settings tab
- **Event System:** Uses message bus (msgbus) for communication between components and frontmatter changes
- **Frontmatter Integration:** Automatically syncs with Obsidian frontmatter for character data like proficiency bonus and level
- **View Registration Pattern:** Each view extends BaseView and implements:
  - `registerView()`: Registers code block processor with plugin
  - `render()`: Transforms parsed YAML data into React components
  - State persistence handled automatically via KV store integration
- **State Persistence:**
  - In-memory cache with automatic disk persistence
  - Scoped by view type and element ID
  - State file location configurable in plugin settings
- **Template System:** Handlebars-style templating for dynamic content (e.g., {{dex_mod}} in ability descriptions)
- **D&D Mechanics:** Implements 5e rules for ability modifiers, proficiency bonuses, skill calculations

## Testing

- **Framework:** Vitest with Node environment
- **Test Files:** Place tests alongside source files with `.test.ts` extension
- **Coverage:** Configured to exclude config files, main.ts, and build outputs
- **Running Tests:**
  - All tests: `npm run test`
  - Watch mode: `npm run test:watch`
  - Single test file: `npm run test path/to/file.test.ts`
  - Pattern matching: `npm run test -- --grep "pattern"`
- **Test Patterns:** Mock external dependencies (e.g., MockDataStore), use TypeScript generics for type safety

## Development Workflow

- **Plugin Development:** Set PLUGIN_DIR environment variable to auto-copy built files to Obsidian plugin directory
- **Documentation:** VitePress documentation in `/docs` with examples and component references
- **State File:** Plugin creates `.dnd-ui-toolkit-state.json` (configurable) for persistent component state

## Cloud Obsidian screenshots

`node scripts/cloud-obsidian.mjs start|screenshot|stop` runs real Obsidian headless (Xvfb + Electron, driven over CDP with Playwright) in cloud sessions. `start` downloads Obsidian once (cached in `~/.cache/rpg-obsidian`), copies the vault from `$RPG_VAULT_ROOT` into `~/.cache/rpg-obsidian/work/vault` (the real vault is never touched) and installs the built `main.js`/`manifest.json`/`styles.css`/`esbuild.wasm` — run `npm run build` first. Set `THEME_DIR` to a checkout of a theme repo (e.g. `/home/user/ddspog/obsidian-ribbons-theme`, containing `manifest.json` and a built `theme.css`) to install it too; the vault's `appearance.json` selects the active theme. With a theme, open fonts from `@fontsource` (npm) are mapped to the theme's `My Text/Title/Table/… font` names, since the macOS fonts it prefers (New York, SF Compact) are missing in the cloud; override with `FONT_SERIF`, `FONT_SANS`, `FONT_ROUNDED` (fontsource ids) or disable with `CLOUD_FONTS=0`. `prepare` pre-downloads Obsidian and fonts without launching it. Then `screenshot "<note path in vault>" out.png ["heading to scroll to"]` renders the note in reading mode, at 1600×1400 with Obsidian's file explorer collapsed (`KEEP_SIDEBAR=1` keeps it); view the PNG with the Read tool. `MOBILE=1 VIEWPORT=390x844` renders the note in Obsidian's phone UI (`is-mobile`, a 390px-wide window); mobile layout rules live in `lib/styles/mobile.css`. The first mobile run after a fresh `start` may show rule blocks as "Unknown" (esbuild-wasm fails to initialise in emulated mobile mode): open the note once without `MOBILE` so the system bundle is cached, then repeat. The `rpg-dev` CLI below needs the desktop Obsidian CLI and does not work against this headless instance.

## Working with the repository owner

- **Questions as artifacts.** When a question comes down to a choice that is visual or behavioural (a layout, a default, a flow), do not ask it in prose. Publish an artifact with the problem shown on real screenshots and the options as mockups to choose between, mark a recommendation, and end with a "Copy picks" summary to paste back. The owner liked this far better than text questions.
- **`/ui-review <goal> [scope]`** (`.claude/commands/ui-review.md`) runs a whole review: picks real example notes from `docs/ui-review/` (the curated set and the generated `block-census.md`), captures them on a phone and a desktop (`scripts/ui-review-capture.mjs`), runs the Impeccable analyses, and builds a before/after board to rate (`scripts/ui-review-board.mjs`). With no goal it shows every analysis Impeccable can run and lets the owner choose.
- **Design reviews.** For UI reviews the owner uses Impeccable (`npx skills add pbakaus/impeccable -g -a claude-code -s '*' -y --copy`): a design-review agent and a detector-and-measurement agent run independently, on phone then desktop, and their findings are merged. Verify any headline claim in the live app before reporting it.

## Simulators

`simulators/` is a sub-project for trying single pieces of the plugin in a browser (a phone included): each simulator is one HTML file holding the plugin code it exercises, `styles.css` and a copy of the vault's notes, with `obsidian` stubbed. `npm run build`, then `RPG_VAULT_ROOT=/path/to/vault npm run sim:build [id]` writes `simulators/dist/<id>.html`; `npm run sim:check` opens each in headless Chromium; `npm run sim:new <id>` scaffolds one. Shared code is in `simulators/core/`, each simulator in its own folder (`lonelog-log`: the Log and its cards; `rpg-table`: a table block). See `simulators/README.md` for the API and for what is not simulated (character sheets, other plugins, images).

## rpg-dev CLI (DevTools Automation)

A CLI at `cli/rpg-dev.mjs` wraps the Obsidian CLI to automate debugging and inspection. Requires Obsidian running with `testing-vault` open.

- `node cli/rpg-dev.mjs compile-html -i <path>` — Extract rendered HTML fragments from Obsidian reading mode
- `node cli/rpg-dev.mjs capture-logs -i <path>` — Capture console output after page render
- `node cli/rpg-dev.mjs css-report -i <path>` — Generate computed CSS snapshots per `.selectors` companion file
- `node cli/rpg-dev.mjs dom-snapshot -i <path>` — Capture structural DOM tree as YAML
- `node cli/rpg-dev.mjs perf-timing -i <path>` — Measure post-processor render timing
- `node cli/rpg-dev.mjs state-inspect -i <path>` — Dump KV store + frontmatter state

**When to use:** After CSS/component changes to verify rendering, when debugging layout or style issues, when investigating why a block doesn't render, or to create regression baselines. Use the `/rpg-dev` command for detailed guidance.

**Key facts:**

- Input paths are relative to plugin root (e.g., `vault/tests/03-TEST-SKILLS.md`)
- Output goes to `tmp/rpg-dev/` (gitignored)
- All commands auto-unfold collapsed sections before capture
- Obsidian virtualizes DOM sections — extracted HTML is viewport-limited
- `.selectors` companion files live next to `.md` files for `css-report`
