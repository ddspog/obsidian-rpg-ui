# Hexcrawl Exploration: Terrain, Travel and Hex Flowers

> **Status:** built 2026-11-09: terrain types per hex, travel time across them, the `rpg hexflower`
> block, Build's Generate tool, and GM card picks that start on the party's terrain. Extends
> [hex-map-design.md](hex-map-design.md) (§14 Play and travel).

This page collects what three books in the vault say about exploring the wilderness. It then lists
what the plugin does with each rule, and what's left.

## 1. What the books give

### The Solo Adventurer's Toolbox

The notes are in `tales-of-the-valiant/compendium/solo-adventurers-toolbox/` and their tables are in
`gm-tools/tables/solo-adventurers-toolbox/`.

| Rule                                                                                                                                                                    | Where                    | Keyed by            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------- |
| **Travel speeds**: Fast 30 / Normal 24 / Slow 18 mi a day, mounts (riding horse 48), halved on difficult terrain                                                        | Ch. 3, _Modes of Travel_ | pace, mount         |
| **Weather**: d20 by season; +5 in a desert, −5 in mountains or on ice steppes                                                                                           | Ch. 3, _Weather_         | season, **terrain** |
| **Encounters on the road**: 2/4/6 d100 rolls per 12 h by day (half at night), each ≤ 25 an encounter                                                                    | Ch. 3 and 9              | population density  |
| **Unmarked settlements**: 1d4−1 chance rolls between marked ones, 5 / 10 / 20 % by density, then _Nature of Unmarked Settlement_                                        | Ch. 3                    | population density  |
| **Finding a campsite**: Survival DC 6 (forest, hills) to 14 (mountain, ice steppe); failing makes a disturbance likelier or the rest short                              | Ch. 3, _Camping_         | **terrain**         |
| **Disturbed at camp**: a Q&A roll adjusted by the campsite check, then _What Wakes You?_                                                                                | Ch. 3                    | campsite roll       |
| **Overarching terrain**: every 5 miles roll d100 on the terrain's table; above about 50 a _minor feature_ (1d4 miles of hills, a lake, a monument…), then its own table | Ch. 9                    | **terrain**         |
| **Minor features** (clearing, gully, hills, lake, monument, oasis, waterway, unmarked settlement, …); encounters there use the minor feature as the terrain             | Ch. 9                    | minor feature       |
| **Active areas** (rumoured activity) and **wilderness clues**                                                                                                           | Ch. 9                    | —                   |
| **Going around**: a feature can be skirted, at the risk of meeting another                                                                                              | Ch. 9                    | —                   |
| **Wilderness encounters** d100, many pointing to a quest, a monster or a dungeon                                                                                        | Ch. 4                    | —                   |
| **Random dungeons** (size, passages, doors, rooms, traps, clues) and dungeon encounter rolls per hour                                                                   | Ch. 8                    | —                   |
| **Arriving in settlements**: taverns, rumours (subject, then situations), urban encounters per 12 h                                                                     | Ch. 3                    | population density  |

### Campaign Builder: Dungeons & Ruins, ch. 2 "Running Exploration"

These are in `gm-tools/tables/campaign-builder-dungeons-and-ruins/02. Running Exploration/`.

- **Hex flowers**: _Wilderness Terrain Elements_ and _Ruins/Underground Terrain Elements_. A 2d6 roll
  walks a token on a 19-hex table, wrapping round at the edges and following one-way arrows. Landing
  on Start repeats the last result (in ruins it's Up/Down). A two-in-one hex is split with a d6.
  **Doubles** add a roll on _Distinct Hex Elements_. A **1** shifts the weather colder and a **6**
  warmer, so biomes shift: a hot Forest becomes jungle, a cold Desert becomes tundra.
- **Ways to build a map**: pregenerated, procedural (one roll per empty neighbour as the party
  enters a hex), or a mix.
- **Terrain notes**: a d6 detail for each result. **Haunted** hexes call for a WIS save every hour
  (DC 10/12/14). **Volcanic** hexes bring hazards and extreme heat.
- **Hex size**: 6 mi is standard (horizon at 3 mi); a ruins hex is about 680 ft (8 to a mile).
  **Hex tracking** counts whole hexes per day; **mileage tracking** counts 8-hour turns.
- **Adjusted Travel Speed by Map Element**: Jungle, Swamp and Narrow Passages are Slow; Mountains,
  Ruins, Underground and Volcanic are Normal.
- **Navigation**: off road, the navigator rolls WIS (Survival) against DC 5 / 10 / 15 by terrain,
  with advantage if the party has a map and disadvantage in bad weather or at night. Lost parties move
  in a random d6 direction and take 1d6 hours to get their bearings. **Roads**: no getting lost, no
  stealth.
- **Weather effects**: Unpleasant means double time; Inclement adds disadvantage to navigation;
  Extreme adds a level of exhaustion per hex; Ideal means half time.
- **The hex turn**: a new day (weather, plan), the party's turn, then the GM's turn (time and
  encounters). The party's activities are Explore (Perception DC 15), Investigate (DC 15), Scout or
  Track (Survival DC 15, or 8 + CR) and Camp or Forage (DC 10).
- **Location encounters**: wilderness, ruins and underground tables, d8 with tiers.

### Game Master's Guide, ch. 5 "Advanced Exploration"

- **Travel Terrain** table: maximum pace, encounter distance, and foraging, navigation and search DCs
  for Arctic, Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Urban and
  Waterborne.
- **Good roads** raise the maximum pace one step. Flying or other movement that ignores difficult
  terrain always allows Fast.
- **Extended travel**: past 8 hours, a CON save (DC 10 + hours over) or gain exhaustion.
- **Getting lost** lengthens the stage by 1d6 × 10 %. Fast pace adds +5 to the DC.
- **Random encounters**: d20 ≥ 16 once a day, or hourly in dangerous areas.
- **Foraging** DC 10 / 15 / 20 by scarcity; no foraging at a fast pace.

## 2. What's built

### Terrain types on the hex map (`lib/domains/hexmap/terrain.ts`)

Every hex has a kind of ground: arctic, badlands, coastal, desert, farmland, forest, grassland, hills,
jungle, mountain, ruins, swamp, underground, urban or water. Each type carries the rules above
(`TERRAIN_RULES`): whether it's difficult, its maximum pace, its navigation, foraging, search and
campsite DCs, and its encounter distance. Difficult ground follows the Player's Guide: dense
forest, deep swamp, rubble-strewn ruins, steep mountains and ice.

A hex's type comes from the first of these that gives one:

1. its own `terrain=hills` on the terrain line;
2. the map's `classify:` rules, then the pack's `classify:` (in `pack.yml`), then the built-in rules
   for the `basic` pack. All of them match the path of the tile the hex draws, by folder:
   ```yaml
   classify:
     "land/forest/dead": badlands # a folder and everything under it
     "land/mountain/*/foothills*": hills # * is any one folder; inside a name, any letters
   ```
   (`terrains:` in `pack.yml` was already taken by tile tuning, so the key is `classify:`);
3. the words of the spec (`water[swamp]`, `conifer-forest`), for maps drawn without a pack.

Path families named like roads (`roads`, `trail`) and rivers (`rivers`, `stream`) are read for
travel. The hex tooltip has a **ground** line, for example "Forest · difficult · road · nav DC 15".

### Travel across the ground (Play mode)

Play has a **Slow / Normal / Fast** picker when the map has a `scale:` and knows any hex's terrain.
Measure and moves then count each step:

- the ground caps the pace, and a road along the step raises the cap one step;
- difficult ground halves the speed unless a road runs through it;
- crossing _onto_ a river where no road crosses it is a ford, which also halves the speed (walking
  along a river doesn't count);
- water hexes need a boat.

The readout looks like "4 hexes · 24 mi · Normal · 1 d 2 h · 2 by road · 1 difficult · 1 ford · nav
DC 15", and the measured hexes are tinted orange (difficult), green (road) and blue (water). A day is
8 hours of travel.

### `rpg hexflower` (`lib/domains/hexflower/`)

```yaml
title: Wilderness Terrain Elements
dice: 2d6 # the default
directions: { N: "2,12", NE: 3-4, SE: 5-6, S: 7, SW: 8-9, NW: 10-11 } # the default
start: previous # or a result, e.g. Up/Down
cells: # each hex by its steps from Start, or axial q,r
  N N: Mountains
  NW SW: Desert / Grassland # two in one: a d6 picks
arrows: # one-way edges instead of wrapping
  S S > SW: SW S
  N N > N: stay
doubles: Roll on the [[#Distinct Hex Elements Table|Distinct Hex Elements]] table.
temperature: true # a 1 colder, a 6 warmer, both: back to temperate
shifts: { hot: { Forest: Jungle }, cold: { Desert: Tundra } }
```

The block draws the flower as the book prints it, with Start's numbers on its sides and the arrows
on their edges. It has a Roll button, a token, a temperature chip and a history. Click a hex to put
the token there. The walk is kept in memory for each note and flower (not written to disk). Both
book flowers are in the Hexcrawls note, and the same text is in `lib/domains/hexflower/fixtures/`,
where the book's worked examples are tests.

### Generate (Build mode)

The **Generate** tool (dice icon) rolls a flower found in the vault. A map can name one in its head:

```yaml
generate:
  flower: "[[Running Exploration 1. Hexcrawls]]"
  title: Wilderness Terrain Elements
  tiles: { Mountains: "mountain[snowy]" } # optional, over the defaults by terrain type
```

- **Drag across empty hexes**: the token walks on from hex to hex, one roll each.
- **Click a filled hex**: each empty neighbour gets one roll from it. This is the book's way of
  filling hexes as the party enters them.
- The token starts from what a neighbouring hex already is: the cell with its result, else a cell of
  its terrain type.
- A result becomes a tile by its terrain type (`DEFAULT_TILES`), with `terrain=` written where the
  tile wouldn't say it (a Coastal hex is drawn as plains).
- The sidebar shows the flower, the walk's weather and the last rolls; the status line names
  doubles.

### Log: GM card picks that start on the party's terrain

A generator step with `ask` and `choices` can name the choice for each kind of ground:

```yaml
steps:
  - work: "Kind of terrain"
    ask: kind_of_terrain
    choices: [...]
    terrain:
      forest: "Five miles of forest or jungle"
      mountain: "Five miles of mountains"
```

When the card is played, the popup starts on the choice for the hex the party stands on. That's the
end of the log's travel track: the `Party` group, else the biggest group, else the lone token, on
the last `[TRAVEL: [[Map]]]`. A chip next to the field names the ground. It turns grey when another
choice is picked and offers **use** to switch back.

The _Terrain Theme Generator_ (its "every five miles" choices) and the _Wilderness Adventure
Generator_ (its hex encounters) have these maps.

**Test notes** (testing-vault): `Sandbox/Tests/62-TEST-HEX-TERRAIN` (terrain, travel, Generate) and
`63-TEST-TERRAIN-LOG` (picks by terrain).

## 3. Built since (2026-11-09, round 2)

- **Settings › Maps › Terrain types**: each terrain's rules, editable over the books' numbers
  (`hexTerrainRules` in the plugin's settings, applied at load), and each pack folder's terrain,
  written to `pack.yml` `classify:`.
- **Weather in Play** (Weather Effects table: time ×2 or ×½, disadvantage to navigate, exhaustion
  a hex, no travel when catastrophic) and **hex tracking** (`travel: hexes`).
- **Population**: `population: low|medium|high` on a region; a hex takes its innermost region's; a
  generator step's `population:` map starts a pick on it, as `terrain:` does.
- **Exploration card** (vault: `gm-tools/solo-play/Exploration Generator`): make camp (campsite DC by
  terrain, then What Wakes You), encounter checks by population, hex location encounters, getting
  lost (a d6 direction table).
- **Generate**: on a detail level the walk starts from the coarse hex's terrain and, with _Keep to
  the big hex_, never strays more than one flower step from it; a flower's `doublesTable` is rolled
  on doubles and pinned on the hex.
- **Terrain picks** on four more cards: Mystery and Clue, City and Settlement, Sea and Sky, Dungeon Map.
- **Hex flower redesign** after a `/ui-review` (board: tmp/ui-review/, findings merged from an
  Impeccable critique and a live measurement).

## 4. Built in round 3 (2026-11-11)

- **Getting lost**: `[Mv: Party (3,-1) | lost (2,0)]` keeps believed and true positions; the
  journey view draws a dashed `?` hex where the party believes it is; a move without `lost` finds it.
- **Five-mile rolls**: each journey step lists the hexes entered with their overarching-terrain
  table (found in the vault by block name) and one roll per five miles; Roll the land, Add to the log.
- **Fog that remembers**: each log's seen hexes are kept per map in the plugin's state; other logs'
  Fog starts from them. Markers flagged `secret` stay hidden under Fog until their hex is seen.
- **Distinct elements' rules**: a marker captioned Haunted, Volcanic activity, Overgrown, Dead end,
  Fissure, River or Hazard puts its rule on the tooltip; Overgrown is difficult on the road.
- **Weather in the log**: the last `[Weather: …]` tag is read as a Weather Effects row; GM chips
  name it, and the party's Travel card starts on the ground's terrain and navigation DC and scales
  hours by the weather.
- **Suggested picks**: a choice step with a `terrain:` map but no `ask` offers its pick made
  (`{{name~:…}}`, optional); Discover Meaning's Elements Table uses it.
