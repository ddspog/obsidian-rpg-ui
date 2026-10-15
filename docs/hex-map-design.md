# Overworld Hex Maps — Design

> **Status:** phases 0–4 BUILT (2026-10-15); phase 5 (painting, hex travel, hex battles) is unplanned. Ports the
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
  The test note is `vault/tests/23-TEST-HEXMAP.md`, copied to `tests/` at the
  vault root.
- **Differences from the plan, found while building:**
  - **Tuning uses `hexWidth`**: the image pixels the hex face spans. For
    `basic` that's 477 px of the 932 px image, measured; the face is centred,
    and the 3D slab sits under it. `zoom` stays as an extra multiplier. This
    replaces the editor's `zoom: 2.0` pattern trick and works the same for
    tiles and stack sprites.
  - The peak tiles are drawn 49 px left and 7 px up of the image centre, so
    `pack.yml` has `files:` offsets for them.
  - **Name filters** in brackets match names *containing* the text (the
    editor matched prefixes, but this pack's names all start with "Hex - "), so
    `water[Ocean]` works. `(qualifier)` matches `(text)`.
  - **Layer order** follows the editor's documented intent (terrain < stack <
    path, higher height groups on top, rows top to bottom). Its code sorted the
    other way round.
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

| Prototype piece | File | Keep / change |
| --- | --- | --- |
| `hexmap` fence parser — `t(q,r)` / `s(q,r)` / `p(q,r)` lines, `(Label)`, `terrain[variant]`, `+ #color`, `Nm:` height groups with `*` items, legacy `q,r,content,color,terrain` | `src/lib/hexmap-parser.ts` | **Keep the grammar as written**, rewritten as a tested parser with line numbers. Drop `migrateToNewSyntax` and its hard-coded `stone→grass` rewrite. |
| Texture lookup — packs found by folder, `terrain[sub][file]` paths, `*` wildcard, numeric index, seeded random per hex | `src/lib/terrain-loader.ts` | **Keep the rules**, rewrite them as one pure function (the prototype has two near-identical 120-line copies plus hard-coded fallbacks to "basic grass"). It can't use Vite's `import.meta.glob`; it reads a vault index instead (§5). |
| `pack.yml` — `defaults` / `terrains` / `files`, each with zoom, offsetX/Y, borderWidth, preserveAspectRatio | `src/lib/pack-config.ts` | **Keep the format and cascade** (defaults → terrain → file), and extend it with `catalog:` and `autotile:` (§5, §8). Parse it with the `yaml` dependency. `pack.yml` is the single source of truth; nothing is kept as a separate override layer. |
| Terrain Inspector (browse a pack, tune zoom/offset, export YAML) | `TerrainInspector.tsx` | **Becomes the settings section** (§6), which reads and writes `pack.yml` in the vault. |
| SVG renderer — flat-top, unclipped "extended" tiles that overlap neighbours, z-order by height → layer → `s = −q−r` → `q` | `src/components/HexGrid.tsx` | **Keep** the geometry and the z-order formula. **Replace** the per-cell `<pattern>` + 200%-zoom trick with one positioned `<image>` per cell (§7). The fallback SVG patterns (grass/water/forest…) become the built-in `flat` pack. |

Assets (about 22 MB, third-party): flat-top tiles at **932×810**; path overlays
that cover the whole hex (also 932×810), with rotation or side in the name
(`roads/clean/turn60-3`, `rivers/Hex - River 1 N`); and small stack sprites
(`Buildings - City Building 1 (blue)` is 245×168). File names carry biome
qualifiers in parentheses: `(lush)`, `(dry)`, `(cursed)`, `(dead)`,
`(wasteland)`, `(blue)`.

## 2. The pieces

| Piece | What it is | Where it lives |
| --- | --- | --- |
| **Hex map** | An overworld on flat-top hexes, one line per layer per hex, in the editor's syntax | An `rpg map` block with `grid: hex`, in its own note (`Dunlind.md`, `Eodoroth.md`) |
| **Texture pack** | Tiles plus `pack.yml` | `<Hex packs folder>/<pack>/` in the vault (§5) |
| **Terrain catalog** | Short names maps can use (`dry-plains` → `plains(dry)`) | `catalog:` in the pack's `pack.yml` |
| **Display tuning** | Zoom and offset per pack, terrain or file | `defaults` / `terrains` / `files` in `pack.yml` |
| **Settings** | Where the packs are, the default pack, a pack browser and tuner that edits `pack.yml` | Plugin settings → "Hex maps" |

## 3. The block

### 3.1 Shape

~~~markdown
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
~~~

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

| Token | Meaning | Example |
| --- | --- | --- |
| `[[Note]]` | Makes the hex a place: click opens the note, Ctrl/Cmd-hover gives Obsidian's page preview. `(Label)` is the name drawn; without a label the note name is used. | `t(1,1): (Featherbark) [[Holy City of Featherbark]] urban` |
| `@Region` | Puts the hex in a region (§3.4). Several are allowed: `@Dunlind @Caulkin`. | `t(2,1): plains(dry) @Dunlind` |
| `xN` (stack lines) | Scatters N copies of the sprite with a seeded jitter, so a city reads as several buildings. | `s(1,1): buildings x3` |
| `(qualifier)` in a spec | Filters files whose name contains `(qualifier)`, which is how this pack names biomes. Distinct from `(Label)`: a label comes **before** the spec, a qualifier is glued **to** it. | `plains(dry)`, `hill(desert)[2]` |
| Catalog id | Any name in the pack's `catalog:` stands for its spec (§5). | `dry-plains` |

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
  Dunlind:    { color: "#8a3b2e", link: "[[Dunlind]]" }
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
catalog:                       # NEW — short names usable in maps
  dry-plains: plains(dry)
  pine-forest: forest[lush][conifer]
  city: { spec: urban, color: "#a08060" }   # color = fallback / tint
autotile:                      # NEW — §8
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
`yfork-1`, `xfork-0`, `culdesac-4`, `start-2`…; rivers by number and side).
`autotile:` in `pack.yml` maps masks to files:

```yaml
autotile:
  roads:
    folder: roads/clean
    tiles:
      "N,S": straight-0
      "NE,SW": straight-1
      "N,SE": turn120-0
      "N": start-0
      # …
  rivers:
    folder: rivers
    tiles: { "N,S": "Hex - River 1 N" }
```

A mask with no tile in the table falls back to a drawn SVG stroke through the
side midpoints, and the tooltip names the missing mask. That keeps the path
visible and makes the gap easy to fill. Filling in the `basic` tables is
manual, visual work. The pack browser gets an "autotile" view that lists every
mask next to its tile.

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
  `vault/tests/NN-TEST-HEXMAP.md`, with Obsidian frontmost.
- **Detector sweep:** `grid: hex` blocks detect as `map`, with no new false
  positives.

## 10. Build order

| Phase | Delivers | Done when |
| --- | --- | --- |
| **0. Pack in the vault** | `cli/import-hex-pack.mjs`; `basic` + `svg` copied to `z52. Hex Packs/`; merged `pack.yml`; `HexPackIndex` + `selectTile` (tested); `flat` pack | The index lists both packs with the right counts in a probe |
| **1. Translator: block → map view** | `grid: hex` branch; the editor's full grammar; SVG renderer with tiles and the editor's z-order; labels; coordinates; errors; pan/zoom; hover tooltip; a docs page; an example note | The editor's example map renders the same in Obsidian and inside a `.bare()` embed; perf measured |
| **2. Settings** | Packs folder, rescan, default pack, pack browser, catalog editor, tuning with the 7-hex preview (saving `pack.yml`), grid style; live re-render | Editing a zoom or catalog entry updates an open map without reload |
| **3. Overworld content** | `[[Note]]` places with page preview, `xN` scatter, `@Region` + `regions:` outlines, tints, labels, hex and coast counts | One real realm (`Dunlind`) mapped with its villages linked |
| **4. Autotiled paths** | Side masks, `autotile:` tables for `basic` roads / rivers / walls, fallback stroke, autotile view | A road and a river crossing it render with no gaps |
| **5. Later** | Click-to-paint palette that writes `t/s/p` lines back into the block (per-hex lines get long on big maps); hex travel in session logs (party at `(q,r)`, explored hexes); hex battle maps | Each one is designed separately when it's picked up |

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

| # | Question | Decision |
| --- | --- | --- |
| D1 | Coordinates | Axial `(q, r)`: it's a hex map. Chessboard style stays for square battle maps only. |
| D2 | How terrain is written | As in the editor: per-hex `t/s/p(q,r)` lines with `Nm:` height groups. Additions are tokens on those lines (§3.2). |
| D3 | Packs | Start with the editor's third-party pack (`basic`, plus `svg`), copied into a vault folder. The folder is a plugin setting, defaulting to `z52. Hex Packs`. |
| D4 | Catalog and tuning | In each pack's `pack.yml`. The settings UI edits that file. |
| D5 | Block | `rpg map` with `grid: hex`. |
