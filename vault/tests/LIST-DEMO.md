# rpg list — demo

Each entry line is built from the spell file's `rpg spell` fence frontmatter
(`school`, `summary`); the name falls back to the file basename and renders as
a working `[[wikilink]]`. Reload the plugin after a rebuild.

## 1 · Standalone (Phase A)

A single list flows its entries into responsive columns (2 narrow → 3+ wide).

```rpg list.cantrips-solo
name: Cantrips
subtitle: 0-level arcane spells
columns: auto
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## 2 · Sibling merge + columns (Phase B)

Three **consecutive** list blocks (only blank lines between them) merge into one
flowing content area that breaks out to the full pane width — the headings +
entries pour and wrap column→column. No pagination here, so no pills; if the
merged content exceeds one viewport-height the box scrolls within its cap.

```rpg list.cantrips
name: Cantrips
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.first-circle
name: 1st Circle
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.second-circle
name: 2nd Circle
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/2nd-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## 3 · Pagination + pills (Phase C)

The same three lists, but `paginate: auto` on the first block splits the merged
entries into **viewport-height pages** — the page break is wherever the content
fills the `100vh − reserve` column box. Prev/next controls sit below; the pills
jump to the page where each list begins, and the active pill tracks the list at
the top of the current page. A list spilling across a page shows a "(cont.)" bar.

```rpg list.paged-cantrips
name: Cantrips
paginate: auto
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.paged-first
name: 1st Circle
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.paged-second
name: 2nd Circle
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/2nd-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/2nd-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## 4 · One list summing several sources (long, paginated)

A **single** list block whose `entries` aggregate several folder calls into one
long list under one heading (repeated here to ~120 spells). With `paginate: auto`
it flows across the (max-3) columns and pages by viewport height — prev/next
only, no pills (there's just one list).

```rpg list.all-arcane
name: Arcane Spell List
subtitle: cantrips through 2nd circle
paginate: auto
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/2nd-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## 5 · Long enough to actually paginate (repeated sources)

Eight consecutive blocks, each re-listing the cantrips folder under a different
header (~168 entries total). This far exceeds one viewport-height of 3 columns,
so it splits into multiple pages — prev/next below, and a pill per header that
jumps to that header's page.

```rpg list.set-1
name: Set 1
paginate: auto
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-2
name: Set 2
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-3
name: Set 3
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-4
name: Set 4
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-5
name: Set 5
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-6
name: Set 6
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-7
name: Set 7
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.set-8
name: Set 8
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## 6 · Forced column counts

`columns: 2` caps the layout at two columns (it still drops to 1 if the content
is too short), and the box narrows to a 2-column width. With `paginate: auto` and
enough entries, it pages within those two columns:

```rpg list.two-col
name: "Cantrips (columns: 2)"
columns: 2
paginate: auto
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

`columns: 1` forces a single column at normal text width, paging quickly since
one column fills fast:

```rpg list.one-col
name: "Cantrips (columns: 1)"
columns: 1
paginate: auto
entries:
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## 7 · Fixed lines mixed with file data

Entries can be literal markdown lines (a bare string or `text:`) alongside the
`@[[…]]` calls, so hand-written rows sit right next to file-derived ones.

```rpg list.mixed
name: Homebrew & Sourced
entries:
  - "*Patron's Whisper* (Enchantment) A fixed, hand-written cantrip."
  - text: "*Ash Ward* (Abjuration) Another fixed line, via `text:`."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```



