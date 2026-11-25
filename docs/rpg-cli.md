# `rpg` — the headless CLI

A command line over the plugin's own calculations, for playing with
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
`--vault <path>` or set `RPG_VAULT`. The commands below write nothing: the
CLI's vault refuses every write. `rpg gm` (a session's log and GM notebook)
and `rpg session` (its saved lines) do write: see `docs/game-master.md`. So do
the catalog's keepers (`rpg sim catalog init|draft --accept|add|adjust
--accept`, `sim suggest --accept`, `sim roles --write`, `sim spells --write`,
`sim templates --write`, `sim homebrew --write`): they write through
`cli/rpg/write.ts` (the old text is backed up first); everything else in sim
is read-only.

With no plugin settings in the vault (a clone: the plugin's folder is not in
git), a top folder holding `config/index.ts` is taken as the system of its own
notes.

## Commands

| Command                                                  | What it gives                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rpg character <note>`                                   | The sheet, calculated: level, PB, AC, HP, initiative, speed; abilities with modifiers and saves (proficiency from the resolved traits); every skill; traits; spellcasting and slots; actions (weapons as the Rolls block derives them, plus basic actions); features by source (class, lineage, heritage, background, talents, items); choices still to make; inventory. |
| `rpg log <note> [--log N]`                               | A session log folded as the log block folds it: scenes; the party's HP (their sheets, less what the log did), AC, conditions and resources spent; foes in play with HP and state; the last fight (map, open or over, turn and who's next, initiative, positions); the journey (map, level, where each group stands); the clock; and the last 25 lines.                   |
| `rpg map <note> [--level N] [--around q,r] [--radius N]` | A hex map at a level, merged with its imports: each hex's terrain, height, base, paths, stacks, regions and place; marks and labels. `--around` keeps the hexes near one. A battle map: its parsed grid.                                                                                                                                                                 |
| `rpg lookup <note> [--full]`                             | A note's frontmatter, its `rpg` blocks as data (statblocks, items, features, spells) and its prose.                                                                                                                                                                                                                                                                      |
| `rpg search <words>`                                     | Notes whose paths hold all the words.                                                                                                                                                                                                                                                                                                                                    |

Add `--json` to any command for JSON instead of Markdown.

## The encounter simulator: `rpg sim`

A seeded Monte Carlo of party vs monsters, so an LLM can measure an
encounter instead of eyeballing CR: `run` fights the groups you name,
`suggest` sweeps the bestiary, `plan` and the catalog keep the measured ones
per party (`docs/encounter-catalog.md` is the catalog's own page, with the
rules of a fight and what is modelled). Everything answers as one JSON
document; `--brief` is the short form a model reads at the table, and
`rpg sim --help` lists every flag with its default.

| Command                                                                                                                         | What it gives                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rpg sim run --monster "<note>[:<n>]"… [--pc <note>]…`                                                                          | The fight, fought: win/TPK/stalemate rates, rounds and HP per trial, KO and death rates, the ToV difficulty label, and a `fidelity` list of what was modelled or skipped. A map with `--map <note>`; the day so far with `--resources <share>`; an ambush with `--surprise party\|monsters`; space, lairs and weather with `--distance`, `--lair`, `--terrain`, `--cover`, `--high-ground`. |
| `rpg sim suggest [<theme words>] [--rank outcome\|cr] [--tiers same\|lower\|all] [--base "<note>[:<n>]"]… [--fit s]… [--brief]` | The bestiary swept by outcome: each candidate's fit (`fit`, `too-easy`, `too-hard`) and `avgHpLost`, best first. Theme words match a monster's name, type, family and source book; `--accept [--pick N]` keeps one in the catalog as a draft.                                                                                                                                               |
| `rpg sim plan [<theme words>] [--tag t]… [--habitat H] [--limit N]`                                                             | The one call at the table: the catalog's current `fit` entries first, a `suggest` sweep to fill three options, `notes` on what to do next. Writes nothing.                                                                                                                                                                                                                                  |
| `rpg sim build [<theme words>] [--model single\|double\|boss\|matched\|horde]… [--accept [--pick N]]`                           | New encounters from the Monster Vault's models, filled by role and simulated.                                                                                                                                                                                                                                                                                                               |
| `rpg sim homebrew "<base note>" --name "<n>" [--role R] [--template T] [--cr C] [--write]`                                      | A new creature: reflavoured, a role template, a creature template (`rpg sim templates` lists them; `rpg sim lineages` the lineage ones), a new CR; `rpg stat.template` / `stat.summon` blocks are the read/write of it.                                                                                                                                                                     |
| `rpg sim roles [<note>…] [--write]`, `rpg sim equivalents "<note>" [--role R] [--steps N]`                                      | Monster roles (controller/leader/soldier/striker and subroles), written or guessed; equivalents by role near a CR.                                                                                                                                                                                                                                                                          |
| `rpg sim spells [<note-or-folder>…] [--write]`                                                                                  | A `roll:` for each spell note that has none, read from its text — the sheet, the log's cards and the simulator share it.                                                                                                                                                                                                                                                                    |
| `rpg sim calibrate [<session note or folder>…]`                                                                                 | The simulator against real play: each logged fight ([COMBAT]…[/COMBAT], its [F:…] foes) placed among the simulated ones. Read-only.                                                                                                                                                                                                                                                         |
| `rpg sim catalog <action>`                                                                                                      | The per-party encounter catalog (init, draft, add, confirm, remove, tag, use, prepare, adjust, session, check, suggest, list): `docs/encounter-catalog.md`.                                                                                                                                                                                                                                 |

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
