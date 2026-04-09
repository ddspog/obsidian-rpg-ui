---
description: Look up UI component documentation, props, and stories from Storybook before creating or editing components. Use when working on any UI component to ensure correct prop names, types, and patterns.
---

# Component Lookup via Storybook MCP

You are about to work with UI components in this project. Before writing or modifying any component code, you MUST consult the Storybook MCP for accurate, up-to-date documentation.

## Workflow

1. **Discover components**: Call `list-all-documentation` (with `withStoryIds: true`) to see all available components and their story IDs.

2. **Get component details**: Call `get-documentation` with the component `id` to retrieve:
   - TypeScript prop definitions (exact prop names, types, defaults)
   - Code snippets showing real usage from stories
   - Available variants and states

3. **Dive deeper if needed**: Call `get-documentation-for-story` with a specific `componentId` and `storyName` to see additional story variants not included in the initial docs.

4. **Get story-writing guidance**: Before creating or editing `.stories.tsx` files, call `get-storybook-story-instructions` for framework-specific imports, patterns, and conventions.

5. **Preview changes**: After modifying any component or story, call `preview-stories` and include every returned preview URL in your response so the user can visually verify.

## Rules

- NEVER guess or hallucinate prop names, types, or valid combinations. Only use what the Storybook MCP returns.
- NEVER invent component IDs. Only reference IDs from `list-all-documentation`.
- ALWAYS provide preview URLs after any component or story change.
- When editing a component, search for related stories that cover it and provide links.

## Available Components

The following component categories are documented in Storybook:

**Primitives**: Article, Badge, Dice, Fieldset, Figure, HGroup, Header, Level, Line, Panel, Primitives (Pill, TriggerButton, Title), Progress, Section, Stat

**Vault Blocks** (character sheet compositions): Header, Health, Sheet, Stats

Use `$ARGUMENTS` as the component name to look up. If no argument is provided, list all available components.
