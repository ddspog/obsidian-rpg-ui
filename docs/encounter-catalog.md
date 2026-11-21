# Encounter catalog

A catalog is a vault note of ready-made encounters for one party, each already checked against that party by the encounter simulator (`rpg sim`). It exists so a Game Master (a person, or a model that wants to spend few tokens) can ask for `catalog suggest --tag forest` and get a handful of encounters with their measured outcome, instead of sweeping the bestiary or reading a table by hand.

There is one catalog per party. It lives at `<system folder>/gm-tools/encounter-catalog/<party name in kebab-case>.md` (the system folder is the first path segment of the party's first PC note, e.g. `tales-of-the-valiant`). It is an ordinary note: edit it by hand. The commands read it from disk and write it back through the CLI's `writeNote`, which copies the old text to `.rpg-backups/cli` first; a write regenerates the whole note, so prose you add between the blocks is not kept.

## The file

Frontmatter names the party and the rules its entries are checked by; each entry is one fenced `yaml encounter` block.

````markdown
---
type: encounter-catalog
party: The Ashen Four
pcs:
  - tales-of-the-valiant/adventuring/characters/Kowyn.md
  - tales-of-the-valiant/adventuring/characters/Talon Pallton.md
difficulty: challenging # easy | challenging | deadly
session: 3 # the party's current session number
recheckEverySessions: 5 # a fit older than this many sessions is checked again; 0 turns it off
---

# Encounter catalog: The Ashen Four

```yaml encounter
id: arctic-t1-6-bandit-captain-2-bandit
name: "Arctic T1 #6: Bandit Captain + 2 Bandit"
monsters:
  - note: tales-of-the-valiant/worldbuilding/bestiary/creatures/Bandit Captain.md
    count: 1
  - note: tales-of-the-valiant/worldbuilding/bestiary/creatures/Bandit.md
    count: 2
tags: [arctic, tier-1, game-masters-guide, urban]
source:
  note: tales-of-the-valiant/gm-tools/tables/game-masters-guide/Arctic Encounters.md
  table: arctic-encounters-tier-1
  row: "6"
  book: game-masters-guide
review: confirmed # draft (read by a machine) | confirmed (read by a person)
notes: Defusing it without combat takes a DC 11 CHA check.
fit: # written by `catalog check`; do not edit
  state: fit # fit | too-easy | too-hard
  stamp: dbe18b8af548ded7 # the party this was simulated against
  difficulty: challenging
  winRate: 0.93
  tpkRate: 0.04
  avgHpLost: 0.47
  checkedOn: 2026-11-21
  checkedAtSession: 3
```
````

`count` is the number of that monster; `dice` (optional) keeps the text a table rolled it with (`1d4 + 1`), the count being its rounded average. `source`, `notes` and `fit` are optional; a missing `review` is `draft`, a missing `id` is made from the name.

## Commands

Every action takes `--catalog <vault path | party name>`; left out, it uses the one catalog the vault has (zero or several is a usage error that says what to pass). Output is one JSON document. Usage errors exit 1, runtime errors 2, as for the rest of `rpg sim`.

| Command                                                                                                              | What it does                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog init --party-name "<name>" [--pc <note>]… [--difficulty D] [--every N] [--session N] [--catalog path]`      | Creates the note (default PCs: the four stock characters). Refuses to overwrite one.                                                                                                                                                                                                                                                                                                                      |
| `catalog draft <note-or-folder>… [--min-confidence high\|medium\|low] [--accept] [--limit N]`                        | Reads the random-encounter table rows of those notes (or every note under a folder) into draft entries. **Without `--accept` it writes nothing**: it lists the drafts, high confidence first (default 40, with the total), for review. With `--accept` it adds the drafts at or above `--min-confidence` (default `high`) to the catalog, skipping any whose monsters and counts the catalog already has. |
| `catalog add --name "<n>" --monster "<note>[:<count>]"… [--tag t]…`                                                  | Adds a confirmed entry by hand. An unknown monster note is an error naming it.                                                                                                                                                                                                                                                                                                                            |
| `catalog confirm <id>…` / `catalog remove <id>…`                                                                     | Flips drafts to confirmed / deletes entries. An unknown id changes nothing.                                                                                                                                                                                                                                                                                                                               |
| `catalog check [--session N] [--seed N] [--trials N] [--rounds N] [--force] [--limit N]`                             | Simulates the entries that need it (below) against the party and stamps each with its fit. An entry that cannot load (a broken feature link) is listed in `errors` and skipped.                                                                                                                                                                                                                           |
| `catalog suggest [--tag t]… [--any-tag t]… [--state s]… [--include-stale] [--include-draft] [--limit N] [--refresh]` | Read-only. The confirmed entries whose current fit is `fit` (or the `--state`s given), every `--tag` matching, closest to the difficulty's aim first, default 10. `needsCheck` and a `hint` say when entries are out of date; `--refresh` runs `check` first.                                                                                                                                             |
| `catalog list [--tag t]… [--review r] [--state s]… [--limit N]`                                                      | Every entry, compactly, with the staleness of its fit marked.                                                                                                                                                                                                                                                                                                                                             |

A usual run: `init`, `draft <folder>` (read the dry run), `draft <folder> --accept`, `check`, `confirm` the drafts you keep, then `suggest` at the table.

## How fit and staleness work

`check` runs the Monte Carlo of `rpg sim run` (seed 1, 200 trials by default) for the entry's monsters against the catalog's PCs, and classifies the outcome against the difficulty with the same heuristic as `suggest --rank outcome` (`lib/domains/encounter-sim/fit.ts`): `fit` when the share of party HP lost and the TPK rate are near the difficulty's profile, `too-easy` when the fight costs less than aimed for, `too-hard` otherwise. The result is stored with the party's **stamp**, a digest of everything the simulator reads of the PCs (level, AC, HP, ability modifiers, spell slots, every modelled action). An entry is checked again when:

- it has no fit yet (`no-fit`);
- the party changed, i.e. its stamp differs (`party-changed`): a PC levelled, gained an attack, changed a note;
- the catalog's `difficulty` was edited (`difficulty-changed`);
- `recheckEverySessions` sessions passed since the check (`sessions-elapsed`; `--session N` sets the current session).

A `too-easy` or `too-hard` entry stays marked as such while the party is unchanged: it is not offered, and not simulated again. A stale or unchecked fit is unknown, so `suggest` leaves such entries out unless `--include-stale`. `check` is idempotent: a second run simulates nothing and does not rewrite the note. Only `checkedOn` comes from the clock; the simulation is seeded. A different `--seed` or `--trials` does not mark entries stale; use `--force`.

## Known limits of the extraction

Drafts are guesses made by `extractEncounter` (`lib/domains/encounter-catalog/extract-row.ts`) over the prose of a row, which is why they are `draft` until a person confirms them, and why `--accept` takes only `high` confidence by default.

- A row is taken only if it names a bestiary creature and reads like a fight; signs of a creature ("wolf tracks lead away") and still scenes are skipped. Both are counted in `skipped`.
- Counts are read from number words and dice (`1d4 + 1` becomes 3); a plural with no number is guessed as 2 (medium confidence). A phrase such as "a wolf pack of three wolves" is counted as four wolves (two mentions summed).
- Creatures a row names only to describe the scene (prey, a comparison, a cross-reference, reinforcements that come later) are mostly but not always left out; the `reasons` of each draft say what was dropped or guessed.
- Names the bestiary lacks ("five shriekers") are listed as `unresolved` and make the draft medium.
- Rows that are not combat but a skill challenge, a hazard or a roleplay scene are not entries at all.
- A fit is only as good as the simulator: spells it cannot model, control effects and monster spellcasting are left out (see the `fidelity` of `rpg sim run`), which makes monster-casters look easier than they are.
- Tags come from the table (environment, tier, CR band, book) and the monsters' habitats, lower-cased, so a "Forests" table has `forests` and its wolves' `forest`; `--tag` matches whole tags, case-insensitively.
