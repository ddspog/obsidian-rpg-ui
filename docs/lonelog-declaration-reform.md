# Lonelog Declaration Reform — Design

> **Status:** Phases 1–5 shipped (2026-07-08). The vocabulary below is now
> implemented: resources (session + PC scope), cross-file `@ref`, multi-card
> `feature.gm` fences, generator `emits:` composition, PC ops feeding the delta
> tracker, and the shared `resources:` schema on `feature.details`/`feature.choice`
> — including consuming a character's sheet-declared resources (new `resources:`
> list or legacy `type: resource`) as session-log running values. One deferred
> item remains (see §9): surfacing PC-side `cards:`/`generators:` in the action
> drawer (no PC-card UI yet).

## 1. Why

Today `rpg feature.gm` fuses *the card* and *the pieces* into one block: its
aspects (`oracle` / `roll` / `table` / `generator` / `event` / `scene`) chain
into a **single** emitted lonelog snippet. That creates friction:

- **One card per fence.** You can't declare several cards, or name and reuse a
  single piece.
- **Reuse is ad-hoc.** Three unrelated mechanisms already exist for "import a
  piece": `reads:` (dials), `use:` (step-sets), `@[[File]].table(id)` (tables).
- **The body is disconnected.** A `feature.gm`'s worked-example `body` is a
  hand-authored mirror — the code never derives it from the aspects.
- **"Resource" is split in two.** `feature.details type:resource` (PC charges,
  tracked on the sheet) and the lonelog `dial` (GM, tracked in the log) are the
  same idea with two implementations.
- **Hard to start.** No single vocabulary or template to reach for.

**Goal:** one shared, composable vocabulary for declaring lonelog building
blocks — **pieces** (resources, tables, generators, steps) and **cards**
(clickable emitters) — usable across `feature.gm`, `feature.details`, and
`feature.choice`, declarable **inline or imported by `@[[link]]`**.

## 2. Two kinds of declaration

- **Pieces** — named, reusable building blocks; *not* clickable on their own:
  **resources**, **tables**, **generators**, **steps**.
- **Cards** — clickable surfaces that **compose** pieces and, on click, insert a
  lonelog block into the session log. Multiple cards per fence.

## 3. Resources — the unified tracked value

The heart of the reform. A **resource** is a bounded numeric value with a
**default** (and optional recovery). One concept; the shapes differ only in
presentation and bounds semantics:

| shape        | bounds / semantics                    | example                              |
| ------------ | ------------------------------------- | ------------------------------------ |
| `dial`       | band `min..max`, swings both ways     | Chaos Factor 1–9, default 5          |
| `clock`/`track` | `0 → max`, fills up                | Reinforcements 0/6                   |
| `charges`    | `max → 0`, spent down (+ recovery)    | Ki 3; Second Wind 1/short rest       |
| `timer`      | countdown                             | Dawn in 3                            |
| `thread`     | open / closed                         | a narrative thread                   |

`charges` folds in / supersedes today's `feature.details type:resource` (`max`
scalar or per-level map, `recovery`).

### Scope lives in the reference token

There is **no `scope:` field** — *how you reference the value tells us where it
is tracked:*

| Reference token                                   | Meaning                          | Tracked in |
| ------------------------------------------------- | -------------------------------- | ---------- |
| `[CF?]` `[CF+1]` `[CF-1]` `[CF=5]` `[CF:5]`        | a **session** resource (bare abbr) | the log (running value across the block) |
| `[Talon/Mystic Mark?]` `[Talon/Mystic Mark-1]`    | a **PC** resource (`Character/Resource`) | that character (feeds the existing `[PC:Name\|…]` deltas + the sheet) |

**Ops are uniform for both:** `?` inspect (render current value, no change),
`+n`/`-n` adjust, `=n` / `:n` set. Every op is clamped to the resource's bounds,
and the declared `default` applies when the value was never set. This is exactly
the dial-op engine that shipped for the Chaos Factor — widened from "only `CF`"
to "any declared resource, session-abbr **or** `PC/Resource`."

### Import supplies the default

Importing a resource by `@[[link]]` registers its default/bounds, so you **never
declare it at the start of a log** — today's `reads:` behaviour, generalised to
all shapes and both scopes.

### Declaration (provisional)

```yaml
resources:
  - dial:    { id: cf,           name: Chaos Factor, abbr: CF, min: 1, max: 9, default: 5 }
  - charges: { id: mystic-mark,  name: Mystic Mark,  max: 3, recovery: short rest }
  - clock:   { id: reinforcements, name: Reinforcements, max: 6 }
```

## 4. Producers

- **`tables`** — a roll on a table → a `tbl:` line. **Multi-source** (roll all
  listed tables), cross-file refs, `.table(id)` labels. **(shipped)**
- **`generators`** — a named procedure that rolls tables, asks oracle questions,
  and runs steps to produce one or more lonelog lines. **May call other
  generators** (composition). The hardest piece; built last.
- **`steps`** — a choice inside a generator. May `use:` another step-set to
  splice its steps in place (composition). **(shipped: `use:`)**

## 5. Cards

A `cards:` list. Each card **composes** the pieces it emits, in order, and on
click inserts that lonelog block into the log:

```yaml
cards:
  - name: Scene Check
    emits:
      - { oracle: 'Does the "{{scene}}" scene happen as expected?' }
      - "@scene-check"                          # a generator (local id or @[[import]])
      - { scene: 'Start Scene(): "{{next}}"' }
```

Multiple cards per fence. Each `emits` entry is a piece — inline (`{ oracle: … }`)
or a reference (`@scene-check` / `@[[Meaning]]`).

## 6. Hosts & authoring

- **Shared schema** parsed by `feature.gm`, `feature.details`, and
  `feature.choice` (the "options" block). The host decides where cards surface
  (GM side vs PC side), not how resources are scoped.
- **Inline or import, mixed.** A `@ref` resolves a piece by local id
  (`@scene-check`) or by link (`@[[Meaning]]`, `@[[Actions Meaning]].table(action-01)`).

## 7. What already exists (map old → new)

| Reformed concept       | Today                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| resource (`dial`)      | `dial` aspect + `reads:` + `[CF±n]` tokens **(shipped)**          |
| resource (`charges`)   | `feature.details type:resource` + `max`/`recovery` + `consumable-state` |
| `table`                | `rpg table.*` + `table` aspect (multi-source **shipped**)         |
| `generator`            | `generator` aspect (`gen:` + interpret)                           |
| `step` + `use:`        | `steps` + `use:` **(shipped)**                                    |
| `card`                 | the whole `feature.gm` (one card) via `emitGMFeature`             |
| import a piece         | `reads:` / `use:` / `.table(id)` — **to be unified into `@ref`**  |

So the reform is **~70 % reorganisation + naming** of existing primitives, plus
genuinely new work: multiple cards per fence, generator→generator composition,
the resource unification, and the shared schema.

## 8. Token grammar (reference)

```
Session resource:  [<ABBR>?]  [<ABBR>+n]  [<ABBR>-n]  [<ABBR>=n]  [<ABBR>:n]
PC resource:       [<PC>/<Resource>?]  [<PC>/<Resource>-n]  [<PC>/<Resource>=n]
```

- `<ABBR>` = uppercase letters/digits (e.g. `CF`).
- `<PC>/<Resource>` = character name `/` resource name.
- **Only** tokens whose abbr/name matches a **declared (imported)** resource are
  treated as ops; anything else stays literal text.

## 9. Build order (phased)

1. **Resources** — generalise the dial engine to any declared resource: session
   `[abbr op]` **and** PC `[PC/Resource op]` tokens, all shapes, defaults on
   import, PC ops feeding the character delta tracker. **(shipped)**
2. **Piece registry + `@ref`** — one "resolve a piece by local id or `@[[link]]`"
   path, unifying `reads` / `use` / `.table(id)`. **(shipped: cross-file
   `@[[File]]#id` → a generator by the target block's `id:`)**
3. **`cards:`** — the compose-and-emit list; multiple cards per fence. **(shipped)**
4. **Generators calling generators** — recursive composition via a generator's
   own `emits:` list, inline + depth/cycle-guarded (extends `use:`). **(shipped)**
5. **Share the schema** into `feature.details` / `feature.choice`. **(shipped:
   `resources:` declarable + folded via `collectResourceDecls`; PC ops route into
   the delta tracker; and a character's sheet-declared resources — new `resources:`
   or legacy `type: resource` — are consumed as session-log running values via
   `extractResourcesFromEntity`. DEFERRED — surfacing PC-side `cards:`/`generators:`
   in the action drawer (no PC-card UI yet).)**

## 10. Worked examples (target syntax)

**Chaos Factor (a session resource, declared once, imported everywhere):**

```yaml
resources:
  - dial: { id: cf, name: Chaos Factor, abbr: CF, min: 1, max: 9, default: 5 }
```
```
The tension rises. [CF+1]
Where does it stand? [CF?]
```

**Scene Check (a card composing an oracle + generator + scene):**

```yaml
resources:  [ "@[[Chaos Factor]]" ]              # import → CF default available
generators:
  - id: scene-check
    roll: d10
    vs: "@cf"
    interpret:
      ">CF": "Expected Scene"
      "<=CF, odd":  "@[[Altered Scene]]"          # imported generator/step-set
      "<=CF, even": "@[[Interrupt Scene]]"
cards:
  - name: Scene Check
    emits:
      - { oracle: 'Does the "{{scene}}" scene happen as expected?' }
      - "@scene-check"
      - { scene: 'Start Scene(): "{{next}}"' }
```

**Mystic Mark (a PC resource on a character feature):**

```yaml
# on a feature.details
resources:
  - charges: { id: mystic-mark, name: Mystic Mark, max: 3, recovery: short rest }
```
```
Talon marks the target. [Talon/Mystic Mark-1]
How many marks left? [Talon/Mystic Mark?]
```

## 11. Open questions

- **Exact YAML keys** — `resources:` / `generators:` / `tables:` / `cards:`
  section names, and each shape's fields, are provisional.
- **PC resource token** — add the `[<PC>/<Resource>op]` shorthand, or reuse the
  existing `[PC:Talon|Mystic Mark-1]` delta form? (Lean: support the `/` shorthand
  and normalise it into the PC delta pipeline.)
- **Card placeholder filling** — `{{scene}}` / `{{next}}` via the current
  placeholder popover, unchanged?
- **Generator composition** — call depth, cycle handling, and whether a generator
  reference emits inline or as a nested block.
- **Migration** — coexist with today's `feature.gm` aspects and migrate gradually,
  or hard-replace? (Lean: coexist; the aspects become sugar over the new pieces.)
- **`charges` reconciliation** — per-level `max` maps + recovery cadence from
  `feature.details` need to survive the unification.
