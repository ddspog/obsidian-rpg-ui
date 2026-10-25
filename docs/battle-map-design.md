# Battle Maps in the Session Log — Design

> **Status:** phases 1–3 built (2026-10-06) — the `rpg map` block, `[COMBAT: [[Map]]]` / `[Pos:]` / `[Mv:]` with the battle fold, Start Combat's map field and squares, and the map pane with its timeline. Next: phase 4 (`[Fx:]` effects, cover/difficult overlays already drawn). Decisions: chessboard coordinates, `[Mv:]` tags, pane right of the prose, maps in their own notes. Builds on `plan.md` Part 8 (the `rpg map`
> block: text-drawn grids, legend, tokens, replay). This adds what Part 8 left
> open: tying a map to a combat in an `rpg log`, notation for movement and
> effects inside action entries, a map pane beside the prose, and a timeline to
> replay the fight round by round. Square grids first; hex stays per Part 8.

## 1. The pieces

| Piece | What it is | Where it lives |
| --- | --- | --- |
| **Map** | Terrain on a square grid (5 ft squares), drawn as text with a legend | An `rpg map` block in its own note (`Kobold Ambush.md`) |
| **Binding** | Which map a fight uses | The log's `[COMBAT]` marker: `[COMBAT: [[Kobold Ambush]]]` |
| **Positions** | Where each combatant stands | Lonelog tags in the log — `[Pos:]` to place, `[Mv:]` to move |
| **Effects** | Spells and areas on the grid | `[Fx:]` tags — shape, size, origin, and when they end |
| **Map pane** | The map, as of the entry you're reading | Beside the prose while a combat is in view |
| **Timeline** | Scrub the fight round by round, turn by turn | Under the map in the pane |

The map note is reusable (the same cave, two fights); everything that *happens*
on it lives in the log, so the log stays the single record of play.

## 2. The map block (from Part 8, trimmed to square grids)

~~~markdown
```rpg map
grid: square
size: 12x8
legend:
  ".": { terrain: grass }
  "^": { terrain: rocks, cover: half }
  "~": { terrain: water, difficult: true }
  "#": { terrain: cliff, blocks: true }
---
# # # # # # # # # # # #
# . . . ^ . . . . . . #
# . . . ^ ^ . . ~ ~ . #
# . . . . . . . ~ ~ . #
# . . . . . . . . . . #
# # # # # # # # # # # #
```
~~~

- Coordinates read like a chessboard: columns **A, B, C…** left to right, rows
  **1, 2, 3…** top to bottom — `C4`. Short enough for prose, unambiguous on a grid.
- Legend entries can carry rules (`cover`, `difficult`, `blocks`) the pane shows
  as overlays; nothing enforces them.
- An optional `tokens:` section gives default starting spots for a map used
  more than once (an ambush site); a fight can override them.

## 3. Binding a map to a fight

```
[COMBAT: [[Kobold Ambush]]]
```

`[COMBAT]` already opens a fight; naming a map binds it. A session can hold
several fights on different maps. **Start Combat** gains a *Battle map* field and
writes the marker for you.

## 4. Notation inside the log

All of it is lonelog tags, so a log reads fine without the plugin.

### Placing — `[Pos:]`

```
[Pos: Talon C4; Lilith D4; [[Kobold, Elite]] H2; Fat [[Kobold, A]] I3]
```

Written once after initiative (Start Combat can place everyone: it offers the
map's default spots, or you click squares). A creature joining later gets its
own `[Pos:]`.

### Moving — `[Mv:]`

Inside an actor's entry, the actor is implied:

```
@(Talon) [Mv: E3] Dash behind the rocks
@(Kobold, Elite) [Mv: G4>F4>E4] Closes on Lilith
```

- `[Mv: E3]` — the acting creature moves to E3 (a straight line on the map).
- `[Mv: G4>F4>E4]` — the route taken, square by square, for paths that matter
  (around cover, through difficult ground).
- `[Mv: Lilith D5]` — someone other than the actor (shoved, carried).
- The pane shows the move as an arrow for that turn, and the distance in feet.

### Targeting

Attack cards already write `→ Lilith` on the action line; the pane draws that as
a line from attacker to target for the turn. No new syntax.

### Effects — `[Fx:]`

```
@(Kobold, Elite) Lantern Splash → Lilith [Fx: Lantern Splash|sphere 10@E4]
@(Jacqui) Burning Hands [Fx: Burning Hands|cone 15 D4>F4]
@(Kowyn) Fog Cloud [Fx: Fog Cloud|sphere 20@F2|until -]
[Fx: -Fog Cloud]
```

- Shapes are the rules' templates: `sphere`/`cylinder` (radius @ point), `cube`
  (side @ corner), `cone` (length, origin > direction), `line` (length, origin >
  direction). Sizes in feet.
- An instant effect shows for its turn only; `until -` keeps it on the map until
  a `[Fx: -Name]` removes it.

### State that's already tracked

HP (`[F:…|HP-6]`), conditions (`+prone`, `+surprised`), death and fleeing
(`dead`, `fled`) all exist; the pane shows them on the tokens — HP as a ring,
conditions as badges, the fallen greyed out.

## 5. The map pane

While a combat is in view, the pane sits beside the prose, like the Log sidebar
does today. Three placements, chosen per log (`map: right | left | background`):

- **right / left** — a sticky column beside the prose, sized to fit (stacking
  below the prose when the page is too narrow, as the sidebar already does).
- **background** — the map behind the prose, faded, taking no space; the
  current turn's tokens and arrows stay crisp.

The pane always shows the battle **as of the entry you're reading**: scrolling
moves it through the fight. Clicking a token jumps to that creature's latest
entry; clicking an entry jumps the map to it.

### Token pictures

A token shows a picture when its creature's note has one: `token_image:` in
the frontmatter of the PC's sheet or the foe's statblock (the note a name links,
`Fat [[Kobold, A]]` → `Kobold, A`). It fills the disc, ringed in the side's
colour, under the HP ring, condition dot and KO badge; without one the token
falls back on its emoji (`token:`), then its initials.

Right-click a token on any of a fight's maps to change it — **Generate token
image…** (the image studio, on the creature's note, set to its *Battle map
token* kind: a head-and-shoulders bust filling a 512 px square, its prompt filled
from the PC's sheet or the foe's statblock), **Upload token
image…** (saved to *Settings → Maps → Battle map tokens → Token image folder*,
named `<note> token.<ext>`; a generated one too, as WebP), **Choose token image from vault…**, or **Remove
token image** (the file stays). Every token linked to the same note shares the
picture, and every map redraws when it changes. A name that links to no note has
nowhere to keep one; the menu says so.

## 6. The timeline — tactical replay

Under the map: the fight's rounds (`R1 … R6`) with a tick per turn. Drag or step
(`|< < > >|`, or arrow keys) to move through it; the prose scrolls along, and
each turn's arrows, effects and damage play out on the grid. A play button steps
on its own. This is how a finished battle is re-read as tactics.

## 7. How state is computed

One pure fold over the log, in order: placements, moves, effects (added, timed
out, removed), HP and conditions, keyed to each entry and grouped by round and
turn — the same shape as the existing CF and foe-HP folds. The pane and the
timeline only read it. Nothing is stored outside the note.

## 8. Build order

1. **The map block** — `rpg map` with a square grid, legend and tokens, rendered
   on its own (SVG). Hex as Part 8 describes, later.
2. **Binding and positions** — `[COMBAT: [[Map]]]`, `[Pos:]`, `[Mv:]`, the fold;
   Start Combat gains the map field and placement.
3. **The pane and the timeline** — beside the prose during a combat, scroll
   sync, round/turn scrubber, replay.
4. **Effects and overlays** — `[Fx:]` templates, attack lines, HP rings,
   condition badges, cover/difficult overlays.
5. **Scenes** (later) — the same pane for non-combat scenes,
   `[SCENE: [[Tavern]]]`, PCs and NPCs on a map without initiative.

## 9. Decisions (2026-10-06)

- **Coordinates** — chessboard: columns A, B, C…, rows 1, 2, 3… (`C4`).
- **Movement** — the `[Mv:]` tag, actor implied; routes with `>`.
- **Pane placement** — right of the prose by default (`map: left | background`
  per log).
- **Map source** — its own note, an `rpg map` block, bound with
  `[COMBAT: [[Map]]]`.
