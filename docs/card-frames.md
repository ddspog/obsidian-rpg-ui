# Card frames

Pictures that are art only (the image studio's `spell` and `portrait` kinds) are drawn in a frame the plugin makes, not one painted into every picture. A block opts in:

```yaml
image: "![[Bane.webp]]"
framed: true         # the block's own frame; `framed: item` borrows another kind's
frame-name: false    # optional: no name on the frame (or `band` / `plaque`)
```

## The catalogue

| Frame (`framed:`) | Shape | Name | Drawn by |
| --- | --- | --- | --- |
| `spell` | 3:4 | band | `rpg spell` picture |
| `portrait` | 3:4 | band | `rpg character.health` / `character.sheet` / `character.description` portrait; log roster faces (name hidden, slim `is-mini` frame) |
| `item` | 3:4 | band | no block yet — borrow with `framed: item` |
| `creature` | 3:4 | band | no block yet — borrow with `framed: creature` |
| `banner` | 16:9 | none | no block yet — borrow with `framed: banner` |

A new framed block adds a row here and its fence to the kind's `fences` in `lib/services/card-frame-config.ts` (`FRAME_KINDS`), which also drives the settings: each kind lists the blocks that draw it and the vault notes whose framed blocks use it.

## Name modes

- `band`: on the frame's bottom band (a plaque on the CSS frame).
- `plaque`: a plaque over the foot of the art.
- `none`: no name. Right for thumbnails, tokens, maps and banners.

A kind has a default; the settings can change it; `frame-name:` on a block overrides both.

## Generating frames

Settings → Card frames: one section per kind, each with its own style prompt, name mode, and Generate / Regenerate. The model paints the frame with a magenta window and a magenta outside; the plugin clears both, measures the window and saves `<Frames folder>/<Kind> frame.webp` (the folder is a setting, `Frames` by default).

The **plain CSS frame**'s look is CSS too, shown in each kind's section to edit (Reset brings back the default, `DEFAULT_FRAME_CSS`). It's written the same way as generated CSS, below, but carries no weight (`:where(…)`), so the layout's own cases in `card-frame.css` (the slim roster frame, the image frame's plaque) still win. `card-frame.css` holds only the layout.

Each kind can also have **generated CSS**: Generate CSS sends the same style prompt to the Anthropic model set under Image studio, which writes CSS for `.frame`, `.frame .inner`, `.frame .art` and `.frame .plaque` (and their `::before` / `::after`). The plugin rewrites those to that kind's frame alone (`figure.rpg-card-frame.is-gen-<kind>`) and drops anything else: other selectors, `@`-rules, `url()`s other than inline `data:image/`. The CSS shows under the buttons to review and edit; edits apply at once (`lib/services/frame-css.ts`).

Each kind shows the plain CSS frame, its generated CSS and its image frame side by side; the one picked is what blocks draw. Making a new one picks it; the others stay, to switch back. A `<Kind> frame.webp` already in the folder that no kind points to is taken up (its window measured from its clear hole) but not picked. Moving or renaming a frame file in the vault keeps it in use.
