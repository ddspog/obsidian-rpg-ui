---
description: Use the rpg-dev CLI to debug, inspect, and snapshot Obsidian-rendered plugin output. Invoke when verifying visual changes, investigating CSS issues, capturing rendered HTML, or diagnosing rendering bugs.
---

# rpg-dev CLI — Obsidian DevTools Automation

You have access to `rpg-dev`, a CLI that wraps the Obsidian CLI to automate debugging and inspection of the RPG UI plugin's rendered output.

## When to Use This

- **After CSS/style changes** → `css-report` to snapshot computed styles, `compile-html` to see rendered output
- **After component changes** → `dom-snapshot` to capture DOM structure, compare against previous snapshots
- **Debugging rendering issues** → `capture-logs` to see console output during page load
- **Investigating state bugs** → `state-inspect` to dump KV store and frontmatter
- **Performance concerns** → `perf-timing` to measure render time across iterations
- **Before committing visual changes** → run `compile-html` on affected test files and diff the output

## Prerequisites

- Obsidian must be running with `testing-vault` open
- The plugin must be built (`npm run build` or `npm run dev`)
- For `capture-logs`, the debugger attaches automatically

## Commands

### compile-html — Extract rendered HTML fragments

```bash
node cli/rpg-dev.mjs compile-html --input <path> [--output <path>] [--live-preview] [--verbose]
```

Use when you need to see exactly what HTML Obsidian produces for a markdown file. Good for regression testing — diff old vs new output.

**Input**: single .md file or directory (relative to plugin root, e.g. `vault/Sandbox/Tests/03-TEST-SKILLS.md`)
**Output**: `tmp/rpg-dev/html/<filename>.html` (HTML fragments, no wrapping page)

### capture-logs — Console output after render

```bash
node cli/rpg-dev.mjs capture-logs --input <path> [--duration 5000] [--filter "prefix"] [--verbose]
```

Use when debugging lifecycle issues, state initialization, or error messages during page rendering.

**Output**: `tmp/rpg-dev/logs/<filename>.log`

### css-report — Computed style snapshots

```bash
node cli/rpg-dev.mjs css-report --input <path> [--selectors <file>] [--diff <baseline>] [--verbose]
```

Use after CSS changes to verify exactly what computed styles land on elements. Reads selectors from a `.selectors` companion file next to the .md, or falls back to `cli/default.selectors`.

**Output**: `tmp/rpg-dev/css/<filename>.css-report.json`
**Diff mode**: `--diff tmp/rpg-dev/css-baseline/` compares against a previous run

### dom-snapshot — Structural DOM tree

```bash
node cli/rpg-dev.mjs dom-snapshot --input <path> [--selector <css>] [--depth 15] [--verbose]
```

Use to capture a YAML representation of the DOM tree. Great for regression testing structure changes.

**Output**: `tmp/rpg-dev/dom/<filename>.dom.yml`

### perf-timing — Render performance

```bash
node cli/rpg-dev.mjs perf-timing --input <path> [--iterations 3] [--verbose]
```

Use when optimizing render performance. Measures time from plugin reload to sentinel element appearing.

**Output**: `tmp/rpg-dev/perf/perf-report.json`

### state-inspect — KV store + frontmatter

```bash
node cli/rpg-dev.mjs state-inspect --input <path> [--key "pattern.*"] [--output <file>]
```

Use when debugging state persistence, frontmatter sync, or data flow issues.

**Output**: stdout (or file with `--output`)

## Typical Workflows

### After a CSS change
```bash
npm run build
node cli/rpg-dev.mjs css-report -i vault/Sandbox/Tests --verbose
# Check tmp/rpg-dev/css/ for style changes
```

### Verify a component renders correctly
```bash
npm run build
node cli/rpg-dev.mjs compile-html -i vault/Sandbox/Tests/05-TEST-STATS.md --verbose
node cli/rpg-dev.mjs dom-snapshot -i vault/Sandbox/Tests/05-TEST-STATS.md --verbose
# Read the .html and .dom.yml output
```

### Debug why a block isn't rendering
```bash
node cli/rpg-dev.mjs capture-logs -i vault/Sandbox/Tests/10-TEST-ALL-BLOCKS.md --duration 5000 --verbose
# Check tmp/rpg-dev/logs/ for errors or missing lifecycle events
```

### Regression check across all test files
```bash
node cli/rpg-dev.mjs compile-html -i vault/Sandbox/Tests --verbose
# Diff tmp/rpg-dev/html/ against a known-good baseline
```

## Selectors Files

Create a `.selectors` companion file next to any `.md` file to customize what `css-report` inspects:

```
# Comments with #
---
strip:
  - font-family
  - -webkit-*
---
.my-component
.my-component .child-element
.my-component .badge
```

Falls back to `cli/default.selectors` if no companion file exists.

## Important Notes

- **Obsidian virtualization**: Only viewport-visible sections exist in the DOM. Extracted HTML captures what's currently rendered, not the full page.
- **Wait time**: Default 3000ms wait for post-processors. Increase with `--wait 5000` for slow-rendering pages.
- **File paths**: Input paths are relative to the plugin root. `vault/Sandbox/Tests/foo.md` maps to Obsidian path `Sandbox/Tests/foo.md`.
- **All output goes to** `tmp/rpg-dev/` which is gitignored.
