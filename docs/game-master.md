# An LLM as Game Master

`rpg gm` and `rpg session` (the headless CLI, `docs/rpg-cli.md`) are what an
LLM with a terminal needs to run one session as its Game Master, with the
player in Obsidian (or in the same chat). Nothing here calls a model: the
commands orient one. Any agent that can run a shell works; in Claude Code the
`/gm` command starts it.

```sh
npm run build:cli
rpg gm guide                  # the GM's orientation: read by the model, first
rpg gm brief "<session>"      # where play stands
```

## What the model is given

|                   |                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orientation**   | `rpg gm guide` (source: `cli/rpg/gm/guide.md`): the contract, the loop, the tree of what to consult, how to prep, where each thing is written.                                                                |
| **State**         | `rpg gm brief`: the mode, the Chaos Factor and other dials, the Threads and Characters lists, the notebook's standing notes and prep, then all of `rpg log` (party, foes, fight, journey, clock, last lines). |
| **The GM Screen** | `rpg gm cards [words]` lists the session's GM cards with their slots; `rpg gm play` plays one. The same cards the log's GM drawer holds, loaded by the same code (`lib/services/gm-loader.ts`).               |
| **The books**     | `rpg gm consult <words> [--in folder]` finds passages by heading across the vault; `rpg gm shelf` shows what is where; `rpg lookup` reads a note; `rpg character`, `rpg map` as before.                       |
| **Dice**          | `rpg gm roll`. Rolled in the CLI, written in the same step.                                                                                                                                                   |

## What keeps it honest

- **The model never holds a die.** `play` and `roll` roll and write at once;
  both need `--into` (the log, or a prep draft), so no roll goes unrecorded and
  none can be looked at and thrown away. `say` refuses a line with a roll in it
  (`--dice` lets through dice the player rolled and reported).
- **A card's conclusion comes after its rolls.** A card that ends in what the
  dice come to (`! {{event}}`, `=> … is named {{result?}}`) is written without
  that line; the command prints it for the model to write once it has read the
  rolls.
- **Everything is in the notes.** Decisions and table rolls in the session's
  `rpg log`; reasoning and hidden rolls in `rpg draft` blocks in the GM's
  notebook, which Obsidian renders with the draft block's Log.
- **Only the session is written.** The CLI's vault still refuses writes; the
  log and the notebook are written by `cli/rpg/write.ts`, which copies a note
  to `.rpg-backups/cli/` first (the last 40 are kept).

## Secret or open

`gm-mode:` in the session's frontmatter (`rpg gm mode <session> secret|open`;
secret when absent).

- **secret**: the notebook is `.gm/<session>.md` beside the session. Obsidian
  does not show dot-folders, so the player cannot stumble on it. Hidden rolls
  and reasoning go there; the log gets what the characters perceive.
  `rpg gm reveal <session> "<title>"` (or `--all`) moves prep into the open
  notebook, to review it after it has been played.
- **open**: the notebook is `<session> (GM).md` beside the session, read as
  play goes.

A notebook:

````md
## Standing notes

- The Tinkerer's devices still watch Kowyn.

## Prep

### The cult comes for the bag

status:: ready
when:: the party makes camp tonight
made:: S02 · 2026-11-16

```rpg draft
draft: The cult comes for the bag
gm: "[[00. GM Screen]]"
attach: ["[[Kobold, Elite]]"]
ask: encounter
---
(note: Serves Kowyn's stake: the cult wants the bag back more than him.)
? [CF:4] Did any kobold escape to warn the cult?
o: Fate Chart (Unlikely) d100=66 -> No
```
````

A question written into a draft states the Chaos Factor it was asked at
(`[CF:4]`): the draft does not hold the session's log to read it from.

## Sessions: what one is made of, and its lines

`rpg session manifest <session>` answers "what do I need to keep":

- **play**: the session note, the GM's notebooks, and every note under the
  party's folder (the folder above the sheets': `adventuring/` for
  `adventuring/characters/*.md`). Add others with `session-files:` in the
  session's frontmatter.
- **state**: the entries of the plugin's state file that name those notes (the
  log's bookkeeping baseline, `<note>#log1:sheet-baseline`, and what is done
  of it). They are in no note, and the state file is usually in `.gitignore`:
  a clone does not have them.
- **references**: what play reads and does not change (GM tools, maps,
  pictures, compendium notes).

A **line** is the play files and state entries as saved, under
`.rpg-sessions/<session>/<line>/`. One line is in the vault at a time, so
links, sheets and names stay as they are.

```sh
rpg session fork "<session>" llm-gm     # save "main", start "llm-gm" from here
rpg session switch "<session>" main     # save "llm-gm", put "main" back
rpg session lines "<session>"
rpg session pack "<session>" [--line main] [--full] [--out file.zip]
rpg session unpack file.zip [--force]
```

Switch with Obsidian closed, or run "Reload app without saving" after: the
plugin keeps its state file in memory and would write the old entries back.

## Not yet

- Fights: initiative, turns and positions are the log's fight cards, played in
  Obsidian. The model decides and rolls for the foes.
- The plugin has no button for any of this; it is a terminal's work.
- A line holds no map: fog and marks made on a shared map in one line stay in
  the other.
