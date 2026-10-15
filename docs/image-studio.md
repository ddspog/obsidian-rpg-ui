# Image studio — image kinds

The vault's images, catalogued from the notes (counts as of 2026-10-13), and how the studio prompts for each.
Every image is saved as **WebP at the encoder's best quality**. A *cut-out* is painted on flat magenta (`#FF00FF`) and keyed out to transparency afterwards: the image models don't paint transparency themselves.

| Kind | Where it sits | Seen | Look | Shape | Transparency |
|---|---|---|---|---|---|
| **Item reference** | `item.element` / `item.magic` / `item.container` `image:`, a thing's `reference_img` | 86 + 3 | one object, painterly semi-realistic, three-quarter view | square; **wide** for long things (bows, polearms, swords, rope) | cut-out, cropped close |
| **Spell card** | `spell` `image:` | 45 | the casting in a scene, gold-filigree violet frame, name plaque | 16:9 | only outside the rounded frame |
| **Portrait card** | `character.*` `portrait:`, an NPC's `reference_img` | 4 + 2 | waist-up portrait, the same frame, name plaque | 16:9 | only outside the frame |
| **Creature** | `stat.monster` / `stat.vehicle` `image:`, a companion's `reference_img` | 16 + 1 | full body on a patch of its habitat | 4:3 | cut-out, cropped close |
| **Character art** | `character.description` `src:` | 4 | full-body heroic pose, light airy palette | 9:16 | cut-out, cropped close |
| **Chapter banner** | frontmatter `banner:` | 34 | one wide dramatic scene for the chapter | 16:9 | opaque |
| **Battle map** | `map` / `log` `image:` | 4 | top-down, no grid, no tokens | 1:1 | opaque |
| **Hotbar icon** | an image named for the card in a folder called `Icons` | — | Baldur's Gate 3 ability icon | 1:1 | opaque |

## What fills each prompt

- **Item**: its name, `type` (singular), weapon `damage`, armour, `rarity` (a magical glow when it's magic: an `item.magic`, a `magic:` list, or a rarity above common), and its description (the block's body, else `text`, else the note's prose). It asks for the one object and nothing else (no stand, cloth or props).
- **Spell**: its name (on the plaque), `school` and damage type → the magic's colour (fire orange-red, cold pale blue, radiant gold-white, abjuration blue wards…), `summary` (else the body), `casting` and `range`.
- **Portrait**: the name (on the plaque); from the sheet, lineage, heritage and classes (`lineage: { file: [[Elf]] }` is read through `file`); appearance `body` and `clothes` from `character.description`; otherwise the note's prose.
- **Creature**: name, `type` (size and kind), `habitat` (the ground it stands on), description.
- **Character art**: name, appearance `body` and `clothes`.
- **Banner**: the chapter's title (frontmatter `title`, else the note's name without its number), its first headings as what it covers, and its opening lines.
- **Map**: the place's name and description.
- **Icon**: the *Hotbar icon style* from settings, the card's name and what it does.

The filled prompt can be edited. **Your additions** are added after it as `Also: …`, and **Draft details** asks the Anthropic endpoint for visual details from the note and puts them in your additions.
