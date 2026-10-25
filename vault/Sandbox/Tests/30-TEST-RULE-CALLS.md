---
source:
  system: tov
  book: Player's Guide
  company: Kobold Press
---

# Phase 3 Demo — `@[[file]].fn()` call processor

Imports from [`./rules/combat`](rules/combat.md) using the per-system view registry (`vault/tales-of-the-valiant/config/rule-views.tsx`).

> **Note:** call tokens use the inline-code form (` `@[[file]].fn()` `). The backticks dodge Obsidian's wikilink parser; the call processor unwraps them and resolves the call.

---

## Heading-level views: `h1` … `h6`

Pick the level that nests under the surrounding document structure. The heading text comes from the selected block's `name:` field, falling back to the file name when joining all blocks.

### All blocks at h3 (no id selector)

`@[[combat]].h2()`

Renders an `<h3>combat</h3>` (file name) followed by all three content blocks joined.

### Selective h3 by id — heading uses block's `name`

`@[[combat]].h3(grapple)`

Renders `<h3>Grappling</h3>` (= `grapple.name`) + just that block's body.

### h4 nested form

`@[[combat]].h4(shove)`

`<h4>Shove</h4>` + body. Use when the surrounding doc already used h3.

---

## Compact form: `p()`

Bold name on its own line, body below: `@[[combat]].p(grapple)` We should test if it inlines

---

## Inline form: `inline()`

Bold name inlined with the first line of body text: `@[[combat]].inline(grapple)` We should test if it inlines

---

## Bare form: `bare()`

Just the body, no name + no chrome:

`@[[combat]].bare(opportunity)`

---

## List item: `item()`

All blocks grouped in one `<ul>` automatically:

`@[[combat]].item()`

Single block calls with nesting levels (1 = default, 2+ = indented):

`@[[combat]].item(grapple)`
`@[[combat]].item(shove, 2)`
`@[[combat]].item(grapple)`
`@[[combat]].item(shove, 2)`
`@[[combat]].item(opportunity, 3)`

(Each `item()` call expands to one `<li>` per matching content block. Without an id arg, you'd get all blocks in one ul.)

---

## Side blocks: `float()` / `callout()` / `commentary()`

Wrap an imported rule in a side block. Extra args control direction and preset type.

### Float (default: right, rules preset)

Some prose to give the float something to wrap around. `@[[combat]].float(grapple, scroll)` should appear glued to the right pane edge with the sepia "rules" preset.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

### Float (left, tip preset)

Prose wrapping a left-floated tip. `@[[combat]].float(shove, left, tip)` should hug the left pane edge with a yellow tip accent.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.

### Callout (default: rules preset)

`@[[combat]].callout(shove)`

In-flow ornate certificate with sepia bars.

### Callout (warning preset)

`@[[combat]].callout(opportunity, warning)`

Same certificate variant with orange warning bars.

### Commentary (default: right, no preset)

`@[[combat]].commentary(grapple)`

Some prose to give the commentary something to sit beside. Lorem ipsum dolor sit amet. Consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Commentary (left, quote preset)

`@[[combat]].commentary(shove, left, quote)`

Left-gutter commentary with gray "quote" accent. More prose for wrapping visibility. Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris placerat eleifend leo.

---

## Table view: `row(...)`

All combat actions with name, action type, and range:

| Name | Action | Range | Cost |
|------|--------|-------|------|

`@[[combat]].row(name, action, range, cost)`

Inline syntax — call INSIDE a table cell replaces the host row:

| Name | Action | Range | Cost |
|------|--------|-------|------|
| `@[[combat]].row(name, action, range, cost)` |

Single block (grapple only):

| Name | Contest | Cost |
|------|---------|------|
| `@[[combat]].row(grapple, name, contest, cost)` |

Inside an `rpg table` block (no backticks needed):

```rpg table.combat-summary
| Name | Action | Range | Cost |
|------|--------|-------|------|
| @[[combat]].row(name, action, range, cost) |
```

The `row` view emits `| name | trigger |` cells from frontmatter fields. Each call expands to one row per matching content block — pass an `id` first arg to limit to a single block.

---

## Property-path references still work

These are the existing `@[[file]].path` references (NOT calls — no parens). They resolve fields from the target file's frontmatter or parsed rpg fences:

### File frontmatter (metadata)

- System: `@[[combat]].metadata.source.system` → should show `tov`
- Book: `@[[combat]].metadata.source.book` → should show `Player's Guide`
- Company: `@[[combat]].metadata.source.company` → should show `Kobold Press`

### Direct frontmatter access

- `@[[Luck]].metadata.source` → should show the source string from Luck's frontmatter
- `@[[Luck]].metadata.cssclasses[0]` → should show `note-feature`

### Accessing rpg block fields (pure-YAML bodies)

Blocks whose body is pure YAML (like `rule.side`, `rule.related` with object form) are accessible via `entity.block.field`:

- Side block title: `@[[Luck]].rule.side.title` → should show `PLAYER ADVICE`
- Side block type: `@[[Luck]].rule.side.type` → should show `rules`
- Side block direction: `@[[Luck]].rule.side.direction` → should show `right`
- Related block level: `@[[combat]].rule.related.level` → should show `2`

### Accessing rpg blocks by name

Bracket syntax selects a block by its `name:` field, then dot-walks into its frontmatter:

- `@[[combat]].rule.content[Grapple].id` → should show `grapple`
- `@[[combat]].rule.content[Grapple].action` → should show `Attack action`
- `@[[combat]].rule.content[Grapple].contest` → should show `athletics`
- `@[[combat]].rule.content[Shove].cost` → should show `1 attack`
- `@[[combat]].rule.content[Opportunity Attack].trigger` → should show `creature leaves your reach`
- Nested values: `@[[combat]].rule.content[Grapple].values.speed_when_grappled` → should show `0`

---

## Value resolver

The value resolver lets system TypeScript code read values declared in `rpg rule.content` frontmatter `values:` maps — sync, O(1) lookup after warmup.

### Source data (from `rules/combat.md`)

Each `rule.content` block can declare a `values:` map:

```yaml
id: grapple
values:
  contest: STR (Athletics) vs STR (Athletics) or DEX (Acrobatics)
  size_diff_max: 1
  speed_when_grappled: 0
```

### Usage in system config (TypeScript)

```ts
import { getRuleValue, getRuleValuesById, listRuleValues } from "rpg-ui-toolkit";

// Single value lookup (dotted path, typed, with fallback)
const maxSizeDiff = getRuleValue<number>("grapple", "size_diff_max", { fallback: 1 });
const contest = getRuleValue<string>("grapple", "contest", { fallback: "athletics" });
const speed = getRuleValue<number>("grapple", "speed_when_grappled", { fallback: 0 });
const trigger = getRuleValue<string>("opportunity", "trigger", { fallback: "none" });
const cost = getRuleValue<string>("opportunity", "cost", { fallback: "reaction" });

// All values for one block
const grappleValues = getRuleValuesById("grapple");
// → { contest: "STR (Athletics)...", size_diff_max: 1, speed_when_grappled: 0 }

// Full index (all blocks with values)
const allValues = listRuleValues();
// → Map { "grapple" → {...}, "shove" → {...}, "opportunity" → {...} }

// Use in system definition
export const system = CreateSystem({
  attributes: {
    grapple: {
      sizeDiffMax: () => getRuleValue<number>("grapple", "size_diff_max", { fallback: 1 }),
      speedWhenGrappled: () => getRuleValue<number>("grapple", "speed_when_grappled", { fallback: 0 }),
      contest: () => getRuleValue<string>("grapple", "contest", { fallback: "athletics" }),
    },
    opportunity: {
      trigger: () => getRuleValue<string>("opportunity", "trigger", { fallback: "none" }),
      cost: () => getRuleValue<string>("opportunity", "cost", { fallback: "reaction" }),
    },
  },
});
```

### Verify in dev console

```js
// List all indexed rule values
app.plugins.plugins["dnd-ui-toolkit"].valueResolver.list()

// Single lookup
app.plugins.plugins["dnd-ui-toolkit"].valueResolver.getValue("grapple", "size_diff_max")
// → 1

// Dotted path
app.plugins.plugins["dnd-ui-toolkit"].valueResolver.getValue("grapple", "contest")
// → "STR (Athletics) vs STR (Athletics) or DEX (Acrobatics)"

// All values for one block
app.plugins.plugins["dnd-ui-toolkit"].valueResolver.getValuesById("opportunity")
// → { trigger: "creature leaves your reach", cost: "reaction" }
```

### How it works

- **Warmup**: background scan at plugin load — reads every `.md` file, parses `rule.content` fences, indexes blocks by `id`
- **Sync reads**: `getRuleValue()` is synchronous (O(1) map lookup). Before warmup completes, returns `opts.fallback`
- **Invalidation**: per-file on `metadataCache:changed` — edit a rule file, next read gets the updated value
- **Source of truth**: the vault markdown files, not hardcoded config. Change `size_diff_max: 1` to `2` in `combat.md` → system code reads `2` on next access
