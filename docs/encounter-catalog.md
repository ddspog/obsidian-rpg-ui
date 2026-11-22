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
| `catalog prepare <id>…`                                                                                              | Writes a prepared line for each entry (`[Enc:[[<catalog>#^<id>\|Name]]\|<foes>\|prepared]`) at the end of the `rpg log` of the party's latest session note (below). Records nothing in the catalog: the run is recorded when a fight starts from it.                                                                                                                                                      |
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
- **Card actions:** **Confirm** (drafts only), **Prepare**, and **Tags**. Confirm and Tags write the catalog note; Prepare writes the party's latest session note (below). A prepared card says where ("prepared in 01. Journey…") and offers **Unprepare**.

Each entry is an `rpg encounter` block that renders as one line, so its YAML shows only in source mode. The note keeps the entries in a folded callout under the board ("N entries as written"); open it to edit one by hand. The parser reads entries inside or outside the callout. `yaml encounter` blocks from before are still read, and are rewritten as `rpg encounter` on the next write.

The board does not simulate. It judges staleness against the `profile` that `catalog check` writes to the frontmatter: the party's size, level, tier, benchmark, single-monster CR and stamp. Run `rpg sim catalog check` after the party changes. In the board, an entry with no tier tag counts as the party's tier, because the board does not read monster CRs; the CLI's `--tiers` does.

## Prepared encounters

**Prepare** readies an encounter for the table: it adds one Lonelog line at the end of the `rpg log` of the party's latest session note (the last, by path, of the notes in the catalog's system folder whose `pcs` are all the catalog's PCs and that hold an `rpg log`), with an Undo on its notice:

```
[Enc:[[tales-of-the-valiant/gm-tools/encounter-catalog/ashen-four#^forests-t1-9-8-baboon|8 Baboons]]|8 [[Baboon]]|prepared]
```

The tag holds the link to the entry (its block id, `^<id>`, written under each entry's fence), the foes as `count [[note]]` joined by `; `, and a state. The session log shows it as a quiet chip: the encounter's name (a link to the entry), its foes, and "prepared".

**Start Combat** lists the log's prepared encounters above its foes, the latest picked: picking one fills the foe box (one line a foe, numbered when there are several). Starting the fight appends the same tag with `fought S02` (the log's current scene) to the fight's opening `?` line, so the log stays append-only; from then on the prepared chip reads "fought in S02" and the encounter is no longer offered. When the log is saved, the plugin records the run in the catalog (`uses`, `lastUsedSession`, as `catalog use` does), so `suggest` and `plan` hold it back for `reuseAfterSessions`.

**Unprepare** takes the prepared line back out (only while it is unfought). `rpg sim catalog prepare <id>` writes the same line from the CLI (`lib/domains/session-log/prepared-encounter.ts` is shared).

## Adjusting an encounter: `catalog adjust`

`rpg sim catalog adjust [<id>…] [--state too-hard|too-easy]… [--limit N] [--accept [--pick N]] [--trials N]` takes entries that do not fit the catalog's party (the ids named, or with none the party tier's `too-hard` and `too-easy` entries, at most `--limit`, default 5; entries already adjusted are left out) and tries changes on each (`lib/domains/encounter-catalog/adjust.ts`):

- **Counts:** fewer of a group (easier) or more (harder).
- **Swaps:** a group for one of its equivalents (same role, the same subrole first; down the CR ladder when easier, up when harder; the same kind of creature first, so a humanoid stands in for a humanoid), at its count, one fewer, or one or two more.
- **Minions or a leader** (harder): two to six rank-and-file soldiers, or one leader, from the monsters the party can face alone, the entry's habitat first.
- **A group less** (easier), when there are several.

Every change is simulated against the party; the ones that fit are ranked by closeness to the difficulty's aim, a count change before a swap, a swap before a new or lost group when they are near. When no single change fits, a second change is tried on the three nearest attempts, each the way it missed; when still none fits, the nearest attempt is reported as `closest`, to show which way to go. Terrain and tactics cannot be simulated, so each entry also gets `tactics` in words (a choke point, letting the foes flee, an ambush…).

It is a dry run: `--accept` adds the best change of each entry (or `--pick N`) as a new **draft** with `adjustedFrom: <id>`, `adjustment: "<what changed>"`, the original's tags plus `adjusted`, its source and scene, and its fit. The original stays as it was, so the catalog grows: an encounter table written for four PCs gets versions for a party of two or six. Not built yet: templates (they need a statblock rewritten).

On the testing vault, for the stock party of four at challenging, the first eight entries that did not fit all found a fitting change, for example 7 Kobolds instead of 5, 1 Druid instead of 2, 3 Glass Mephits instead of 4 Ice Mephits. For a party of two, 53 of 58 checked entries were too hard; the first five all found one, the Bandit Captain fight without the captain among them. About 30 s for eight entries at 100 trials, most of it reading the bestiary's roles once.

## Monster roles and equivalents

The Monster Vault sorts monsters into four roles ("Monster Roles and Tactics"), each split here into subroles (the tree the owner chose):

| Role           | What it does                                         | Subroles                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controller** | hinders the party, often many at once                | **hexer** (frightened, poisoned, disadvantage, curses), **disabler** (paralyzed, stunned, petrified, charmed), **zoner** (areas, webs, walls, difficult terrain), **mover** (pushes, pulls, knocks prone, teleports foes) |
| **Leader**     | makes its allies better                              | **commander** (grants attacks, movement, advantage), **healer** (restores HP), **warder** (temporary HP, resistances, AC, fear immunity), **summoner** (calls, raises or creates allies)                                  |
| **Soldier**    | moderate damage, plenty of HP and AC, holds the line | **rank-and-file** (weak alone, fought in numbers), **guardian** (draws attacks, protects allies), **brute** (big HP, steady melee), **pinner** (grapples, restrains)                                                      |
| **Striker**    | heavy damage to one target, light defence            | **bruiser** (melee burst: pounce, charge, extra dice), **skirmisher** (hits and moves away), **ambusher** (strikes from hiding), **artillery** (damage from range), **solo** (legendary, fights alone)                    |

Tags sit outside the tree and only break ties between equivalents: `flier`, `caster`, `legendary`, `swarm`.

A statblock writes its role and subrole in its `rpg stat.monster` fence (`role: "striker"`, `subrole: "ambusher"`); otherwise `rpg sim` guesses them (`lib/domains/encounter-sim/monster-role.ts`):

- **The role** from its hit points, AC and best damage in a round against its CR's row of the Creature Statistics by Challenge Rating table (Homebrewer's Toolbox), from what its features say (conditions it deals, not ones it is spared; areas; forced movement and control spells; help given to allies and support spells; teleporting, hiding and extra damage; guarding), and from its name when it says the role (the role templates' Goblin Controller, Worg Soldier…) or a rank (Captain, Priest…). The role scoring is kept as the owner reviewed it on 2026-11-21.
- **The subrole** among its role's subroles, from finer signals (which conditions, which spells, ranged-only attacks, moving to hide or moving away, a big HP pool, low CR). It never moves the role. With nothing pointing anywhere, a role's first subrole (a soldier of CR 2 and up: brute).

Each guess has a confidence (how far the top role is ahead of the next), the runner-up role when close (`alt`), its reasons and its tags. A written role always wins; a written role with no subrole gets the subrole the guess leans to within it.

| Command                                                                            | What it does                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles [<note>…] [--role R]… [--habitat H] [--type T] [--cr C] [--limit N]`        | Read-only. Every monster's role and subrole (written, or the guess), least sure first, with counts by role, subrole and confidence. `--role` takes a role or a subrole.                                                                                                                                                                                 |
| `roles --write [--min-confidence high\|medium\|low]`                               | Writes the guesses at or above the confidence (default `high`) as `role:` and `subrole:` in their statblocks, never over a written role.                                                                                                                                                                                                                |
| `roles --set "<note>=<role>/<subrole>"…`                                           | Writes those (over any written): the role alone, or the subrole alone with its role implied.                                                                                                                                                                                                                                                            |
| `equivalents "<note>" [--role R] [--steps N] [--habitat H] [--type T] [--limit N]` | The monsters of its role within `--steps` (1) of its CR on the ladder (… 1/4, 1/2, 1, 2 …): the same subrole first, then the nearest CR and the most alike in HP and damage, shared tags breaking ties, one of another family before one of the same. `--role` looks for another role or subrole. `--habitat` and `--type` keep the swaps of a setting. |

**Unsure guesses.** When the top role leads the next by less than 0.5, a signature feature decides instead (`rule` on the guess, first match wins): legendary (not a caster) is a striker/solo; Create/Call/Animate is a leader/summoner; a healing touch is a leader/healer; a command or an aura of authority is a leader/commander; camouflage, invisibility or earth glide is a striker/ambusher; Pounce, Charge or Rampage is a striker/bruiser; a dragon is a striker/bruiser; incorporeal movement, flyby or a teleport is a striker/skirmisher; constrict or swallow is a soldier/pinner; a web is a controller/zoner; then a plain CR 1 or lower is soldier/rank-and-file and a big plain beast, giant or construct a soldier/brute. On the testing vault's 439 unsure guesses, reviewed one by one (2026-11-22), the scores alone matched the review for 230 and the rules for 259 (role alone 253 and 281). The rules help, but an unsure guess is still a coin toss more often than not, so the better strategy is a review: `rpg sim roles --confidence low --features` prints each unsure monster's stats and features as prose (a dossier a person or a model decides from), and `--set "<note>=<role>/<subrole>"` writes the decisions. Drafting the rules from the most common corrections is how they should keep improving.

**In Obsidian** the statblock's header shows the role as a small ribbon in its role's colour (the plugin's own colours, each at 4.5:1 or better as text and as a fill, light and dark), with the CR. When the name would not fit on one line beside them (a long name on a phone), the chip moves to the type line, before the subrole, and the bar keeps the name and the CR. The type line ends with the subrole after a dot in the role's colour. A guessed role is a pale tint of its colour, dashed, with "?" (Settings › Statblocks and block notes › Guessed monster roles: every guess, fairly sure and up (the default), or none). Tapping the chip (or Enter) opens one line under the type line with what the subrole means and, for a guess, how sure it is and the `--set` that settles it.

On the testing vault (2026-11-22) every one of the 986 monsters has a written role: the 547 sure and fairly sure guesses the owner reviewed, and the 439 unsure ones reviewed one by one and written with `--set` (209 of them changed). Written: 353 controllers, 350 soldiers, 233 strikers, 50 leaders. The four role-template examples are named for their role; with the name left out, two of the four come out right, so read an unwritten guess as a suggestion.

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
