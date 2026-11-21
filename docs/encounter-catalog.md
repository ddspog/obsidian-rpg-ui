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
reuseAfterSessions: 3 # an encounter run at session S is offered again from session S + 3; 0 at once
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
  text: "A bandit captain and two bandits demand a toll at the frozen ford." # the row's own words
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
uses: 1 # written by `catalog use`
lastUsedSession: 2
```
````

`count` is the number of that monster; `dice` (optional) keeps the text a table rolled it with (`1d4 + 1`), the count being its rounded average. When a count is rolled, `check` also simulates every rolled count at its fewest and at its most and writes the states as `fit.atMin` and `fit.atMax` (a `fit` encounter that is `too-hard` on a high roll says so). `source.text` is the table row's own words (drafts keep it), so a Game Master can dress the encounter without opening the table; `suggest`, `list` and `plan` print it as `scene`. `source`, `notes`, `fit`, `uses` and `lastUsedSession` are optional; a missing `review` is `draft`, a missing `id` is made from the name, a missing `reuseAfterSessions` is 3.

Tags are matched plural or not (`--tag forests` finds `forest`), and `draft` writes one spelling per tag, the bestiary's habitat when one folds alike: a "Forests" table's wolves are tagged `forest`, not `forests` and `forest`.

## Commands

Every action takes `--catalog <vault path | party name>`; left out, it uses the one catalog the vault has (zero or several is a usage error that says what to pass). Output is one JSON document. Usage errors exit 1, runtime errors 2, as for the rest of `rpg sim`.

| Command                                                                                                              | What it does                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog init --party-name "<name>" [--pc <note>]… [--difficulty D] [--every N] [--session N] [--catalog path]`      | Creates the note (default PCs: the four stock characters). Refuses to overwrite one.                                                                                                                                                                                                                                                                                                                      |
| `catalog draft <note-or-folder>… [--min-confidence high\|medium\|low] [--accept] [--limit N]`                        | Reads the random-encounter table rows of those notes (or every note under a folder) into draft entries. **Without `--accept` it writes nothing**: it lists the drafts, high confidence first (default 40, with the total), for review. With `--accept` it adds the drafts at or above `--min-confidence` (default `high`) to the catalog, skipping any whose monsters and counts the catalog already has. |
| `catalog add --name "<n>" --monster "<note>[:<count>]"… [--tag t]…`                                                  | Adds a confirmed entry by hand. An unknown monster note is an error naming it.                                                                                                                                                                                                                                                                                                                            |
| `catalog confirm <id>…` / `catalog remove <id>…`                                                                     | Flips drafts to confirmed / deletes entries. An unknown id changes nothing.                                                                                                                                                                                                                                                                                                                               |
| `catalog tag <id>… [--add-tag t]… [--drop-tag t]…`                                                                   | Adds and drops tags (a dropped tag matches plural or not). Reports the entries that changed.                                                                                                                                                                                                                                                                                                              |
| `catalog use <id>… [--session N]`                                                                                    | Records that the encounters were run (`uses`, `lastUsedSession`, default the catalog's session). `suggest` and `plan` hold an entry back until `reuseAfterSessions` sessions have passed (`--include-used` shows it); `suggest` reports how many as `recentlyUsed`.                                                                                                                                       |
| `catalog session [--session N]`                                                                                      | Sets the catalog's session: given, or counted from the vault's session notes (`rpg session list`: an `rpg log` and `pcs`) in the party's system folder whose every PC is one of the catalog's. Lists the notes counted.                                                                                                                                                                                   |
| `catalog check [--session N] [--seed N] [--trials N] [--rounds N] [--force] [--limit N]`                             | Simulates the entries that need it (below) against the party and stamps each with its fit. An entry that cannot load (a broken feature link) is listed in `errors` and skipped.                                                                                                                                                                                                                           |
| `catalog suggest [--tag t]… [--any-tag t]… [--state s]… [--include-stale] [--include-draft] [--limit N] [--refresh]` | Read-only. The confirmed entries whose current fit is `fit` (or the `--state`s given), every `--tag` matching, closest to the difficulty's aim first, default 10. `needsCheck` and a `hint` say when entries are out of date; `--refresh` runs `check` first.                                                                                                                                             |
| `catalog list [--tag t]… [--review r] [--state s]… [--limit N]`                                                      | Every entry, compactly, with the staleness of its fit marked.                                                                                                                                                                                                                                                                                                                                             |

A usual run: `init`, `draft <folder>` (read the dry run), `draft <folder> --accept`, `check`, `confirm` the drafts you keep, then `plan` or `suggest` at the table, `use` what was run, and `session` after each session (then `check`, so fits older than `recheckEverySessions` are simulated again).

`catalog suggest --brief` prints the short form a model reads: each entry's groups as `--monster` takes them (`"Wolf:3"`), its fit flattened (`fit`, `winRate`, `tpkRate`, `avgHpLost`), one entry to a line; the catalog path, party, session and partition are left out (`needsCheck` and the `hint` stay).

## Planning an encounter in one call: `rpg sim plan`

`rpg sim plan [<theme words>] [--habitat H] [--tag t]… [--any-tag t]… [--type T] [--cr C] [--base "<note>[:n]"]… [--difficulty D] [--limit N] [--catalog c | --pc <note>…]` answers "what could this party fight next?" with a few options (default 3) in one read-only call, so a Game Master model needs no second round trip:

1. **The catalog first.** The party's catalog (the one in the vault, or `--catalog`) is read, unless `--pc` names a party of its own. Its entries whose fit is current and `fit` are offered, confirmed ones (`"from": "catalog"`) before drafts (`"from": "catalog-draft"`), then those that match more theme words, then the closest to the difficulty's aim. Theme words are matched against an entry's name, tags and monster names (a plural finds its singular: "wolves" finds Wolf); `--habitat` against its tags (plural or not: `forests` finds `forest`); `--type` and `--cr` against its monsters' notes; `--tag`/`--any-tag` as for `catalog suggest`. A catalog judged at another difficulty than `--difficulty` is not offered (its fits are for its own); without `--difficulty` the catalog's is used.
2. **Then the bestiary.** When the catalog gives fewer than `--limit`, the bestiary is swept as `suggest --rank outcome` does, for the same party and difficulty, with `--habitat`, `--type`, `--cr` and `--base`, the theme words keeping the monsters whose name, type or category holds one. Its `fit` groups fill the rest (`"from": "sweep"`), never one the catalog already offered. When no monster the theme words name fits, it sweeps again without them and says so.

Each option has its `monsters` as `--monster` takes them (pass them to `sim run` or `catalog add` as they are), its `fit` and the measured `winRate`, `tpkRate` and `avgHpLost`. `notes` says what the caller should know: catalog entries left out because their fit is stale (run `catalog check`), drafts to confirm, a swept group that can be kept with `catalog add`, a party whose CR benchmark is 0 (nothing to sweep toward), or a sweep that found nothing. `plan` writes nothing. The sweep costs what `suggest --rank outcome` does (about 20 s over the whole bestiary for the four stock characters, 2 to 3 s with a habitat or theme words); it is skipped when the catalog fills the options.

## In Obsidian: the board

The note opens with an `rpg encounter-catalog` block (body `view: encounter-catalog`). The plugin renders it as the catalog's board (`lib/views/EncounterCatalogView.tsx`, `lib/components/encounter-catalog/`):

- **Party header:** the party, its PCs, and chips for tier, size and level, benchmark, single-monster CR range, difficulty and session.
- **Fit strip:** how many encounters of the party's tier fit, are too easy, too hard, or need a check. Click a segment or the legend to filter.
- **Search and toggles:** search across names, tags, monsters and scenes; show or hide drafts; add lower tiers.
- **A card per encounter**, best first:
  - its monsters, each a link to its note;
  - the scene;
  - a gauge of the share of party HP the fight costs, with the band where it fits and a dashed line at the difficulty's aim;
  - the wipe and win rates;
  - what a high or low roll does to a rolled count.
- **Card actions:** **Confirm** (drafts only), **Ran it** (`catalog use`), and **Tags**. Each action writes the note.

Each entry is an `rpg encounter` block that renders as one line, so its YAML shows only in source mode. The note keeps the entries in a folded callout under the board ("N entries as written"); open it to edit one by hand. The parser reads entries inside or outside the callout. `yaml encounter` blocks from before are still read, and are rewritten as `rpg encounter` on the next write.

The board does not simulate. It judges staleness against the `profile` that `catalog check` writes to the frontmatter: the party's size, level, tier, benchmark, single-monster CR and stamp. Run `rpg sim catalog check` after the party changes. In the board, an entry with no tier tag counts as the party's tier, because the board does not read monster CRs; the CLI's `--tiers` does.

## The party's tier

Every command that offers encounters first profiles the party (`lib/domains/encounter-sim/party-profile.ts`):

- its size and average level (levels summed, divided by the number of PCs, rounded down);
- its tier of play: 1 for levels 1–4, 2 for 5–10, 3 for 11–16, 4 for 17–20;
- its challenging benchmark;
- the CR range of a single challenging monster, from the Monster Vault's _Challenging Benchmarks by Average Level_ table.

The profile is printed as `profile`, for example `{ "size": 4, "averageLevel": 1, "tier": 1, "benchmark": "1/2", "singleCr": "1/8-1/2" }`.

`--tiers` decides which encounters belong:

- **`same`** (the default): an entry drafted from a table belongs when one of its `tier-N` tags is the party's tier (a "Tier 3–4" table tags both). An entry without a tier tag, such as one added by hand, belongs when none of its monsters is above the party's max single-monster CR. In `suggest` and in the sweep of `plan`, a monster above that CR is left out and counted as `above-tier`.
- **`lower`**: also lower tiers, for story reasons (they give less XP). Such an entry is marked `belowTier`.
- **`all`**: every tier.

`check` simulates only the entries in scope and reports the others as `otherTier`. `suggest` and `plan` count only in-scope entries when they say what needs a check. `list` shows every entry unless `--tiers` is written.

The random-encounter tables are written for a party of four (`TABLE_PARTY_SIZE`). The simulator always uses the real PCs, so an entry's fit is already measured for the party's real size.

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
