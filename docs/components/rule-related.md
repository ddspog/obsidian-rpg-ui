# Rule: Related

`rpg rule.related` renders a "see also" / cross-reference list at the bottom of a rule file. It lives next to your `rpg rule.content` in the file that holds the authoritative rule text, and lists pointers to related material — Obsidian embeds (`![[file]]`) or `@[[file]].fn()` call tokens that pull in summaries, tables, or other rules.

It belongs to the `rpg rule.*` family (`content`, `side`, `related`, `notes`, `tab`). Use it for the navigational tail of a canonical rule page: "you might also want the languages summary, the standard-languages table, the container-capacity rule," and so on.

## The key idea: strip-on-import

`rule.related` is a **local-only** block. The "see also" pointers belong on the canonical page; they should not follow that page into every place it gets imported.

- **Open the source file directly** → the related list renders inline at the bottom.
- **Native Obsidian embed** (`![[that file]]`) → the related list still renders, because native transclusion bypasses the strip.
- **Plugin import** via the `@[[file]].fn()` call system → the `rule.related` fence is removed from the file body *before* its content is harvested, so the see-also pointers do not leak into the importing compendium page.

This is the mental model to keep: write your cross-references on the canonical page without worrying that they will clutter every compendium that pulls the rule in. `rpg rule.notes` (author prose) is stripped by the same mechanism.

::: tip
If you want a pointer to show up *everywhere* the rule is reused, put it in `rpg rule.content` instead. `rule.related` is specifically the part that stays home when the plugin imports the page.
:::

## Body shapes

The body is YAML. Two shapes are accepted.

### Flat array

A bare list of entry strings. Heading level defaults to `3` and there is no footer separator.

````yaml
```rpg rule.related
- ![[07. Adventuring Options#Scroll Making|clean]]
```
````

### Object with options

An object with an optional `level`, an optional `view`, and the `entries` list. Only `entries` is read as the list of pointers.

````yaml
```rpg rule.related
view: footer
entries:
  - @[[Languages]].highlight().bare(summary)
  - @[[Languages]].highlight().table(standard-languages)
```
````

That second form — `view: footer` with `@[[...]].highlight()....` call tokens — is the dominant pattern across the rule files in the vault (for example, the language and item pages under `tales-of-the-valiant/worldbuilding/`).

## Entry forms

Each entry can be written several ways. The parser inspects each string and decides what it is.

| You write | Becomes | Renders as |
| --------- | ------- | ---------- |
| `![[file]]` | an **embed** | Obsidian transcludes the target inline |
| `Heading: ![[file]]` | **heading + embed** | an `h{level}` heading, then the embed |
| `@[[file]].fn()` (with or without backticks) | **markdown** carrying a call token | the plugin's call processor resolves the call |
| `Heading: @[[file]].fn()` | **heading + markdown** | a heading, then the resolved call |
| `[[file]]` (no leading `!`) | **markdown** | a plain Obsidian wikilink — **not** an embed |
| any other text | **markdown** | rendered as-is |

A few specifics worth knowing:

- **The leading `!` matters.** Only `![[file]]` is treated as an embed. A bare `[[file]]` is intentionally *not* an embed — it falls through to plain markdown and renders as an ordinary link, not a transclusion.
- **Call tokens always land in markdown.** `@[[file]].fn()` entries are stored as markdown; there is no dedicated per-entry "call" field. Bare (unbackticked) call tokens are auto-wrapped in backticks at render time so the call processor's code-element scan can fire — that is why both `@[[Container Capacity]].bare()` and `` `@[[Container Capacity]].bare()` `` work and produce the same result.
- **Heading split is conservative.** A leading `Heading:` is only peeled off when the colon appears *before* any `[[`, `@[[`, or backtick. Colons inside a wikilink path or a call name stay put, so `@[[06. Playing the Game#Downtime]].bare()` is not misread as a heading.
- **You can leave entries unquoted.** YAML normally chokes on unquoted `[[` and `@[[`. When the YAML parse fails, the block falls back to scanning raw `- value` lines, so `- @[[Languages]].highlight().bare(summary)` works without quotes. A `view: footer` line is also recognized in this fallback path.

### Object-keyed entries

In the object/list form you can also use a YAML mapping per entry, where the key is the heading and the value is the embed or markdown:

````yaml
```rpg rule.related
entries:
  - Prerequisite: "![[ammunition]]"
  - Downtime: "@[[06. Playing the Game#Downtime Activities|Downtime]].bare()"
```
````

## Footer options

Set these only in the object body shape (they are ignored in the flat-array shape):

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `level` | Number (1–6) | `3` | Heading level used for `Heading: …` entries. Floored; out-of-range values fall back to `3`. |
| `view` | `"footer"` | _(none)_ | When `"footer"`, a decorated separator (a centered `※` glyph) is rendered above the entries. Any other value is ignored. |
| `entries` | Array | _(none)_ | The list of pointer strings. This is the only key read as the list. |

## How it renders

The block renders as a single section:

```html
<section class="rpg-rule-related" data-rpg-rule="related">
  <!-- when view: footer -->
  <div class="rpg-rule-related__sep" role="separator" aria-hidden="true"></div>
  <!-- one fragment per entry -->
  <h3 class="rpg-rule-related__heading">Heading text</h3>
  <!-- embed or resolved call/markdown follows -->
</section>
```

- Headed entries emit an `h{level}` with class `rpg-rule-related__heading`.
- `![[ ]]` embeds are handed to Obsidian, which renders the transclusion.
- `@[[ ]].fn()` call tokens are handed to the plugin's call processor.
- With `view: footer`, the `::before` `※` glyph stands in for a plain horizontal rule, matching the decorated separators used elsewhere in the toolkit.

## Limitations / gotchas

- **No per-entry options.** Entries carry only an optional heading plus an embed or markdown body. There is no per-entry `level`, `view`, or `call` field — `level` and `view` are block-level only, and call tokens are always stored as markdown.
- **`view:` only accepts `footer`.** Any other value is silently dropped (no separator).
- **`level` is honored only in the object shape.** The flat-array shape always uses level `3`.
- **Strip needs exactly three backticks.** The strip-on-import regex matches a `` ```rpg rule.related `` fence opened with exactly three backticks. If you wrap the block in a four-backtick fence (sometimes needed when the body itself contains triple-backtick fences), it will **not** be stripped on import and the see-also list will leak into compendium imports. Keep `rule.related` blocks on three backticks.
- **`![[ ]]` always shows through native embeds.** Strip-on-import only applies to the plugin's `@[[file]].fn()` harvesting path. If you natively embed the source page with `![[file]]`, its `rule.related` list renders too — by design.
