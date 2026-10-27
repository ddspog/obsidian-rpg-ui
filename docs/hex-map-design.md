# Overworld Hex Maps — Design

> **Status:** phases 0–4 BUILT (2026-10-15), 4b bases and height lift BUILT (2026-10-16); phase 5 (editing on the map) designed 2026-10-16 in §13, building; hex travel and hex battles unplanned. Ports the
> [hex-map-editor](~/src/github.com/ddspog/hex-map-editor) prototype into the
> plugin as `rpg map` with `grid: hex`, for **overworld** maps — territory,
> realms, regions, villages, roads and rivers — not battle maps. Supersedes the
> hex half of `plan.md` Part 8 where they disagree (§11).
> **Decisions settled 2026-10-15 (§12):** axial `(q, r)` coordinates; the
> editor's per-hex line syntax; the editor's third-party pack copied into a
> vault folder set in settings; terrain catalog and tuning in `pack.yml`;
> `rpg map` + `grid: hex`.

## 0. Built so far (2026-10-15)

- **Phase 0:** `cli/import-hex-pack.mjs` copied `basic` (788 tiles, 22 MB) and
  `svg` into `z52. Hex Packs/`. Each `pack.yml` was written fresh, with the
  editor's originals kept beside it as `editor-pack.<layer>.yml`.
  `lib/services/hex-pack-index.ts` indexes the packs from the vault, rebuilds on
  any vault change under the folder, and caches image sizes.
- **Phase 1:** `lib/domains/hexmap/` (`axial`, `packs`, `parse-hex-map`,
  `layout`, all with tests) plus `lib/components/hexmap/hex-map-view.tsx` and
  `lib/styles/components/hex-map.css`. It is dispatched from `MapRenderChild`
  on `grid: hex`, and session-log battle lookups skip hex maps. Settings have
  "Packs folder" (with Rescan and a list of found packs) and "Default pack".
  The test note is `Sandbox/Tests/23-TEST-HEXMAP.md` in `testing-vault`.
- **Differences from the plan, found while building:**
  - **Tuning uses `hexWidth`**: the image pixels the hex face spans. For
    `basic` that's 477 px of the 932 px image, measured; the face is centred,
    and the 3D slab sits under it. `zoom` stays as an extra multiplier. This
    replaces the editor's `zoom: 2.0` pattern trick and works the same for
    tiles and stack sprites.
  - The peak tiles are drawn 49 px left and 7 px up of the image centre, so
    `pack.yml` has `files:` offsets for them.
  - **Name filters** in brackets match names _containing_ the text (the
    editor matched prefixes, but this pack's names all start with "Hex - "), so
    `water[Ocean]` works. `(qualifier)` matches `(text)`.
  - **Layer order** is terrain + base < edge < path < stack (base added 2026-10-16, drawn just over its hex's terrain, §8c) (higher height groups on
    top, rows top to bottom). Changed 2026-10-16 from the editor's terrain <
    stack < path: stacks are props that sit on everything, and edges (coasts)
    lie on the ground under paths, so a river's mouth draws over the shore.
  - A spec with no tile is reported with its line number and drawn hatched,
    or skipped for stacks and paths. There is no silent fallback to grass.
    Pack `flat` (plain colours) is built in.
  - `(Label)` keeps one label per hex: the last line's.
  - Region outlines (`@Region` is parsed and shown in the tooltip),
    autotiling, and the catalog and tuning UI aren't built yet: phases 2–4.
- **How it was checked:** 28 unit tests; an offline probe (vitest renders
  `HexMapView` to SVG with inlined images, then headless Chrome screenshots
  it; `qlmanage` is blocked by the sandbox); then live in Obsidian with
  `obsidian eval` and `dev:screenshot` (76 tiles, 3 labels, problem lists).

### Phases 2–4 (2026-10-15)

- **Phase 4: paths that join up.** `autotile.ts`. The side tables in
  `basic/pack.yml` were **measured from the art**, not taken from the file
  names: a probe sampled each 932×810 path tile for opaque pixels at the six
  side midpoints. That gives roads 36 combinations (clean first, then clean
  cul-de-sacs, then messy as a last resort), rivers 36 and walls 6. A
  combination with no tile draws a stroke. A river runs into water only at
  **one mouth per connected river**, at an end, no more than one side off
  straight; on a tie the end written last wins. The templates now live in
  `cli/hex-packs/*.pack.yml`.
- **Phase 3: regions.** `regions.ts`. Each region is one fill path (no seams)
  plus a border made of member sides that face non-members. Nested regions
  (`parent:`) get a dashed border and are drawn over their parent. The label
  sits on the member hex nearest the middle. The tooltip shows hex and coast
  counts. Undeclared `@Region` tags get palette colours. Not built: clicking a
  region to open its note.
- **Phase 2: settings.**
  - Display settings: grid lines, default coordinates, label size, map height.
    Changing one only redraws open maps (`hexPackIndex.notify`); only a change
    to the packs folder or default pack rebuilds the index.
  - **Pack browser** (`hex-pack-studio.tsx`): pack and layer, folder tree,
    thumbnails, a 7-hex preview of the draft, tuning at pack, folder or tile
    level (blank inherits), "Name it", the catalog editor, and "Fill from
    folders".
  - Save goes through `pack-yml-edit.ts`, which uses the yaml document API, so
    comments survive and tile entries stay quoted one-liners. A
    `pack.yml.bak` is made once. Typing in a tuning field replaces its own
    last edit rather than queueing one per keystroke.
- **Verification gotcha:** `app.setting.open()` doesn't stay open when driven
  from the CLI. Render the tab into an overlay instead: append
  `tab.containerEl` to a fixed div, then call `tab.display()`. That call's
  CLI reply gets lost, so query in the next call.

## 1. What the prototype gives us

| Prototype piece                                                                                                                                                                 | File                         | Keep / change                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hexmap` fence parser — `t(q,r)` / `s(q,r)` / `p(q,r)` lines, `(Label)`, `terrain[variant]`, `+ #color`, `Nm:` height groups with `*` items, legacy `q,r,content,color,terrain` | `src/lib/hexmap-parser.ts`   | **Keep the grammar as written**, rewritten as a tested parser with line numbers. Drop `migrateToNewSyntax` and its hard-coded `stone→grass` rewrite.                                                                                              |
| Texture lookup — packs found by folder, `terrain[sub][file]` paths, `*` wildcard, numeric index, seeded random per hex                                                          | `src/lib/terrain-loader.ts`  | **Keep the rules**, rewrite them as one pure function (the prototype has two near-identical 120-line copies plus hard-coded fallbacks to "basic grass"). It can't use Vite's `import.meta.glob`; it reads a vault index instead (§5).             |
| `pack.yml` — `defaults` / `terrains` / `files`, each with zoom, offsetX/Y, borderWidth, preserveAspectRatio                                                                     | `src/lib/pack-config.ts`     | **Keep the format and cascade** (defaults → terrain → file), and extend it with `catalog:` and `autotile:` (§5, §8). Parse it with the `yaml` dependency. `pack.yml` is the single source of truth; nothing is kept as a separate override layer. |
| Terrain Inspector (browse a pack, tune zoom/offset, export YAML)                                                                                                                | `TerrainInspector.tsx`       | **Becomes the settings section** (§6), which reads and writes `pack.yml` in the vault.                                                                                                                                                            |
| SVG renderer — flat-top, unclipped "extended" tiles that overlap neighbours, z-order by height → layer → `s = −q−r` → `q`                                                       | `src/components/HexGrid.tsx` | **Keep** the geometry and the z-order formula. **Replace** the per-cell `<pattern>` + 200%-zoom trick with one positioned `<image>` per cell (§7). The fallback SVG patterns (grass/water/forest…) become the built-in `flat` pack.               |

Assets (about 22 MB, third-party): flat-top tiles at **932×810**; path overlays
that cover the whole hex (also 932×810), with rotation or side in the name
(`roads/clean/turn60-3`, `rivers/Hex - River 1 N`); and small stack sprites
(`Buildings - City Building 1 (blue)` is 245×168). File names carry biome
qualifiers in parentheses: `(lush)`, `(dry)`, `(cursed)`, `(dead)`,
`(wasteland)`, `(blue)`.

## 2. The pieces

| Piece               | What it is                                                                            | Where it lives                                                                     |
| ------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Hex map**         | An overworld on flat-top hexes, one line per layer per hex, in the editor's syntax    | An `rpg map` block with `grid: hex`, in its own note (`Dunlind.md`, `Eodoroth.md`) |
| **Texture pack**    | Tiles plus `pack.yml`                                                                 | `<Hex packs folder>/<pack>/` in the vault (§5)                                     |
| **Terrain catalog** | Short names maps can use (`dry-plains` → `plains(dry)`)                               | `catalog:` in the pack's `pack.yml`                                                |
| **Display tuning**  | Zoom and offset per pack, terrain or file                                             | `defaults` / `terrains` / `files` in `pack.yml`                                    |
| **Settings**        | Where the packs are, the default pack, a pack browser and tuner that edits `pack.yml` | Plugin settings → "Hex maps"                                                       |

## 3. The block

### 3.1 Shape

````markdown
```rpg map
grid: hex
title: Dunlind and the Barelgrove
pack: basic        # optional; else the settings default
seed: 7            # optional; reshuffles random variants for the whole map
---
0m:
  * t(0,0): plains(lush)
  * t(1,0): forest[lush]  @Barelgrove
  * t(2,0): forest[lush]  @Barelgrove
  * t(0,1): ocean
  * t(1,1): (Featherbark) [[Holy City of Featherbark]] urban  @Dunlind
  * s(1,1): buildings[City Building 1 (blue)] x3
  * p(1,1): roads
  * p(2,1): roads
  * t(2,1): plains(dry)  @Dunlind
  * p(2,0): rivers

100m:
  * t(3,0): (Stelscar) mountain[snowy]
```
````

- **Header, then `---`, then the editor's syntax unchanged.** The header is
  needed because the reload-safety detector (`detectMetaFromSource`) only reads
  keys above a `---`, and it already maps `grid: hex` to `map`. Header keys are
  `grid` (required), `title`, `pack`, `seed`, `scale` (for example `6 mi`, shown
  in tooltips) and `regions` (§3.4). A body pasted straight from the editor,
  with its own `title:` / `pack:` lines, still works: those lines are read as
  header keys.
- **Coordinates are axial `(q, r)`** as in the editor. Hexes are flat-top,
  `q` runs east, and `r` runs south-east. The six neighbours of `(q, r)` are
  `(q±1, r)`, `(q, r±1)`, `(q+1, r−1)` and `(q−1, r+1)`. Coordinate labels
  show `q,r`.
- **Everything the editor accepts is accepted**: `t/s/p(q,r): (Label) spec + #color`,
  bare `q,r: …` (terrain), `Nm:` height groups with `*` items, empty hexes
  `t(q,r):`, solid colours, and the legacy CSV form.

### 3.2 Additions (all fit the editor's line grammar)

Each addition is a token on an existing line, so editor maps stay valid:

| Token                   | Meaning                                                                                                                                                                           | Example                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `[[Note]]`              | Makes the hex a place: click opens the note, Ctrl/Cmd-hover gives Obsidian's page preview. `(Label)` is the name drawn; without a label the note name is used.                    | `t(1,1): (Featherbark) [[Holy City of Featherbark]] urban` |
| `@Region`               | Puts the hex in a region (§3.4). Several are allowed: `@Dunlind @Caulkin`.                                                                                                        | `t(2,1): plains(dry) @Dunlind`                             |
| `xN` (stack lines)      | Scatters N copies of the sprite with a seeded jitter, so a city reads as several buildings.                                                                                       | `s(1,1): buildings x3`                                     |
| `(qualifier)` in a spec | Filters files whose name contains `(qualifier)`, which is how this pack names biomes. Distinct from `(Label)`: a label comes **before** the spec, a qualifier is glued **to** it. | `plains(dry)`, `hill(desert)[2]`                           |
| Catalog id              | Any name in the pack's `catalog:` stands for its spec (§5).                                                                                                                       | `dry-plains`                                               |

The double brackets of `[[Note]]` can't be confused with variant brackets,
which always follow a terrain name with no space (`forest[lush]`).

### 3.3 Paths connect themselves

`p(q,r): roads`, with only the path family named (the top folder: `roads`,
`rivers`, `wall`), is **autotiled**. The hex joins every neighbouring hex that
has a path of the same family, and the tile for that set of sides comes from
`autotile:` in `pack.yml` (§8). Writing a full spec (`roads[clean][turn60-3]`)
picks that exact tile, as in the editor, and is never autotiled.

### 3.4 Regions

Declared in the header, with members tagged per hex with `@Name`:

```yaml
regions:
  Dunlind: { color: "#8a3b2e", link: "[[Dunlind]]" }
  Barelgrove: { color: "#3b6e5a", link: "[[Barelgrove]]", parent: Dunlind }
```

Each region is drawn as one outline around its hexes with a light tint, and its
label sits near the middle. The tooltip shows the hex count and the coast count
(sides next to water). The world notes already measure realms this way
("46 hexes inland, 15-hex coastline"). A tag with no declaration still groups
hexes, using a colour from a default palette.

### 3.5 Errors

Every parse error carries its **source line number**. The block renders what it
could, with a list of errors underneath, so one bad line never blanks the map.
A spec with no matching tile draws a hatched "missing" hex with the spec in its
tooltip. It doesn't silently become grass, as it does in the prototype.

## 4. Dispatch — no new wiring

`rpg map` is already registered everywhere a block has to be: `main.ts` (primary
processor), `process-rpg-fences.ts` (embeds), `meta-extractor.ts` (`grid: hex`
already detects as `map`), and `import-fences.ts` (`map` already in
`isProcessedFence`). The only change is in
`lib/domains/battlemap/render-map-block.tsx`: read `grid:` first, and on `hex`
mount `HexMapRenderChild` instead of the square view. Battle-map consumers
(`SessionLogView`, `[COMBAT: [[Map]]]`) **reject** a hex map with a clear notice
until hex combat is designed (§10).

New code lives in `lib/domains/hexmap/` (parser, axial maths, pack index, tile
choice, autotile, region outlines: all pure and unit-tested) and
`lib/components/hexmap/` (React view), plus `lib/styles/components/hex-map.css`
imported from `lib/styles/index.css`.

## 5. Texture packs in the vault

**Where:** in the vault, in the folder set in plugin settings. The default is
**`z52. Hex Packs`**, next to `z50. Reference` and `z51. Banners`. Phase 0
copies the editor's pack into it. It isn't bundled into `main.js` because of its
22 MB and its third-party licence. Tiles load through
`app.vault.getResourcePath(file)`, just like picture battle maps.

**Layout: pack first, so one folder is one whole pack:**

```
z52. Hex Packs/
├── basic/
│   ├── pack.yml
│   ├── terrain/plains/damp/…   terrain/forest/lush/conifer-0.webp …
│   ├── path/roads/clean/turn60-3.webp   path/rivers/…   path/wall/…
│   └── stack/buildings/…   stack/pins/…   stack/banner/…
└── svg/
    ├── pack.yml
    └── terrain/grass/grass-0.svg …
```

The prototype nests the other way round (`assets/terrain/basic/…`).
`cli/import-hex-pack.mjs <editor assets dir> <vault packs folder>` rearranges
it, merges the three per-layer `pack.yml` files into one, and runs as a dry run
by default. It refuses to overwrite, because the vault has no git safety net.

**`pack.yml` (extended prototype format):**

```yaml
name: "Basic"
version: "1.0.0"
defaults: { zoom: 1.0, offsetX: 0, offsetY: 0, borderWidth: 0 }
terrains:
  forest: { zoom: 1.05, offsetY: -2 }
files:
  "forest/lush/conifer-0": { offsetY: -3 }
catalog: # NEW — short names usable in maps
  dry-plains: plains(dry)
  pine-forest: forest[lush][conifer]
  city: { spec: urban, color: "#a08060" } # color = fallback / tint
autotile: # NEW — §8
  roads: { folder: roads/clean, tiles: { … } }
```

**Index (`HexPackIndex` service):** built on layout-ready by listing vault files
under the folder. It is invalidated on vault `create` / `delete` / `rename` /
`modify` under that prefix (`modify` matters for `pack.yml`), and it emits a
msgbus event so open maps re-render. It holds, per pack and layer, a tree of
folders → files (name without extension, URL). Built-in pack `flat` = the
prototype's SVG pattern fills, always present, so maps render with no pack.

**Tile choice (pure, ported from `terrain-loader.ts`):**
`selectTile(index, pack, layer, spec, seed) → { url, display } | missing`.
The catalog is resolved first. Then `forest` → files directly in `forest/`;
`forest[lush]` → that subfolder; `forest[lush][conifer]` → names starting with
`conifer`; `[*]` → any subfolder; `[2]` → the third match; `(dry)` → names
containing `(dry)`. The seed is `seed + q,r + layer`, so a hex keeps its
variant. Pack fallback is explicit: block `pack:` → settings default → `flat`.

## 6. Settings — "Hex maps" section

The settings only say where packs are, and give a UI for editing them. Pack
data stays in `pack.yml`.

1. **Packs folder** (text plus folder suggest, default `z52. Hex Packs`),
   **Rescan**, and the list of packs found with tile counts per layer, so a
   wrong folder shows "0 packs" at once.
2. **Default pack** (dropdown of found packs plus `flat`).
3. **Pack browser** (the Terrain Inspector, ported). Pick a pack and a layer,
   then browse its folder tree with a hex thumbnail of every tile, rendered with
   the pack's tuning.
   - **Catalog editor:** add, rename or remove `catalog:` entries, and pick
     their spec by clicking a folder or tile in the browser. "Fill from folders"
     proposes one entry per subfolder (`plains-damp`, `forest-lush`…).
   - **Tuning:** zoom, offsetX, offsetY and borderWidth at the defaults,
     terrain or file level. The preview is a **7-hex cluster**, because overlap
     only shows next to neighbours.
   - **Save writes `pack.yml`** through `app.vault.process`, keeping comments
     where possible (`yaml` Document API). The first save makes a
     `pack.yml.bak` next to it.
4. **Grid style:** grid lines (on / off, colour, opacity), coordinate labels
   (off / on hover / always), region outline width, label size, and the map's
   default height in the note.

Live update: saving `pack.yml` triggers the index `modify` event, and
settings changes emit the same msgbus event, so open maps re-render with no
reload. Add the row to `reference_reactivity_matrix` once built.

## 7. Rendering

- **Geometry (the editor's):** flat-top with circumradius `R` from settings.
  The centre of `(q, r)` is `x = 1.5R·q`, `y = √3R·(r + q/2)`. The viewBox is
  fitted to the hexes present.
- **Tiles:** one `<image>` per cell, sized `2R·zoom` wide at the tile's own
  aspect, centred plus offset, **unclipped**, so trees and peaks overhang
  neighbours. No per-cell `<pattern>` defs.
- **Z-order: the editor's formula unchanged.**
  `height·1000 + layer (terrain 0, stack 100, path 200) + 10·s + q`, with
  `s = −q−r`. Region outlines, place labels and the grid are drawn above all of
  it.
- **Stacks:** sprites are drawn at their own aspect, centred on the hex. With
  `xN`, positions are jittered by the seed within the inner circle of the hex.
- **Regions:** the outline is every hex side whose neighbour isn't in the
  region, joined into closed loops: one `<path>` per region (tinted fill,
  solid stroke). Nested regions use an inset stroke.
- **Interaction (v1):** fixed-height viewport, fit-to-width on load, wheel zoom,
  drag pan, double-click to reset. Hover outlines the hex and shows a tooltip
  (`q,r`, height, specs per layer, place, regions). Clicking a place opens its
  note.
- **Scale:** budget about 2 000 hexes per block. Measure with
  `node cli/rpg-dev.mjs perf-timing`. If too slow, rasterise the tile layers
  to one `<canvas>` and keep SVG for regions, labels and hover. Decide that
  with numbers in phase 1, not up front.
- **Obsidian specifics:** never `display:none` the `.el-pre`; styles are
  prefixed `rpg-hexmap-`. Maps work inside `@[[Note]].bare()` embeds, since
  `map` is a processed fence.

## 8. Autotiled paths

Each autotiled path hex gets a **side mask**: which of its 6 sides (N, NE, SE,
S, SW, NW for flat-top) face a neighbour with the same path family. The pack's
tiles are named by shape and rotation (`straight-0`, `turn60-3`, `turn120-2`,
`rfork-1`, `xfork-0`, `start-4-hub`, `start-2`…; rivers by number and side).
`autotile:` in `pack.yml` maps shapes (below) to files. Keys written as side
masks (`"N,S"`) still read, as their type, and are rewritten as shape names on
the next edit:

```yaml
autotile:
  roads:
    tiles:
      start-0: roads/clean/start-0
      start-4-hub: roads/clean/start-4-hub
      straight-1: [roads/clean/straight-1, roads/messy/straight-1]
  rivers:
    connectsTo: [water]
    tiles:
      straight-0: ["rivers/Hex - River 2 N", "rivers/Hex - River 9 N"]
```

Autotile works out a hex's sides, then `chooseShape` (autotile.ts) picks among
the shapes with those sides: the type when it has a tile, else a variant. Rules
that choose a variant from what the path meets go there.

**Shape names** (`path-shapes.ts`). Sides are numbered clockwise from the
north face (0 N … 5 NW). A tile is a type plus a slot: slot k is the slot-0
shape turned k sides clockwise, and a type has only its distinct turns. Every
mask is exactly one of these 63:

| Type       | Slot 0                                              | Slots |
| ---------- | --------------------------------------------------- | ----- |
| `start`    | N                                                   | 6     |
| `end`      | N — `start`'s sides, where a path stops (a variant) | 6     |
| `turn60`   | N, NE                                               | 6     |
| `turn120`  | N, SE                                               | 6     |
| `straight` | N, S                                                | 3     |
| `nfork`    | NW, N, NE                                           | 6     |
| `lfork`    | N, S + SE (branch left, coming in from N)           | 6     |
| `rfork`    | N, S + SW (branch right)                            | 6     |
| `yfork`    | N, SE, SW                                           | 2     |
| `mfork`    | N, NE, SE, S                                        | 6     |
| `pfork`    | N, SE, S, SW                                        | 6     |
| `xfork`    | N, SE, S, NW                                        | 3     |
| `star5`    | all but S                                           | 6     |
| `star`     | all                                                 | 1     |

Any shape can also have a centre other than the plain crossing. A **hub** is
round: `start-4-hub` is a cul-de-sac, a river's `turn60-2-hub` is a lake on a
bend, and a road's `xfork-0-hub` is a roundabout. A **stub** is where the path
begins inside the hex and branches out (`turn120-5-stub`; a `start` has none).
Autotile never picks a stub by itself, since it marks a place: a map names one
in full, or a later rule picks it. Extra tiles of one shape in a folder take a
letter (`straight-0b`, `start-4b-hub`). The older `culdesac-k` reads as
`start-k-hub`.

One of a shape's own sides can be a **mouth**: the path opens across that
whole side instead of meeting its middle (`turn120-4-mouth0`, a river widening
into the sea at N). Where autotile runs a river into water, it asks for a tile
with a mouth on that side first and falls back to the plain shape.

The pack browser's **Classify** mode (path layer) assigns each tile a type and
slot, which lists it under that shape in `autotile:`. A coverage table shows
the shapes still missing a tile. Tiles named to the standard
(`pfork-3`) can be classified from their names in one click.

A mask with no tile in the table falls back to a drawn SVG stroke through the
side midpoints, and the tooltip names the missing mask. That keeps the path
visible and makes the gap easy to fill. Filling in the `basic` tables is
manual, visual work. The pack browser gets an "autotile" view that lists every
mask next to its tile.

## 8a. Land and water

The terrain layer has two sections, `terrain/land/` and `terrain/water/`, and a
hex is water when the tile it draws sits in `water/`. Coasts (`meets: [water]`),
rivers' mouths (`connectsTo: [water]`) and regions' coastlines all ask this.
Specs don't name the section: `forest[lush]` finds `land/forest/lush`,
`water[ocean]` the water section's `ocean`, and a folder in both (`basic`)
reads as one, so `basic[ocean]` is water and `basic[lush]` land. Tuning keeps
folder names (`terrains: { forest: … }`); `files:` keys are full paths
(`land/mountain/rocky/peak`). A pack without sections falls back to names
(`water`, `ocean`, `sea`, `lake`).

## 8b. Edges

Stacks split in two. **Props** (`stack/`: buildings, trees, pins) are placed
freely. **Edges** (`edge/`: coast pieces) lie along a hex's sides and lay
themselves. A pack's `edges:` family names the terrain it runs along, and each
hex's sides facing it are covered by **runs**: `run1` … `run5` neighbouring
sides, and `ring` for all six. Odd runs point at their middle side and even
ones start at their first side clockwise, as paths do. A run with no piece of
its own length is laid from shorter ones (four sides: `run3` + `run1`).

```yaml
edges:
  coast:
    meets: [water] # terrain bases it runs along
    on: inside # on the water hex (the default); `outside` puts it on the land
    tiles:
      run3-0: coast/run3-0
      run1-4: coast/run1-4
```

`e(q,r): coast[run1-0]` places a piece by hand. Classify works on the edge
layer with the run catalogue (no centre or mouth).

## 8c. Bases (built 2026-10-16)

A **base** is the body under a hex's top face: the slab that makes a flat hex
read as a solid tile, and that shows height when hexes stand at different
levels. Most `basic` terrain art has one baked in. The `base` layer exists to
**override** it, and to make height groups (`0m:`, `100m:` …) visible: a
plateau shows its cliff where it meets lower ground.

**A fifth layer, `base`, with its own folder and its own tab in settings.**

```
basic/
└── base/                 # bases only, no subfolders
    ├── level.webp        # moved from terrain/basic/level
    └── rocky.webp        # moved from terrain/basic/rocky; rocky-1.webp … are variants
```

- `Layer` is `"base" | "terrain" | "edge" | "path" | "stack"`. **A base draws
  right after its own hex's terrain, row by row** (changed 2026-10-16 at the
  user's ask; it first drew under all terrain). So it covers the slab baked
  into the terrain art without editing every tile, and the next row's faces
  cover the part that hangs over them. Base art must therefore be slab only,
  with a transparent face, or it hides the terrain. `hides` (below) is still
  there for art whose baked slab sticks out past the base.
- **Bases sit in the base folder itself** (the only layer whose tiles may) and
  are named by file: `rocky` picks `rocky.webp`, or one of `rocky-0`,
  `rocky-1` … at random per hex, and `rocky[1]` the second. A spec first looks
  for a folder of that name, as on every layer, so folders still work; the
  layer's own files are the fallback. (Changed 2026-10-16 at the user's ask:
  first built as `base/basic/…` with `basic[level]` specs, which read as the
  `basic` pack.)
- The pack browser has a **base** tab next to the others, with a `base/` entry
  for those files, thumbnails, 7-hex preview, tuning and "Name it".

**Moving tiles between layers from settings.** The File panel has **Move to
layer** with **Move this tile** and **Move folder “…”**. Files keep their path
below the layer (`moveTiles` in `hex-pack-files.ts`), except **into base,
where only the file name is kept** (`terrain/basic/level` → `base/level`), and
a base moved out goes into a `bases/` folder. Two files landing on one name
refuse the move. `pack.yml` follows through a `tile-move` edit: `files:`
tuning keys move to the new layer's prefix (`"basic/level"` →
`"base/level"`), a top folder's `terrains:` tuning goes with it (not into base,
where there are no folders), and the old layer's autotile or edge tables
drop the moved tiles. Catalog entries stay; the notice lists the ones that
named the folder, since they now pick from the new layer. Same guards as
rename: no unsaved draft, nothing overwritten (the whole move is refused
first), `pack.yml.bak` first. A folder left empty is removed. The browser
follows the files to their new layer.

**Tuning.**

| Key     | Where                         | Meaning                                                                                                                                                                   |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `step`  | Whole pack (`defaults:`) only | Image pixels, in the whole pack's `hexWidth`, of one height step. Unset: 8 % of the hex width (`DEFAULT_STEP`; `basic` measures 7–9 %).                                   |
| `hides` | Terrain, any level            | `true` on terrain art with a base baked in. Where the hex gets a base, the tile is cropped to its face so the two don't both show. In the browser: "Has a base drawn in". |

`step` is pack-wide because the lift has to be the same on every hex, and tiles
have different hex widths (`basic`'s base pieces are 115 px, the pack 477), so
a per-tile step would be in different pixels each time. A base's slabs repeat
one step apart, so base art is lined up with the usual `hexWidth`, zoom and
offsets. (The design's `top` key turned out to be `offsetY`, so it was
dropped.) Height variants (`rocky[2]` for a two-step slab) aren't automatic;
write them as the spec if a pack has them.

**Choosing a hex's base, most specific wins:**

1. `b(q,r): rocky` on a hex (one per hex: a later line replaces it).
2. The height group: `100m: base=rocky` on the group's header line.
3. The pack: `base: level` at the top of `pack.yml`.
4. None: the terrain's own art. A raised hex then repeats its tile a step
   lower per extra step it stands above its lowest front neighbour, each copy
   clipped to below the face's centre, so only the baked-in slab shows and the
   hex stands on a cliff rather than floating (added 2026-10-20). Flat
   (`clip`) textures and `xN` lines don't repeat.

A missing base tile is reported once per line (or once per spec, for a group's
or the pack's base), and that hex draws without one.

**Drawing.** Each step (the map's `step:`, 100 m by default) **lifts** a hex,
and everything on it, by the pack's step; the hover outline, labels and
coordinates go with it, and pointing at a raised face finds that hex (`hexAt`).
Region outlines stay on the grid. A hex with a base gets **one slab per step it
stands above its lowest front neighbour** (SW, S, SE; a missing one counts as
0 m), at least one, stacked downwards with the lowest drawn first. Every other
slab (the 2nd, 4th …) is mirrored left to right about the hex's centre, which
a flat-top hex allows, so a tall cliff doesn't show one image repeating. Slabs facing
a neighbour at the same level are covered by that neighbour's face, so the edge
of each height group shows by itself.

**How tall a step is (settled 2026-10-16).** Measured from `basic`'s art,
the slab is about **9–10 % of the hex's flat-to-flat size**: 35 px under a
413 px face on `plains/lush/clean`, and 10 px under a 100 px face on
`basic/level`. So metres per step follow the map's `scale:` (the
flat-to-flat size of one hex):

| Hex size                                                     | One slab, to scale |
| ------------------------------------------------------------ | ------------------ |
| 30 mi                                                        | about 4.4 km       |
| 5 mi                                                         | about 730 m        |
| 1 mi (really 5/6 mi, 1 341 m: six of them span a 5-mile hex) | about 120 m        |

The smallest scale is the one where height is drawn, so **one step is 100 m**,
which is also the editor's `100m:` group convention. A `step: 100 m` header key
overrides it (`m`, `km`, `ft` and `mi` are read). A height group's level
divided by the step, rounded, gives its steps (`300m:` over `0m:` is three
steps of slab).

**The preview's raised hex.** On the base and terrain tabs the 7-hex
preview's middle hex stands one step up, with a slider (0 to 5 steps) under
it. On the base tab every preview hex gets the selected base. The slider is
only for viewing; it isn't saved.

## 8d. Labels (built 2026-10-16)

A **label** is a title banner with text on it, put anywhere on the map and
grown to fit its text. The art comes cut in slices, so a banner of any length
can be put together from them.

**A sixth layer, `label`, one folder per banner (a family):**

```
basic/label/
├── title-1/   left · fill-left · centre · fill-right · right
└── title-2/   left · fill · right        (… title-6)
```

Each file is named for its **role** (`labels.ts`):

| Role                      | What it is                                                 | Drawn                                  |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| `left`, `right`           | End caps                                                   | Once                                   |
| `centre`                  | A fixed middle, such as an ornament (title-1's winged gem) | Once, always in the middle             |
| `fill`                    | The plain strip                                            | **Repeats**, on both sides of a centre |
| `fill-left`, `fill-right` | The strip when the two sides differ                        | **Repeat**                             |

**The rule: a role starting with `fill` repeats, and nothing else does.** More
art for one role takes a number or letter (`fill-2`, `fillb`), picked by seed
per slot. Files with no role are never drawn.

**Growing from the middle.** The text is measured (a canvas, in the banner
font) and the banner gets as few strips as fit it, plus half an em of room
each side: `left + fill × n + right`, or with a centre
`left + fill-left × n + centre + fill-right × n + right`, one strip per side at
a time, so the centre stays put. Whole strips only: the text is centred in its
box, and nothing is stretched. Each seam overlaps by `overlap` px (2 by default)
to hide hand-drawn joins.

There are no finished banners. The pack's `small` and `long` pictures were
pixel for pixel the slices with one and two strips (title-4: 276 + 205 + 248 =
729 = `small`), so growing already gives them. Picking one when the text fit
made banners jump in size, and their own heights (title-2's `small` is 267 px
against 249) drew thicker frames. They were deleted on 2026-10-16.

**`pack.yml`:** each family's text box, as one-liners:

```yaml
labels:
  title-1: { inset: [125, 60, 55, 75], size: 0.28, color: "#2b2118" }
```

`inset` is top, right, bottom, left, in the banner's own pixels, from each edge
to where the text may go. Unset: a quarter of each cap and an eighth of the height. `size` is the
text height as a share of the banner's height (0.3). `font` is a CSS font
family (Georgia by default).

**On the map:** an `l` line, with fractional axial coordinates so a label can
sit between hexes:

```
l(1.5,-0.5): (The Sunken Coast) title-1 size=1.2 rot=-4
l(0,2): (Featherbark) title-5 [[Holy City of Featherbark]]
l(6,1): (Ford) title-3 #3a2410
```

`(Text)` or a `[[Note]]` (its name is the text); the family (the pack's first
if none is given); `size=`
(banner height in units of 1.1 hex radii); `rot=` (degrees); `#colour` (text).
Labels draw over everything. A linked label opens its note on click and gives
the page preview on hover. A family the pack doesn't have draws a plain tag
and reports the line.

**In settings:** the pack browser has a **label** tab. The preview shows a
sample text (editable) on the chosen family. **Classify** works as on paths: each
piece shows its role as a badge; pick one, then its role from buttons that
show where it sits in the banner. That renames the file and moves on to the
next piece with no role. A coverage strip shows which roles the family has. It can also name a whole folder
from imported names (`Title Banner 1 (flex) left extension` → `fill-left`; a
`mid` is `centre` when the banner has extensions, else `fill`). The **Text on
…** panel edits `labels:`.

**Converted on 2026-10-16:** `basic/stack/title_banner/` (32 files) was moved
to `basic/label/title-1` … `title-6` with role names, and each family got a
measured text box. Backup: `tmp/backup/title_banner-2026-10-16.tgz`.

### Lettering (built 2026-10-18)

Names drawn as text alone, as the user letters maps in Affinity: no banner,
a typeface of the pack's own, bent along an arc.

- **A style in `labels:` with no folder:**
  `realm: { lettering: true, font: Bookmania, weight: black, color: "#141414", halo: "#f3efe2" }`.
  `weight` is a number or a name (`regular`, `semibold`, `bold`, `black`);
  `italic`, `halo` (a colour round the letters, so they read over tiles) and
  `spacing` (ems) are optional. It lists with the banner families in the label
  palette and reads in `l(q,r)` lines like one: `l(-3,2.9): (Dunlind) realm
[[Dunlind]] size=2.9 rot=-3 arc=22`.
- **`arc=`** bends the text along a circular arc of that many degrees,
  positive bowing up (`arcPath` in `labels.ts`); the text keeps its length
  along the bend. `size=1` is letters 0.66 hex radii tall.
- **Fonts come with the pack:** every `.ttf`, `.otf` or `.woff2` in its
  `fonts/` folder is registered by its name (`Bookmania-Black Italic.ttf` →
  Bookmania, 900, italic: `fontFaceOf`), so a map looks the same on any device
  the vault syncs to. Open maps redraw when the fonts are in, so labels are
  measured in the real letters. `basic` carries Bookmania (Regular, Semibold,
  Bold, Black, and two italics), the user's own font.
- **`label: false`** on a region drops its outline's name, for maps that
  letter it themselves.
- **Not yet:** marker captions (town names) stay in the system font, and the
  settings pack browser doesn't list or edit lettering styles (edit
  `pack.yml`).

## 8e. Markers (built 2026-10-16)

A **marker** is a pin, flag, pedestal or icon standing on a point of the
map: a special place, a note, where a character is. Markers draw over the map
and **under labels** (the user's choice), so a title stays readable.

**A seventh layer, `marker`: a folder per style, a file per mark** (`markers.ts`):

```
basic/marker/
├── pedestal-gold/   blank cave coins house paw-round paw-sharp party-1 party-2 ruins skull star swords tent tower
├── pedestal-wood/   (the same)       signpost/   (no party marks)
├── here/  here-gold/  here-gray/  here-green/  here-red/   ("You're Here" drops; no party marks)
├── pin/  pin-large/   blue green red white yellow
├── flag-1/ … flag-6/  black blank blue red white
├── icon/  sticker/    the symbols alone (tower-2 too)
└── party/             1 2   (party figures, their own style: the user's choice)
```

A **style** is the holder and a **mark** is what it shows, a symbol or a
colour. Symbols are named the same in every style, so `here-red[skull]`,
`pedestal-wood[skull]` and `icon[skull]` show one symbol three ways. A marker
spec is any tile spec (`pin[red]`, a catalog name).

**On the map:** `m(q,r)`, with fractional coordinates as for labels. The
tokens can come in any order:

```
m(1,1):     pedestal-gold[tower] (Featherbark) [[Holy City of Featherbark]]
m(2.5,1.5): pedestal-wood[party-1] (Elara)
m(2.5,1.5): pin[red] (Thorne) size=0.8
```

- **Standing on its point.** The picture's **anchor** sits on the spot: a pin's
  tip, a pole's foot. The default is bottom centre (`[0.5, 0.96]`). Icons and
  stickers are centred, and flags stand on their pole on the left.
- **Caption.** `(Name)` is drawn under the marker. Captions draw after every
  picture, so a neighbouring marker never hides one.
- **Link.** `[[Note]]` makes the marker clickable, with the page preview on
  hover.
- **Fanning out.** Markers on one spot spread sideways, centred on it, each
  taking the width of its picture or caption, whichever is wider.
- **Missing.** A spec the pack doesn't have draws a plain red pin and reports
  the line.

**`pack.yml`:** each style's anchor (shares of width and height) and size:

```yaml
markers:
  flag-2: { anchor: [0.07, 0.97] }
  icon: { anchor: [0.5, 0.5], size: 0.7 }
```

**In settings:** the pack browser has a **marker** tab. Its preview stands the
selection on the middle hex with a sample name, with a dot on its anchor. The
**Marker “…”** panel edits the anchor and size. A folder of imported names
(`Pins - Pedestal, gold (tower)`) offers **Sort them into style folders**, by
`markerPathFromName`. To sort another pack's pins, move their folder to the
marker layer first.

**Converted on 2026-10-16:** `basic/stack/{pins,banner,icon}` (155 files) was
moved to `marker/` by that mapping, with no collisions. Anchors and sizes were
measured from the art. Backup: `tmp/backup/markers-stack-2026-10-16.tgz`.

**Later:** moving character markers from the session log (the party's
position), as part of phase 5's hex travel.

## 9. Testing and verification

- **Vitest (pure):** the editor's whole grammar (each form, height groups,
  legacy CSV, empty hexes, editor bodies pasted with `title:` / `pack:`);
  additions (`[[Note]]`, `@Region`, `xN`, `(qualifier)`, catalog ids); error
  line numbers; axial neighbours; `selectTile` on a fake index; the `pack.yml`
  cascade; side masks; region boundary loops (a hole, two islands, a single
  hex); the z-order sort matches the editor's.
- **Parity check:** render the editor's own example map (from
  `generateExampleHexmap`) in both the editor and the plugin and compare
  screenshots.
- **Visual:** a static SVG from a vitest probe, rasterised with `qlmanage -t`;
  then live with `rpg-dev compile-html` / `css-report` on
  `Sandbox/Tests/NN-TEST-HEXMAP.md` in `testing-vault`, with Obsidian frontmost.
- **Detector sweep:** `grid: hex` blocks detect as `map`, with no new false
  positives.

## 10. Build order

| Phase                                   | Delivers                                                                                                                                                                                         | Done when                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **0. Pack in the vault**                | `cli/import-hex-pack.mjs`; `basic` + `svg` copied to `z52. Hex Packs/`; merged `pack.yml`; `HexPackIndex` + `selectTile` (tested); `flat` pack                                                   | The index lists both packs with the right counts in a probe                                                                       |
| **1. Translator: block → map view**     | `grid: hex` branch; the editor's full grammar; SVG renderer with tiles and the editor's z-order; labels; coordinates; errors; pan/zoom; hover tooltip; a docs page; an example note              | The editor's example map renders the same in Obsidian and inside a `.bare()` embed; perf measured                                 |
| **2. Settings**                         | Packs folder, rescan, default pack, pack browser, catalog editor, tuning with the 7-hex preview (saving `pack.yml`), grid style; live re-render                                                  | Editing a zoom or catalog entry updates an open map without reload                                                                |
| **3. Overworld content**                | `[[Note]]` places with page preview, `xN` scatter, `@Region` + `regions:` outlines, tints, labels, hex and coast counts                                                                          | One real realm (`Dunlind`) mapped with its villages linked                                                                        |
| **4. Autotiled paths**                  | Side masks, `autotile:` tables for `basic` roads / rivers / walls, fallback stroke, autotile view                                                                                                | A road and a river crossing it render with no gaps                                                                                |
| **4b. Bases** (§8c, built 2026-10-16)   | `base` layer and settings tab; "Move to layer…" with `pack.yml` following; `step` / `hides` tuning; height lift; `b(q,r)`, `Nm: base=` and pack `base:`; front-side drawing by height difference | `level` and `rocky` moved to `base/` from settings; a 100m group over 0m ground shows a rocky cliff only on its lower front sides |
| **4c. Labels** (§8d, built 2026-10-16)  | `label` layer; role-named slices; banners grown from the middle to fit text; `l(q,r)` lines with fractional coords, size, rotation, links; `labels:` text box; Classify by role in settings      | `title_banner` moved to `label/title-1…6`; every family renders with short and long text                                          |
| **4d. Markers** (§8e, built 2026-10-16) | `marker` layer (style/mark); `m(q,r)` with anchor, caption, link, fan-out, size; `markers:` tuning; settings tab with anchor dot and sort-by-name                                                | `stack/{pins,banner,icon}` moved to `marker/`; places, characters on one spot and a label over them render in the test note       |
| **5. Editing on the map** (§13)         | 5a paint mode writing lines back; 5b per-hex looks (`size=`, `shift=`, `hue=`, `sat=`); 5c stamps (`stamps:` + `stamp(q,r)`); 5d lasso and box select; 5e reference underlay                     | A realm is painted on screen, with a stamp placed twice, and its block still reads like a typed one                               |
| **6. Later**                            | Hex travel in session logs (party at `(q,r)`, explored hexes); hex battle maps; PNG / Foundry export                                                                                             | Each one is designed separately when it's picked up                                                                               |

## 11. Differences from `plan.md` Part 8

- Part 8 put hex maps under combat, with tokens. Here they are **overworld**
  first; tokens and combat on hex are phase 5.
- Part 8 put the body straight after the info string. Here a `grid: hex` header
  and `---` come first, for the reload detector. The editor syntax below the
  `---` is unchanged.
- Part 8's tiles setting (`Tiles/hex/<pack>/<terrain>.svg`, one file per
  terrain, with a grid-type folder level) is replaced by the pack-first layout,
  `pack.yml` catalog and tuning, and the `z52. Hex Packs` default.

## 12. Decisions (2026-10-15)

| #   | Question               | Decision                                                                                                                                                    |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Coordinates            | Axial `(q, r)`: it's a hex map. Chessboard style stays for square battle maps only.                                                                         |
| D2  | How terrain is written | As in the editor: per-hex `t/s/p(q,r)` lines with `Nm:` height groups. Additions are tokens on those lines (§3.2).                                          |
| D3  | Packs                  | Start with the editor's third-party pack (`basic`, plus `svg`), copied into a vault folder. The folder is a plugin setting, defaulting to `z52. Hex Packs`. |
| D4  | Catalog and tuning     | In each pack's `pack.yml`. The settings UI edits that file.                                                                                                 |
| D5  | Block                  | `rpg map` with `grid: hex`.                                                                                                                                 |

## 13. Phase 5 — editing on the map (design 2026-10-16)

> **Built 2026-10-16:** 5a–5e and §13.7. The code lives in `edit-hex-map.ts` (line
> edits), `fence-text.ts` (finding the block in its note), `palette.ts`,
> `stamps.ts`, `area.ts`, `detail.ts`, `lib/services/hex-atlas.ts`, the paint UI
> (`hex-paint-bar.tsx`, `hex-paint-panels.tsx`) and `render-hex-map-block.tsx`.
> The UI follows the session log's look: segmented radio tools and layers,
> Lucide icons, a palette sidebar with small-caps sections, and a status line.
> Test notes are `Sandbox/Tests/44-TEST-HEXMAP-PAINT` and `44b-…-DETAIL`. It was
> checked offline (an HTML render with the real tiles, screenshotted in headless
> Chrome), but not yet clicked through live. Not built: the stamps tab in the
> settings pack browser. Stamps are listed, previewed and deleted in paint mode's
> sidebar instead.
>
> **2026-10-17:** stamps became custom tiles with a tile builder (§13.3). The palette
> shows at most 8 named tiles. It was tested in a browser harness
> (`tmp/harness/`: the real `HexMapBlock`, the real pack over localhost, an
> in-memory stand-in for Obsidian's vault that remounts blocks on a write),
> driving real pointer sequences: paint and stroke, undo and redo, lasso, select,
> builder save, custom tile paint and Expand, Look drag and slider, erase, height,
> region, marker, label, pick, and the detail map. That turned up and fixed: an
> effect returning a non-function (it crashed `unmount`, which blanked the
> preview in Obsidian), theme `h4` styles taking over sidebar headings, the
> selection staying on screen outside Select, and detail maps not framed on
> their parent hex.

Adapted from [hexmapper](https://github.com/Ahmed-Sadeq-Hussein/hexmapper)
(Apache-2.0: a canvas map editor plus a stamp creator, built on the same
2-Minute Tabletop art as `basic`). It is adapted to this plugin's rules, not
copied over:

- **The note is the save.** Every edit rewrites lines in the block; there are no
  browser save slots or JSON project files. Lines stay hand-editable, and a map
  painted on screen reads the same as one typed.
- **Edits touch as little as they can.** Painting terrain swaps only the spec
  on the hex's `t` line, and keeps its `(Label)`, `[[Note]]`, `@Region`, colour
  and comment. New lines go into the right `Nm:` height group, written the way
  that group's lines already are (`  * t(q,r): …`).
- **It covers every layer the map has now**, not hexmapper's three:

| Layer   | Brush writes                                 | Notes                                                                                                                |
| ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| terrain | `t(q,r): spec`, replacing the spec           | Palette shows `land/` and `water/` sections; coasts lay themselves (§8b)                                             |
| base    | `b(q,r): spec`                               | Or the height brush, which uses the group's `base=` (§8c)                                                            |
| edge    | `e(q,r): spec`                               | Manual pieces only; coasts along water need no painting                                                              |
| path    | `p(q,r): roads` (the family)                 | Joins up by itself (§8), replacing hexmapper's manual rotation and auto-connect; exact pieces are in the palette too |
| stack   | `s(q,r): spec`                               | A second click with the same spec adds a copy (`x2`, `x3`)                                                           |
| marker  | `m(q,r): style[mark]` at the clicked point   | Fractional coordinates (§8e); asks for the caption                                                                   |
| label   | `l(q,r): (Text) family` at the clicked point | Asks for the text (§8d)                                                                                              |

- **Height brush**: moves the hex's lines into the chosen `Nm:` group, creating
  the group if needed. Its base and cliffs then show by themselves (§8c).
- **Region brush**: adds or removes `@Region` on the hex's terrain line.

### 13.1 Phase 5a — paint mode (adapting what's there)

- **✎ in the map's controls** toggles paint mode. A toolbar appears above the
  map: layer tabs, tools (paint, erase, eyedropper, region, height), the height
  for new hexes, and a palette.
- **The palette** is built from the pack: catalog names first (each under the
  layer its spec resolves in), then the folder tree with thumbnails, the same
  folders the settings browser shows. Picking a folder paints random variants
  seeded per hex, which is hexmapper's "randomize variant", already built in.
- **Mouse:** click or drag paints. Right-click erases the top item on the active
  layer. Alt-click is the eyedropper. Space-drag or middle-drag pans, and the
  zoom keeps working as before.
- **Writing:** a stroke is drawn straight away from an in-memory copy of the
  block, then written to the note when the mouse is released. The fence is found
  by its text, so `.bare()` embeds of other notes get a notice instead of a
  wrong write.
- **Undo:** Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z step through the block's earlier
  text during the session. Writing re-renders the block, so tool, brush, view
  and undo history are kept per map, and survive the re-render.

### 13.2 Phase 5b — how each hex looks (hexmapper's Move/Size tool)

New tokens on `t`, `b`, `s` and `p` lines: `size=1.6` (scale around the hex
centre, 0.4–5), `shift=0.1,-0.2` (in hex widths), `hue=40` (degrees) and
`sat=0.6`. Hue and saturation are an SVG `feColorMatrix`, shared by every tile
with the same values. In paint mode, a **Look** tool selects a hex and shows
sliders that edit the tokens.

**Tinting edges and paths (2026-10-20).** `bright=1.2` (a brightness
multiplier) joins `hue=` and `sat=`, and `e` lines take looks too. A coast that
lays itself has no line, so `e(q,r): hue=30 sat=0.6` (an `e` line without a
tile) colours the hex's own coast without replacing it. The coast takes only
that line's look, never its terrain line's, so a resized or shifted water tile
no longer drags its shore along. With the **Select** tool on the Edge or Path
layer, a **Tint** section under Selection sets one hue, saturation and
brightness on every selected hex that has them: path lines and hand-placed
edges are recoloured where they are, and laid coasts get a tint line (dropped
again when reset). Erase passes over a tint line.

### 13.3 Phase 5c — custom tiles and the tile builder (revised 2026-10-17)

The user found "stamps" unclear and wanted a **tile builder**, so a stamp is now a
**custom tile**: hexmapper's Stamp Creator, in the plugin.

- **The tile builder** is a window with the full paint editor on a scratch map.
  You paint one hex (or a few around the origin (0,0), which is marked) from the
  pack's art on any layer, size, shift or recolour pieces with Look, name it, and
  Save writes it to the pack. It opens from the palette's **Custom tiles → + new**
  and a tile's edit button, from **Select → Make a custom tile**, which starts
  with the selected hexes, and from **Settings → Hex maps → Custom tiles**.
- **In `pack.yml`:** `custom: { wooded-hill: ["t(0,0): hills", "s(0,0): foliage"] }`.
  The lines are quoted and keep height groups. An older `stamps:` is still read.
- **On a map:** `c(q,r): wooded-hill rot=2`. `stamp(q,r)` still reads. The tile is
  expanded while the map is read, so editing it updates every map. The map's own
  terrain and base win, and paths join up with what's around them.
- **Painting one:** it's first in the palette, and picking it puts its preview in
  the brush, with turn buttons (R / Shift+R). A one-hex tile paints like terrain:
  one per hex as you drag, and a different one replaces it. A set of several
  hexes goes down once per click. **Expand** turns one on the map into its own
  lines.
- **Named tiles** in the palette are capped at **8**: the ones the map already uses
  come first, and "+N more" or the filter shows the rest.

### 13.4 Phase 5d — area tools

- **Lasso fill:** a freehand loop paints every hex whose centre is inside, using
  hexmapper's point-in-polygon test.
- **Box select:** feeds Save as stamp, region tagging, and erase or fill of an
  area.

### 13.5 Phase 5e — reference underlay

`underlay: { image: "[[Realm sketch.jpg]]", opacity: 0.45, width: 30, at: [0, 0] }`
in the header draws a picture under the tiles to trace over (`width` in hex
widths, `at` its top-left hex). In paint mode, sliders write these values, and
a toggle can draw it on top.

### 13.6 Later, or not taken

- **Later:** PNG export of a map or selection, Foundry VTT scene JSON (grid size
  = hex height for flat-top hexes, per hexmapper), and an average-colour overview
  for very large maps. Hex travel and hex battles are still separate designs.
- **Not taken:** the folder picker and DPI de-duplication (packs live in the
  vault), browser save states and autosave (the note is the save), manual river
  rotation and auto-connect (autotile replaces them), and the stress test.

### 13.7 Three hex sizes: detail maps (design 2026-10-16)

The user maps at three sizes, each six times finer than the last, measured
across the flats (top to bottom on a flat-top hex):

| Size                            | Hex (flat to flat) | Six of them span               |
| ------------------------------- | ------------------ | ------------------------------ |
| 30 mi                           | 30 mi              | —                              |
| 5 mi                            | 5 mi               | one 30-mile hex, top to bottom |
| 1 mi (really 5/6 mi, ≈ 1.34 km) | 1 mi               | one 5-mile hex, top to bottom  |

**The geometry is exact.** A hex six times smaller has `R/6`, and on axial
coordinates the centre of hex `(q, r)` is `(1.5Rq, √3R(r + q/2))`, so the fine
hex `(6q, 6r)` sits exactly on the centre of the coarse hex `(q, r)`. A detail
map's coordinates are the parent's times the ratio, so a detail map can cover
one parent hex or a whole realm, and its coordinates line up with any other
detail of the same parent.

**The header:**

```yaml
grid: hex
scale: 5 mi # also "1 mi", "5/6 mi", "1340 m"
of: "[[Caulkin coast]]" # the coarser map this one details (its first hex map)
at: [3, 2] # optional: this map's (0,0) is the parent's hex (3,2)
```

- **Ratio:** the parent's `scale` over this map's, rounded (30 / 5 = 6). It falls
  back to 6 when either is missing.
- **`at`:** makes local coordinates (`t(0,0)` is the middle of the parent hex).
  Without `at`, the coordinates are global: the parent hex `(q, r)` is centred on
  `(6q, 6r)`.

**What a detail map shows:**

- **The parent underneath:** the parent's tiles, scaled six times and faded,
  under this map's own. So you paint 5-mile detail over the 30-mile hex and
  keep its forests and coasts in place. There is a toggle in the paint bar, and
  `parent: off | faint | grid` in the header.
- **The parent's grid:** heavier outlines of the parent hexes, with their
  coordinates, so you can see where one 30-mile hex ends.
- **In paint mode,** empty hexes to paint into fill the parent hexes the map
  covers, not just a ring around what's painted.

**From the coarse map:**

- **Detail this hex** (paint bar, with a hex selected) makes a new note,
  `<Map title> (q,r) 5 mi`, with the header above and `at: [q, r]`, and opens
  it. From a 5-mile map it does the same at 1 mi.
- **Hexes with a detail map** get a small corner mark, and in view mode,
  Ctrl/Cmd-clicking one opens it. The vault's detail maps are found once by
  reading notes with `rpg map` blocks that have `of:`, then kept up to date as
  notes change.

### 13.8 Detail maps in the same block (built 2026-10-17, replaced by §13.9)

Blocks used to keep one `detail(q,r):` section per coarse hex, in that hex's own
coordinates. A detail covers an area, not a hex, so §13.9 replaced them with one
layer per level. Older blocks are still read: `migrateDetails` moves each section
into its level at its global place, and the next save writes it that way.
Sections split out to a note (`detail(2,0): [[Note]]`) are dropped, since that
note's `of:` places it.

### 13.9 Levels: one canvas, three sizes (built 2026-10-20)

**The idea.** A detail map is a finer map of an area, lined up with the coarser
one, not a set of per-hex sections. You paint it seeing the whole coarser map
underneath, and you get there by zooming.

```
---
0m:
  * t(1,0): plains @Dunlind
level 1:                      # 5 mi: the main map six times finer
  * t(6,0): plains            # (6q, 6r) is the middle of the 30-mile hex (q, r)
  * t(7,-1): forest           # a hex on a 30-mile border is the level's, not either side's
level 2:                      # 1 mi (called so: six to a 5-mile hex)
  * t(36,0): urban[lush][hamlet]
```

- **Sections.** `level 1:` and `level 2:` after the main map, each one layer in
  global coordinates. Each step is always 6× (flat to flat). The miles are only a
  label: each level's scale is the main map's divided by 6 per level. The
  header (pack, regions, `parent:`) is shared.
- **Semantic zoom.** One canvas. Zooming far enough in (a hex wider than
  240 px) shows the level below, and zooming far out (a fine hex narrower than
  22 px) the level above, with the view kept in place. The breadcrumb
  (`Rindelbran · 30 mi › 5 mi › 1 mi`) and Scale → Level jump directly. In Build
  and Mark you can always go down; in Play only where there's detail.
- **Whole parent.** At a level, the whole level above is drawn underneath, six
  times larger and faded: its imports too (a realm built of duchies shows its
  duchies), with its grid and coordinates. Two levels down (1 mi), the main map
  is drawn under that too, so the 30-mile hexes show where the 5-mile level has
  none; the fine grid covers both. The coarse hex being worked in is
  outlined. The level's empty hexes are one tiled grid pattern over all of it,
  not thousands of polygons.
- **Seamless painting.** A stroke goes anywhere and crosses coarse borders.
  Everything is written into the level's section.
- **Starting a detail.** The first stroke (Paint, custom tile, Height, Fill) in a
  coarse hex, or Scale → **Detail** on a picked hex, fills that hex's _inner_
  fine hexes with its tile: terrain, base and height. Hexes across its border
  are left out. The fill is staged: dimmed in Build and not drawn in Play.
  **Done** writes the hexes still unpainted, as one undo step. A coarse hex whose
  inner hexes already have lines isn't filled.
- **Other notes.** Imports bring their own levels (`importsAtLevel`, offsets
  ×6 per level). Detail notes (`of:` this map or a map it imports, at 1/6 its
  scale) are found through the vault index and drawn, read-only, at the level
  below, placed by `at:` and the import chain. Their own levels go one level
  further down. Detail notes at other scales keep their ⊕ mark, which opens the
  note.
- **Marks.** A coarse hex with anything at the level below shows a small
  magnifier in its corner while the pointer is on it. Clicking it zooms in,
  framed on that hex.
- **Travel.** `[TRAVEL: [[Map]] (q,r)]` now means the level one down (the path's
  length is the depth). Its positions are in that level's global coordinates.
- **The code.** `levels.ts` (`levelView`, `spliceLevel`/`editLevel`,
  `innerHexesOf`, `fillHexes`, `withFill`, `importsAtLevel`, `viewAtLevel`,
  `migrateDetails`), `levelSections`/`mainEnd` in `parse-hex-map.ts`, and in
  `hex-map-view.tsx` the `levels`, `showView` and `gridArea` props (semantic
  zoom, the switch's view, the fine grid). The block has the level, fill and
  detail-note state. The test note is `Sandbox/Tests/44c-TEST-HEXMAP-INLINE-DETAIL`,
  checked in the browser harness on Rindelbran: zooming 30 → 5 → 30, Detail with
  its 31 inner hexes, a stroke, Done writing the fill.
- **Not yet:** splitting a level's area out to a note of its own (the old
  per-hex Split is gone); editing a detail note's hexes from its parent (they're
  read-only there).
- **Far art** is §13.10.

### 13.10 Far art: a level seen from above (built 2026-10-20)

**The idea.** Zoomed out, a 5-mile forest should read as trees on the 30-mile
hex, not vanish under it. Each coarse hex with detail below it is drawn as its
own tile, with its fine hexes over it at a sixth of the size. This happens at
every level (30 mi over 5 mi, 5 mi over 1 mi), one level down only.

- **What's drawn over a coarse hex.** Each fine hex whose terrain has far art is
  drawn as that art. A fine hex with none is drawn as its own tile, shrunk. A
  fine hex the same as its coarse hex (a fill left as it was) adds nothing and
  is left out, so a detail that only adds a wood shows a clean tile with trees
  on it. Fine hexes sit on their coarse hex's face, lifted with it, and their
  own heights are dropped. Faint imports' hexes stay faint. Fine hexes come
  from the level's own section, its imports' levels and detail notes, the same
  as when you zoom in.
- **`pack.yml`:**

  ```yaml
  far:
    forest:
      of: [forest, jungle] # the terrains it stands for: folder, base name or ground; else its name
      except: [swamp] # optional
      size: 1.2 # its tiles' width, as a share of the hex (1: the hex's)
      tiles: # in the pack's far/ folder, keyed like autotile: tables
        alone-0: forest/alone-0 # a hex with no neighbour of the family
        straight-0: [forest/straight-0, forest/straight-0b]
        star-0: forest/star-0 # every side joined: the middle of a wood
  ```

- **Joining.** A hex's shape is the sides facing a neighbour of the same family,
  named like paths' (`turn60-2`, `yfork-0`, `star-0`), plus `alone-0`. A shape
  with no tile is drawn from another slot of it, turned into place, as paths
  are. Failing that, the family's `star-0`, then its `alone-0`, stands in, so a
  family with one tile already draws. Tiles are picked by the hex's seed when
  several are listed. Placement tuning (`hexWidth`, `zoom`, offsets, `clip`)
  cascades as for other layers, keyed `far/<folder>`.
- **The pack manager.** `far` is a layer tab of its own, never painted on a map.
  Its top folders are families. **Classify** gives tiles their shapes (no
  centres or mouths) into `far:`, with the coverage table. The **Far art** panel
  previews seven hexes of the family joined (the middle one `star`, the ring
  three sides each) and one alone, and sets **Stands for** (`of:`) and **Size**.
  Tiles can be moved in from other layers (a stack's trees, say) with Move.
- **The code.** `far.ts` (`farFamilyOf`, `pickFarTile`, `resolveFar`,
  `farLayout`), `drawFar` in `draw-hex-map.ts`, `terrainAround` (split out of
  `resolveHexMap`), `FarFamily` and `readFar` in `packs.ts`, `ALONE` and
  `FAR_SHAPES` in `path-shapes.ts`, the `far` section and `far-set` edit in
  `pack-yml-edit.ts`, and `overTiles` on `HexMapView` (over the tiles, under
  labels and markers). It was checked in a harness copy (`tmp/harness-far`,
  port 8767) with stand-in art (stack trees and a hill) in an overlay folder, so
  the vault's pack isn't touched.
- **Art of its own** is made with the composer (§13.11).

### 13.11 The far art composer (built 2026-10-21)

**The idea.** Far art is made in the pack studio from sprites the pack already
has (stack props and terrain tiles), not drawn by hand 64 times. You place
sprites on a template hex, see all 64 variations with their neighbours at once,
and **Bake** writes one image per variation.

- **Where.** In the pack studio's **far** tab, under **Compose** (Browse,
  Classify, Compose). Pick a family folder on the left, or start a new one by
  name; its folder is made when it's baked.
- **The template.**
  - **Middle:** in every variation.
  - **Joined side:** drawn where the hex joins its neighbour across that side.
  - **Open side:** drawn where it doesn't.
  - A side's sprites are designed facing N and turned round to all six sides
    (**Every side**), or set for one side alone (N, NE…).
- **By hand.** **Just \<shape\>** edits one variation's own list. Its first
  change copies the template's sprites, and **Back to the template** drops it.
  Variations finished by hand are marked ✎ in the showcase.
- **The editor.** The big hex is drawn with the neighbours it joins, each as
  its own `start` variation facing back, so the seams show; what isn't being
  edited is dimmed. Pick a sprite, click to put it down, drag to move it, and
  scroll over it to size it (or use the slider). It can be mirrored, duplicated
  and removed. Sprites stand on their foot, and the one standing higher up the
  hex is drawn behind.
- **The showcase.** Every variation (alone, then each type's slots, a row per
  type), each with its neighbours. Clicking one shows it in the big hex.
- **Bake.** Writes `far/<family>/<shape>.webp` for all 64, each `canvas` hex
  widths square (1.5 by default, room to reach past the hex) at the pack's hex
  width with the hex's centre in the middle. It replaces the family's `tiles:`
  with them and saves `pack.yml`, recipe included. Sprites are drawn at their
  size on the map times their `s`.
- **`pack.yml`:**

  ```yaml
  far:
    forest:
      compose:
        sprites:
          - { src: "stack/foliage/Foliage - Tree, deciduous 3 (lush)", x: 0, y: 0.08, s: 1.5, zone: mid }
          - { src: "stack/foliage/Foliage - Tree, deciduous 3 (lush)", x: 0.05, y: -0.3, s: 1.5, zone: "*+" }
        shapes:
          straight-0: [{ src: …, x: 0, y: 0, s: 2 }]
      tiles: { alone-0: forest/alone-0, … }
  ```

  `x`, `y` are in hex widths from the centre (y down); zones are `mid`, `*+`,
  `*-`, `N+` … `NW-`.

- **Seeing it in place** (2026-10-22). The land tiles the family stands for
  (`of:`) are listed above the editor, lush first. The one picked is drawn
  under every hex of the cluster, so the far sprites can be matched to the
  5-mile art. **On the 30-mile map** draws seven 30-mile hexes of a chosen
  land tile with the far art on them at a sixth of the size: a wood in the
  middle hex running out into the NE one, and one 5-mile hex alone in the SW
  one, each variation picked by its neighbours as the map will pick it.
- **Less clutter** (2026-10-22). A picked sprite goes down once (Shift keeps
  it for more), so clicks don't pile up copies. The joined neighbours'
  sprites are hidden unless **Neighbours' sprites** is ticked. Sprites from
  other zones are greyed. The sprites being edited are listed, each with ×.
- **Sections at the pack's top** (2026-10-22). A pack's terrain sections can
  sit beside its other layers (`basic/land/…`, `basic/water/…`) instead of under
  `terrain/`; `basic` was moved so. They read as the terrain layer with the
  same paths below it (`land/forest/lush/conifer-0`), so specs, `pack.yml`
  keys and tile lists don't change. File work finds them with `layerDir`.
- **The map editor's Land and Water** (2026-10-22). The paint toolbar's
  Terrain is two layer buttons, Land and Water, each opening its section's
  folders and showing only the catalog names whose tiles are in it.
- **Land and water tabs.** The studio's terrain tab is split into **land** and
  **water**, each showing its section's folders. The files stay in
  `terrain/land` and `terrain/water`, so specs are unchanged.
- **The code.** `far-compose.ts` (the recipe, zones, `templateSprites`,
  `spritesFor`, `farVariations`), `far-bake.ts` (canvas → WebP),
  `far-composer.tsx`, `far-compose` and `far-baked` edits in `pack-yml-edit.ts`.
  It was checked in `tmp/harness-far` (the studio with `?studio`): composing on
  `forest`, the showcase, and baking all 64.

## 14. Modes: Play, Mark, Build (built 2026-10-17)

A map block has three modes, switched in its corner and at the start of the
editor's toolbar. Each map remembers its mode, and a note opens in **Play**.

| Mode      | For                | Tools                                                            | Layers and sidebar                                                                  |
| --------- | ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Play**  | Trying the map out | Move pieces, Measure; Trail, Fog, Reset                          | A strip along the map's foot; ⊕ zooms into details                                  |
| **Mark**  | Notes on the world | Place, Edit, Move (Shift: onto a hex's middle), Erase, Pick, Pan | Markers and labels, caption or text                                                 |
| **Build** | Shaping the world  | Paint, Erase, Fill, Select, Pick, Look, Region, Height, Pan      | Terrain, base, edge, path, stack; custom tiles; scale and detail; reference picture |

**Edit** (built 2026-10-18) changes what's already placed. Clicking anywhere on
a marker's picture or inside a label's box (turned with it) selects it, either
layer, and a drag moves it. The sidebar then holds its fields instead of the
brush and palette: a marker's style, caption, note, size and piece; a label's
text, style (with the pack's lettering styles and banners to choose from),
note, size, turn, bend and colour. Each change is written to the line as it's
made (the `content` edit keeps the point and any comment) and is one undo
step; **Remove** drops the line. `point-lines.ts` writes the fields back with
defaults left out, so an edited line reads like a typed one. Imported markers
and labels can't be selected: they're edited on their own map.

**Saving on Done** (2026-10-19). Writing to the note re-renders the block,
which interrupted work mid-edit, so changes are now held in the editor and
written once: on Done (shown as "Save & done", accented, while anything is
waiting), on switching to Play, when the block goes away (leaving the note, a
re-render for another reason) and when the window closes. The status bar says
"Not saved yet" meanwhile. Undo and redo work on the held text as before.

**Room to work, and no stray links** (built 2026-10-18). In Mark and Build the
block spreads into the page's margins by up to 24rem, half each side, as the
log block does with its sidebar open (`use-margin-spill.ts` measures the room
the note's view leaves). Page previews on hover only happen in Play, and
linked places lose their hand cursor and glow while editing; clicks never
opened notes there. The corner's window button opens the whole block, in any
mode, in a window over the page, with a "put it back" button left in the note;
the window button again, Esc (outside a field or a selection) or a click
outside puts it back. The choice is kept with the map's session, so a write
that re-renders the block keeps it open.

**Refinements (built 2026-10-19).**

- **Faint neighbours are part of the map.** `show: faint` imports are merged in
  with the map's own hexes, flagged `faint`: drawn in the same row order (so a
  neighbour's slabs don't make it look raised), dimmed by an SVG filter (CSS
  filters don't reach SVG images), left out of the fit, without their region
  outlines, names, markers or labels, and never editable. Their regions still
  tint them (2026-10-19: `faintRegions` on the cell, fills only, dimmed by the
  same filter; only the region's colour, tint, strength and parent come in),
  so a neighbour looks as on its own map. They count for coasts and joined
  paths, so a coast or river at the border sees across it.
- **Coasts.** Edge pieces placed by hand on a hex replace its automatic ones;
  `e(q,r): none` turns them off, which is what Erase on the Edge layer writes
  (erasing again removes it). A river's mouth parts the coast: that side is
  left open on both the water and the land hex, so the run is laid in two.
- **Exact or random.** `forest[lush][deciduous]` is the `deciduous` file, not
  any name containing it; with no exact file, names containing the text still
  match. A `*` in the brackets picks at random among every name it fits:
  `[deciduous*]` (starting with), `[*sparse]` (ending), `[*clear*]`
  (containing). A bare `[*]` is still any subfolder.
- **Regions.** The Region tool takes names with spaces: `The Clodgate` tags
  `@TheClodgate` and declares `TheClodgate: { label: The Clodgate }`; an
  undeclared tag reads as words. Its panel edits the region's line under
  `regions:` (the `region-decl` edit): name, label Middle / Border / None
  (`labelAt: border` puts it small under the top border; `label: false` hides
  it), border and fill colours, fill strength, text colour (`labelColor:`),
  note and the region it's inside.
- **Marker captions** take `text=<lettering style>`, `tsize=`, `toff=dx,dy`
  (hex radii), `arc=`, `#colour`, and (2026-10-19) `tline=` (outline colour,
  or `none`), `tcase=upper|title|lower`, `trot=` and `tspace=`, edited in the Edit panel's Caption group.
  "Piece" is shown as **Moves in Play**: a token Play mode lets you drag.
- **Toggles** in the corner hide markers and labels, or region outlines, while
  you work (never written).

### 14.0 Where a block opens: `view:` (built 2026-10-22)

```yaml
view: { level: 2, at: [36, -52.5], zoom: 2.5 }
```

- `level` is the block's level shown first (0: the main map, up to 2). `zoom` is
  how many times closer than the fitted map (1 to 12; 1 is the fit). `at` is the
  hex, fractions allowed and in that level's coordinates, the view centres on;
  unset, the middle of the fit. All three are optional.
- It is the start only. The Fit button still fits the whole map, and a re-fit
  while painting is left alone. Once the reader changes level, the zoom is not
  applied to the other levels.
- A note that shows another map zoomed on a place imports it and sets the same
  `origin`, so the levels line up: `origin: [ -2, -1 ]`, `import: ["[[Pointy
  Woods]]"]`, `view: { level: 2, at: [41.73, -54.63], zoom: 8 }`. Carnsperbourne,
  Safe Passage and Lurker's Hall do this.
- The code: `HexStartView` and `applyHeadValue` in `parse-hex-map.ts`, `startZoom`
  on `HexMapView`, and the session's first `level` in `render-hex-map-block.tsx`.
  `levelView` rebuilds the header and drops unknown keys, so the block reads
  `view:` from the whole source (`top`), not the level's.

### 14.1 Play on the map block: a sandbox

- **Pieces** are markers flagged `piece` on their line (`m(1,1): pin[red] (Camp)
piece`), and party figures always count. Drag one hex to hex, or click it and
  then a hex. A move goes in a straight hex line, and the readout says how far:
  "Elara: 3 hexes · 90 mi · 3¾ days".
- **Measure** drags from hex to hex: "4 hexes · 120 mi · 5 days". Under a day it
  gives hours or minutes at the same pace (24 mi a day, 8 hours of it), which
  suits the 1-mile maps.
- **Trail** draws each piece's route, one colour per piece. **Fog** darkens every
  hex no piece has seen, where a piece sees its hex and the ring around it.
- **Nothing is written** to the note. It's kept per map and level for the session,
  and Reset puts every piece back. Real positions belong to the session log
  (§14.2).
- **The code:** `lib/domains/hexmap/play.ts` (hex lines, distance, travel time,
  explored hexes; tested) and `lib/components/hexmap/hex-play.tsx`.
  `isPiece` and the `move` edit are in `parse-hex-map.ts` and `edit-hex-map.ts`.
  The test note is `Sandbox/Tests/45-TEST-HEXMAP-MODES`.

### 14.2 Travel in the session log (built 2026-10-17)

Positions, groups and a timeline of markers live in the **log block**, in the
battle map's style. The map block's Play mode stays a sandbox. Hexes are always
written `(q,r)`, so they can't be mistaken for battle squares. The user settled
the choices on 2026-10-17:

- **groups** are named, and can be renamed, split and merged;
- **time** is never inferred: the journey's close says when it arrived;
- **`[TRAVEL:]`** is written out.

```
[Group: Party = Elara, Thorne, Talon, Lilith]   define
[Pos: Party (0,0)]
[TRAVEL: [[Caulkin coast]]]                     a detail level: [[Caulkin coast]] (1,0)
@(Party) [Mv: (1,0)] Down to the plains road
[Group: Party > Scouts = Talon, Lilith]         split off (they stand where Party did)
@(Scouts) [Mv: (3,-1)] Ride ahead
[Mark: Ambush|here-red[skull]@(4,-1)|until dawn]
@(Elara) [Mv: (1,1)] Goes alone                 a member moved by name leaves her group
[Mark: -Ambush]
[Group: Scouts as Wolfpack]                     rename;  [Group: Wolfpack + Kowyn] / - Lilith
[Group: Wolfpack > Party]                       merge back
[/TRAVEL: arrive Day 3, 18:00 | 90 mi | 3 days | rations -8 | outcome Reached the ford]
```

- **Groups and positions** carry through the whole log, so a split in town still
  holds on the road. A token is a group, or a character standing alone. Moving or
  placing a group member by name sends that one off alone, and `+ Name` brings
  them back.
- **A journey** runs from `[TRAVEL: [[Map]]]` to `[/TRAVEL: …]`. The close's
  fields are `arrive …` (which sets the log's clock, as `[Time:]` does, so
  `arrive +2d` works too), `outcome …`, and any number of stats. A journey
  doesn't mark off a block of the prose the way a fight does, and a fight can
  happen inside one. The prose shows one line where it starts ("Journey on …",
  which opens the full map) and an **Arrived** card where it ends.
- **One track over the whole log** (revised again 2026-10-17, the user's call):
  the minimap shows from the scene where a map is first set out in, so
  positions declared before the `[TRAVEL]` in that scene count, and from then
  on to the end, after the journey too. **A `[TRAVEL]` block only draws paths.**
  Outside one, a walk moves people without a path. **Special moves** need no
  block: `[Mv: Party (4,0) | teleport]` is drawn as a glowing dotted arc, and
  any other kind (`| ship`, `| fly`, with a route) as a dash-dot line through
  its waypoints. The map is the last `[TRAVEL]`'s. The prose has no journey line
  any more (the minimap shows it), only the Arrived card. See `foldTravelTrack`
  and `trackAt` in `session-log/travel.ts`.
- **The minimap** (revised 2026-10-17, the user's idea, after Baldur's Gate 3's)
  is a circle in the log's top corner. It rides a sticky rail under the Log
  controls, so it shows with or without the Log open. It shows the journey being
  read, centred on whoever just moved, with trails and marks, and it carries on
  through a fight inside the journey. After arrival it shows where everyone
  ended up, desaturated. Its tools are full screen and shrink (to a small chip).
  The full-screen view has stepping (◀ ▶ or the arrow keys), Fog and the group
  legend; Escape closes it.
- **The pane** (`travel-pane.tsx`) draws the map at the entry being read:
  - each group (`party[1]`, captioned `Party · 3`) or lone character
    (`party[2]`) as a marker;
  - the active `[Mark:]`s;
  - every trail walked so far, gone groups' included, one colour per name;
  - the step just taken, outlined;
  - Fog, for what nobody has seen;
  - a legend with who is in each group.

  ◀ ▶ step through the journey. The map's own sandbox pieces are hidden there,
  since the log says where people are.

- **The code:** the parser (`[TRAVEL]` markers; `[Group:]`, `[Mark:]` and hex
  `[Pos:]` / `[Mv:]` in `tag-extractor.ts`), then `session-log/travel.ts`
  (`foldTravels`, `journeyAt`; tested), the prose model's `travel` and `arrival`
  nodes, and `SessionLogView`'s `loadTravelMaps` and `renderTravelMap`. The
  test note is `Sandbox/Tests/46-TEST-TRAVEL-LOG`.
- **Not yet:** fog that carries over from earlier session logs (it's this log's
  journeys only); `until` ending a mark by itself (only `[Mark: -Name]` does);
  and a party card that writes a journey for you.

## 15. Maps made of maps: `origin` and `import` (built 2026-10-17)

A region map shouldn't be one huge block. Each realm keeps its own map in its
own note, and a region map is a block that **imports** them. A realm's map can
also import its neighbours, faded, so its borders read in context.

```yaml
grid: hex
scale: 30 mi
origin: [4, 0] # this map's (0,0), in the coordinates it shares with its neighbours
import:
  - "[[Rindelbran Map]]" # placed by its own origin
  - map: "[[Guinzel Map]]"
    at: [-12, -4] # or here: its (0,0) on this map's hex (-12,-4)
    show: faint # faded underneath instead of merged in
```

- **Placing.** Without `at`, an import lands at its `origin` minus this map's,
  so maps that share a frame line up by themselves. `origin` defaults to
  `[0, 0]`. Links must be quoted (`"[[Note]]"`); an unquoted `[[Note]]` is read
  too, since YAML takes it as a list in a list.
- **Merged, not stacked.** Full imports are merged into the map before it's
  resolved, so coasts, rivers and region outlines join across the seams.
  Region declarations the host doesn't have come from the imports.
- **Who wins a hex.** The block's own lines: a hex it has any line on hides
  the imports' there. Among imports, the earlier one wins. Markers and labels
  are kept unless they stand on a host hex.
- **Nesting.** A full import brings its own full imports, each placed relative
  to it (a world map importing a region that imports its realms). Each note
  comes in once, nearest first; the map never imports itself; four levels at
  most. A `show: faint` import is only drawn by the map that asked for it.
- **Faint neighbours keep their names** (2026-10-20). A faint import brings
  its lettering, markers and regions too, all dimmed: region outlines, fills
  and names as the region's own map declares them (with the import chain's
  exceptions, as for full imports). A region's hexes on the host and on a
  faint neighbour are one region, so a realm's border runs on past a duchy's
  own hexes. A region wholly on faint hexes is drawn under the faint filter,
  and faint labels and markers (`faint: true` on the line) are drawn at 0.6
  opacity and don't widen the map's bounds. They stay read-only: the cells
  keep their regions in `faintRegions`, not `regions`, so painting, picking
  and the tooltip leave them alone.
- **Every map imports what it borders.** Each note's map imports, faint,
  every map it shares a border with: the realm when the neighbour is a duchy
  (a faint realm brings its duchies). `tmp/worldmap-scripts/audit-neighbours.ts`
  (`vite-node`) lists each map's bordering maps against what it shows.
- **Read-only.** Imported lines get negative line numbers, so paint edits,
  Mark mode's pick and the error list leave them alone. Painting a hex an
  import draws writes a line in this block, which then wins. A different
  `scale` is refused with a note under the map. Imported notes are read again
  when they change.
- **A region's name, all of it, in one `label:`** (built 2026-10-19):
  `label: { text, at, color, size, offset, rot, style, halo, caps, spacing }`,
  where `at` is `middle`, `border`, `none` or a hex `[q, r]`, `size` a
  multiplier, `offset` a nudge in hex radii, `style` a lettering style from the
  pack (its font, weight, colour and halo), `halo` a colour or `false`, and
  `caps` capitals (on unless a lettering style is used). The short forms
  (`label: Name`, `label: false`, `labelAt`, `labelColor`, `at`) still read; the
  Region panel writes the object. An import entry's `label:` takes the same
  object, and the host's own declaration still goes over it field by field.
- **More on a region's name:** `at` also takes `top` (= `border`) and
  `bottom` (small, just inside the lowest south border); `on: [q, r]` pins it to
  one hex (its top, bottom or middle, as `at` says; the panel's "Pick a hex"
  takes the next click); `arc` bends it; `case: upper | title | lower | none`
  sets its letters (over the older `caps`). The panel's sliders show their
  number as a field that takes any value, past the slider's ends too.
- **Widths** (2026-10-19): a marker caption's `twidth=`, a lettering label's
  `width=` and a region name's `label: { width }`, in hex radii, break longer
  text between words onto more lines (`wrapText`, measured in the text's own
  font and case), centred where the one line was. A bent one stays on one line;
  banners still grow to fit.
- **Extract to a note** (2026-10-19): the Selection panel (Build → Select) and
  the Region panel each have **Extract to a note…**, which picks a note from
  the vault (a fuzzy search) and moves the hexes there (`extract.ts`): every
  line on them and the markers standing there go into a new block at the end
  of that note ((0,0) on the middle hex, `origin` keeping it in place, the
  regions it uses, the source map imported faint), and the source map imports
  the note first among its imports, so it looks the same. Labels stay. A note
  that has a hex map already is refused. Both notes are written at once.
- **A region is its own map's** (2026-10-20). A map's own region is the one
  it declares linked to its note (`WorthallowForest: { link: "[[Worthallow
Forest]]" }` in Worthallow Forest). Wherever that map is imported, the
  region is drawn from that declaration; copies of it in other maps (left by
  Extract, or typed) are ignored. Exceptions are explicit: going up the
  import chain from the region's map to the host, the import entry's
  `label:` names the imported map's own region (only that one), and a map
  declaring it with `override: true` puts its fields over, field by field. So
  Dunlind's duchy names (`Feathers: { label: {…}, override: true }`) show the
  same on Dunlind and inside Caulkin. A region no loaded map owns falls back
  to the first import's declaration with the host's over it (`resolveRegions`
  in `imports.ts`; the merged region carries `source`, its map's note).
- **`demark:`** — `outline`, `fill` or `none` (unset: both): how a region is
  marked; `none` leaves only the regions inside it marked (a duchy map
  showing its forest without its own border). Faint tints follow it too.
- **Regions mode** (2026-10-20), beside Mark and Build (Build's Region tool,
  and Mark's Edit-click on a region, moved here). The sidebar lists every
  region on the map, imports included: the map's own region first, the rest
  as a tree by `parent`, each with its source note, whether this map changes
  it, and its hexes; a field adds a new one. Paint puts hexes in or out of
  the selected region (Alt-click or Pick takes a hex's innermost); the panel
  below sets its marking (Both / Outline / Fill / None), colours, note,
  parent and name. For an imported region, **Shown** picks
  "As in <its map>" (this map's declaration dropped, the fields locked: edit
  it in its own map) or "Changed here" (this map's `override: true`, its
  fields going over the import's). **Remove region** (this map's own) takes
  its declaration and its tags on this map's hexes off, one undo step; for an
  imported one it's **Hide on this map** (`override: true, demark: none,
label: false`).
- **Regions on imported hexes** (2026-10-19): the Region tool (and the
  Selection panel's region buttons) on a hex the host hasn't itself, but a
  full import has, changes that hex's line in the imported map, not the
  host's (a terrain-less `t(q,r): @Region` in the host would win the hex and
  blank it). The change is drawn at once and kept in the session with the
  host's; Done writes each changed imported note, then the host. A faint
  neighbour's hex isn't changed: the bar names the note to change it in.
  Undo reaches them (2026-10-20): each undo step keeps the imported maps'
  changes beside the text (`session.undoImports`), with each touched note's
  text as it was, so undoing past a save has Done write it back.
- **Lettering labels** also take `line=` (outline colour, or `none`),
  `case=upper|title|lower` and `space=` (letter spacing), over their style's.
- **Picking a region to style:** in Mark, the Edit tool selects the region under
  a click when there's no marker or label there; in Build, Alt-click with the
  Region tool. The innermost region wins (a duchy before its realm), imported
  ones included. The panel shows the region as drawn (the duchy's own colour,
  the import's `label:`) and writes only the fields you change, as the host's
  override.
- **Imported regions are the host's to name.** An import entry's `label:`
  (`border`, `middle`, `none`) sets how the regions that map declares are
  named here (`- { map: "[[Feathers]]", label: border }`), and a region the
  host declares too takes the host's fields over the import's, one by one
  (`Feathers: { labelColor: "#fff" }` keeps the duchy's colour and link).
  Dunlind names its duchies small, inside their borders.
- **Regions, three small keys.** The label is `label:`, else the linked
  note's name, so `@BellscarpRange` with `link: "[[Bellscarp Range]]"` reads
  "Bellscarp Range". `tint:` colours the fill apart from `color:`, the border
  (Rindelbran: pink border, green fill, as in the Affinity map). `at: [q, r]`
  (fractions allowed) puts the label clear of place names; an imported
  region's `at` moves with its map.
- **The code:** `lib/domains/hexmap/imports.ts` (`readImports`,
  `loadImports`, `mergeImports`; tested), `drawHexMap(source, imports)` and
  `drawParsed` in `draw-hex-map.ts`, and the import and faint-layer effects in
  `render-hex-map-block.tsx`. Not yet: the session log's travel pane draws
  the block without its imports.
- **First use:** each map lives in its region's own note (moved there on
  2026-10-18 at the user's ask, from separate `Maps/` notes): `Caulkin`
  (imports only; (0,0) is Borelhearth), the realms `Rindelbran`, `Dunlind`
  and `Guinzel` (capital at (0,0)), and the wilds `Barelquag`, `Barelgrove`
  and `Stelscar Hills` (middle hex at (0,0)). Imports link the notes
  (`[[Dunlind]]`): a note's first hex map is the one imported. Each has its
  `origin` on the Caulkin map and its bordering maps faint. Dunlind's duchies
  (2026-10-19) moved out the same way: `Duchies/Feathers`, `Duchies/The
Clodgate`, `Duchies/Worthallow` and `Cities and Villages/Mervine` (the
  capital's own duchy) each hold their hexes and markers, (0,0) on their seat,
  and import Dunlind faint; Dunlind keeps its lettering and region
  declarations and imports the four in full. Rindelbran's split the same way
  (2026-10-20): its seven duchies in `Duchies/` and the capital's in
  `Cities and Villages/Borelhearth`, (0,0) on the seat where one has a city
  (Iselspear, Treyfell, Port Bilegeld), else its middle hex; Rindelbran
  imports them with `label: none`, as its own lettering names them. A faint import now brings its
  full imports too, faint, so a duchy shows its sister duchies and a realm's
  neighbour shows that realm whole. The Barelquag
  mixes three looks, read hex by hex from the picture: swamp water
  (`water[swamp][still|waves]`), damp wetland with puddles or a few trees
  (`wetlands[damp][field|flooded]`), and wooded wetland
  (`wetlands[damp][deciduous]`), plus two channels. Its fill is a dark tint at
  `tintOpacity: 0.45`. The Barelgrove is `forest[lush][mixed]`, with sparse
  clearings.
- **Turned path tiles.** When a pack has no tile for a path's sides, autotile
  draws the same shape from another slot, turned into place about the hex
  (`pickAutotileTurned`; a slot is its shape turned that many sides, and a
  hex looks the same turned by a side). `basic` lacks the rivers' `turn120-0`
  and `turn120-1`, which had always drawn as strokes. A stroke is left only
  when the shape has no tile at any turn. Rivers have `except: [swamp]` too,
  so they run through a swamp instead of emptying into it. At 30 miles the tiles stay plain, since detail comes
  later in finer maps: land is `basic[lush]`, water `basic[ocean]` (lakes
  too), and forests, mountains and hills their `[lush]` folders. Only the
  Barelquag differs: `water[swamp][still]`. The colours in Affinity were
  region tints, so regions use `tint:`. Coasts skip swamps: `pack.yml`'s
  coast has `except: [swamp]`, matched by base, ground or the tile's folder
  (`edges.ts`). Dunlind comes to 46 fully
  habitable hexes (not coast, mountain or hill), as its note says. They were read from the Affinity exports by sampling
  each hex's colours on a fitted grid, then corrected by hand.
