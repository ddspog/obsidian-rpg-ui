# `rpg` — the headless CLI

A read-only command line over the plugin's own calculations, for playing with
an LLM in a terminal (a cloud one too) that has the vault but no Obsidian.
It loads the TTRPG system from the vault the way the plugin does (bundling
`tales-of-the-valiant/config` with esbuild), then answers with what the
plugin would show: not the raw Markdown, the calculated values.

## Setup

```sh
cd .obsidian/plugins/obsidian-rpg-ui
npm install            # esbuild is needed to load the system
npm run build:cli      # writes cli/dist/rpg.cjs
node cli/dist/rpg.cjs --help
```

The vault is found by itself (the one the plugin sits in). Elsewhere, pass
`--vault <path>` or set `RPG_VAULT`. Nothing is ever written: the CLI's vault
refuses every write.

## Commands

| Command                                                  | What it gives                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rpg character <note>`                                   | The sheet, calculated: level, PB, AC, HP, initiative, speed; abilities with modifiers and saves (proficiency from the resolved traits); every skill; traits; spellcasting and slots; actions (weapons as the Rolls block derives them, plus basic actions); features by source (class, lineage, heritage, background, talents, items); choices still to make; inventory. |
| `rpg log <note> [--log N]`                               | A session log folded as the log block folds it: scenes; the party's HP (their sheets, less what the log did), AC, conditions and resources spent; foes in play with HP and state; the last fight (map, open or over, turn and who's next, initiative, positions); the journey (map, level, where each group stands); the clock; and the last 25 lines.                   |
| `rpg map <note> [--level N] [--around q,r] [--radius N]` | A hex map at a level, merged with its imports: each hex's terrain, height, base, paths, stacks, regions and place; marks and labels. `--around` keeps the hexes near one. A battle map: its parsed grid.                                                                                                                                                                 |
| `rpg lookup <note> [--full]`                             | A note's frontmatter, its `rpg` blocks as data (statblocks, items, features, spells) and its prose.                                                                                                                                                                                                                                                                      |
| `rpg search <words>`                                     | Notes whose paths hold all the words.                                                                                                                                                                                                                                                                                                                                    |

Add `--json` to any command for JSON instead of Markdown.

## Playing with an LLM

Give the LLM the commands and let it ask: `rpg log "<session>"` to see where
play stands, `rpg character "<PC>"` before a check, `rpg map "<map>" --level
2 --around q,r` to know the terrain around the party, `rpg lookup "<monster>"`
for a statblock. Hex coordinates are axial (q east, r south-east), the same
the log's `[Pos:]` and `[Mv:]` tags use.

## How it works

`cli/rpg/` holds the sources: `vault.ts` (the vault and metadata cache over
the file system, with Obsidian's link resolution), `obsidian-node.ts` (the
`obsidian` module for Node: the plugin's test shim plus real file classes),
`app.ts` (settings from `data.json`, the system registry), and one module per
command. `npm run build:cli` bundles them with the plugin's `lib/` code.

Not yet: battle map captions (what's on each square — walls, cover — for an
LLM to read), the `@[[File]].fn()` rule calls, and the bookkeeping baseline
the log block keeps in its state file.
