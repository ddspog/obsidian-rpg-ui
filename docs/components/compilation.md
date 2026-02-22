# Compilation Bases View

The plugin registers a **Compilation** view type for the Obsidian Bases core feature. Open any `.base` file, switch the Layout to "Compilation", and the view will render each matched note's full markdown content — one after the other — creating a compiled document from smaller notes.

## How it works

1. Bases handles **filtering, sorting, and querying** — you define those in native Bases syntax.
2. The Compilation view reads each entry's markdown file and renders it in **Reading mode**.
3. You control what appears around the content via **view options**.

## View Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Show file name | Toggle | `true` | Display the file name as a heading |
| File name heading level | Dropdown | H3 | Which `<h*>` to use for the file name |
| Subtitle property | Text | (empty) | Frontmatter property to display as subtitle |
| Show file contents | Toggle | `true` | Render the file's markdown body |
| Properties (comma-separated) | Text | (empty) | Frontmatter properties shown as **Property**: Value |
| Footer property | Text | (empty) | Frontmatter property shown in the footer |

## Layout of each entry

```
┌──────────────────────────────┐
│  h3  File Name (linked)      │  ← showFileName + headingLevel
│  subtitle value (italic)     │  ← subtitleProperty
│                              │
│  ... full markdown content   │  ← showContent
│  rendered in Reading mode    │
│                              │
│  **Level**: 5                │  ← properties
│  **Class**: Wizard           │
│                              │
│  source: PHB p.123           │  ← footerProperty
└──────────────────────────────┘
```

## Pagination

For large result sets the view automatically **lazy-loads** entries as you scroll. Only the first 20 entries are rendered initially; more are loaded as you approach the bottom (infinite scroll via IntersectionObserver).

## Example

Create a file `npcs.base` with:

```yaml
views:
  - type: compilation
    name: "NPC Compendium"

source: '"NPCs"'
```

Then configure the view options (gear icon) to set heading level, subtitle property, etc.
