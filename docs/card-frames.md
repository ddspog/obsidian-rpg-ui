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
| `spell` | 3:4 | band | spell page picture |
| `portrait` | 3:4 | band | `character.health` / `character.sheet` portrait; log roster faces (name hidden, slim `is-mini` frame) |
| `item` | 3:4 | band | item reference pictures |
| `creature` | 3:4 | band | creature / foe pictures |
| `banner` | 16:9 | none | page and chapter banners |

A new framed block adds a row here and a `FrameKind` in `lib/services/card-frame-config.ts` (`FRAME_KINDS`), which also drives the settings.

## Name modes

- `band`: on the frame's bottom band (a plaque on the CSS frame).
- `plaque`: a plaque over the foot of the art.
- `none`: no name. Right for thumbnails, tokens, maps and banners.

A kind has a default; the settings can change it; `frame-name:` on a block overrides both.

## Generating frames

Settings → Card frames: one section per kind, each with its own style prompt, name mode, and Generate / Regenerate. The model paints the frame with a magenta window and a magenta outside; the plugin clears both, measures the window and saves `Frames/<Kind> frame.webp`. Until a kind has an image it uses the CSS frame.
