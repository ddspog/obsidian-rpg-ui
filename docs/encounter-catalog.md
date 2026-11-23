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

| Command                                                                                                              | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog init --party-name "<name>" [--pc <note>]… [--difficulty D] [--every N] [--session N] [--catalog path]`      | Creates the note (default PCs: the four stock characters). Refuses to overwrite one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `catalog draft <note-or-folder>… [--min-confidence high\|medium\|low] [--accept [--only <id>]…] [--limit N]`         | Reads the random-encounter table rows of those notes (or every note under a folder) into draft entries. **Without `--accept` it writes nothing**: it lists the drafts, high confidence first (default 40, with the total), for review. Each draft shows its row (`scene`) and its `reasons`. With `--accept` it adds the drafts at or above `--min-confidence` (default `high`) to the catalog, skipping any whose monsters and counts the catalog already has; `--accept --only <id>…` adds just the drafts a review kept, whatever their confidence. |
| `catalog add --name "<n>" --monster "<note>[:<count>]"… [--tag t]…`                                                  | Adds a confirmed entry by hand. An unknown monster note is an error naming it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `catalog confirm <id>…` / `catalog remove <id>…`                                                                     | Flips drafts to confirmed / deletes entries. An unknown id changes nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `catalog tag <id>… [--add-tag t]… [--drop-tag t]…`                                                                   | Adds and drops tags (a dropped tag matches plural or not). Reports the entries that changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `catalog use <id>… [--session N]`                                                                                    | Records that the encounters were run (`uses`, `lastUsedSession`, default the catalog's session). `suggest` and `plan` hold an entry back until `reuseAfterSessions` sessions have passed (`--include-used` shows it); `suggest` reports how many as `recentlyUsed`.                                                                                                                                                                                                                                                                                    |
| `catalog prepare <id>…`                                                                                              | Writes a prepared line for each entry (`[Enc:[[<catalog>#^<id>\|Name]]\|<foes>\|prepared]`) at the end of the `rpg log` of the party's latest session note (below). Records nothing in the catalog: the run is recorded when a fight starts from it.                                                                                                                                                                                                                                                                                                   |
| `catalog session [--session N]`                                                                                      | Sets the catalog's session: given, or counted from the vault's session notes (`rpg session list`: an `rpg log` and `pcs`) in the party's system folder whose every PC is one of the catalog's. Lists the notes counted.                                                                                                                                                                                                                                                                                                                                |
| `catalog check [--session N] [--seed N] [--trials N] [--rounds N] [--force] [--limit N]`                             | Simulates the entries that need it (below) against the party and stamps each with its fit. An entry that cannot load (a broken feature link) is listed in `errors` and skipped.                                                                                                                                                                                                                                                                                                                                                                        |
| `catalog suggest [--tag t]… [--any-tag t]… [--state s]… [--include-stale] [--include-draft] [--limit N] [--refresh]` | Read-only. The confirmed entries whose current fit is `fit` (or the `--state`s given), every `--tag` matching, closest to the difficulty's aim first, default 10. `needsCheck` and a `hint` say when entries are out of date; `--refresh` runs `check` first.                                                                                                                                                                                                                                                                                          |
| `catalog list [--tag t]… [--review r] [--state s]… [--limit N]`                                                      | Every entry, compactly, with the staleness of its fit marked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

A usual run: `init`, `draft <folder>` (read the dry run), `draft <folder> --accept` (the high ones), then the medium ones a review keeps with `draft <folder> --accept --only <id>…` (`--min-confidence medium --limit 400` lists them all), `check`, `confirm` the drafts you keep, then `plan` or `suggest` at the table, `use` what was run, and `session` after each session (then `check`, so fits older than `recheckEverySessions` are simulated again).

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

## Building a new encounter: `rpg sim build`

`rpg sim build [<theme words>] [--model single|double|boss|matched|horde]… [--habitat H] [--type T] [--limit N] [--accept [--pick N]]` makes new encounters from the Monster Vault's encounter models ("Combat Encounter Models"), for the catalog's party (or `--pc`) and difficulty (`lib/domains/encounter-catalog/build.ts`, `cli/rpg/sim/build.ts`):

| Model                | Built from                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single big monster   | one monster with a CR near the party's challenging benchmark, a legendary one or a striker/solo first                                               |
| Double trouble       | two of a kind, each about half the benchmark (not leaders)                                                                                          |
| Boss and lieutenants | a leader, controller or solo of about half the benchmark, and two to six soldiers or strikers sharing the other half                                |
| Matched set of foes  | as many soldiers or strikers as PCs, each about a quarter of the PCs' level (half from 5th level), no stronger than one the party can take on alone |
| Horde of minions     | six to thirty rank-and-file soldiers adding up to the benchmark                                                                                     |

The pool is the bestiary with its roles, kept to the theme words (matched against a monster's name, type, habitat and family folder), `--habitat` and `--type`. Each model is filled with the monsters nearest the CR it calls for, its largest group also tried one fewer and one more (not a single or a double); every candidate is simulated, and the ones that fit come back best first, at most two a model and one size of an encounter (`--limit`, default 5). The name and the scene are the Game Master's to write. `--accept` (with a catalog) keeps the best, or `--pick N`, as a draft tagged `built` and its model, stamped for the party.

On the testing vault (the stock level-1 party, challenging) a run takes about 30 s, most of it reading the bestiary's roles: with no theme it offered 3 Alley Sprites, 5 Alligators and 4 Axe Beaks; with `goblin`, 4 Goblins (matched set) and 2 Hobgoblins (double trouble); with `undead`, 4 Giant Owl Grims and 4 Fades. A level-1 party's benchmark (1/2) leaves little room for a boss and lieutenants: the models open up with level.

## A new creature: `rpg sim homebrew`

`rpg sim homebrew "<base note>" --name "<new name>" [--role controller|leader|soldier|striker] [--cr C] [--type "<type line>"] [--habitat H] [--write]` makes a creature from a bestiary statblock, as the Game Master's Guide's "Modifying a Stat Block" describes (`cli/rpg/sim/homebrew.ts`):

- **Reflavoured:** the new name, and `--type` / `--habitat` for a new type line or habitat.
- **A role template** (`--role`; Game Master's Guide pp. 221–223): the `Role (Controller|Leader|Soldier|Striker)` template note applied as `--template` applies any other (its features from `Monster Template Traits`, Hold On's d4s and Ambushing Strike's extra worked out for the CR). Controller adds Spellcasting Multiattack and a Spellcasting whose spells are left for the GM to choose (abjuration, enchantment, transmutation); leader adds Inspiring Leader and Tactical Commands; soldier adds Warrior's Advance and Protect Ally; striker adds Shrouded Step and Ambushing Strike. `role:` and the template's subrole are written.
- **A new CR:** HP scaled by the CR table's HP for the new CR over the old, AC moved by the table's difference; features that pick their numbers by CR (the newer NPC lineage features, `auto: "cr"`) re-pick them, a numeric `tier` on a reference being dropped. Attack damage written as plain text cannot be rescaled: the output gives the damage per round now and the table's for the new CR, to rewrite by hand.

- **A creature template** (`--template <name> [--choose <option>] [--trait "<feature>"]…`): see below.

It is a dry run that prints the statblock; `--write` writes `<system>/worldbuilding/bestiary/homebrew/<name>.md` (`homebrew: draft`, `based-on`, `templates`), never over a note that exists. The new creature is in the bestiary at once: `roles`, `build`, `adjust` and `sim run` use it. Features kept from the base that name it ("the wolf's Perception") are reported, to reword by hand.

### Creature templates: `--template` and `rpg sim templates`

The vault keeps the creature templates as notes in `<system>/worldbuilding/bestiary/templates/`: the Game Master's Guide's (Clockwork Construct, Dragon Lich, Element-Infused, Lycanthrope, Shadow, Skeleton, Skeleton (Dragon), Skeleton (Swordbreaker), Thread-Bound Construct, Zombie, Zombie (Dragon), and the four Role templates), Monster Vault 2's and the Labyrinth Worldbook's (Demon Caller, Fey Champion, Gloomrot Hulk, Greatwyrm, Grim, Hellspawn, Lost, Many-Handed Familiar, Nightbound, Prescient, Skeleton (Tar), Void, Void-Blessed), The Old Margreve's Bramble Beast, Night Hunters' Painted Nightmare, and Minion (the Game Master's Guide's Minions and Hordes rules written as a template). `lib/domains/statblocks/monster-template.ts` reads a note's prose; `template-block.ts` turns it into the changes a `rpg stat.template` block holds (`{ stat: hp, percent: -10 }`, `{ stat: abilities, atMost: { dex: -2 } }`, a line it cannot read as `{ stat: note }`) and applies a block to a creature. `rpg sim templates --write` writes each note's block after its introduction (a block already there is kept, corrected by hand or not; `--force` writes it again from the prose); `homebrew --template` and the sheet use the block.

Homebrew templates for the creature types no book template turns a creature into (each marked `homebrew: true`, written in the book's format from the Tome of Adventure Design's monster tables): Ooze-Born, Dire, Chimeric, Aberrant, Draconic, Elemental-Bound, Fey-Touched, Celestial Herald, Giant-Kin, Swarm and Mist-Form. The Threnodic Dragon (Night Hunters) is rebuilt from the villain notes, where the import had interleaved its columns. The four role templates are template notes too: `--role` applies them, and their features live in `Monster Template Traits` like the others.

### Lineages (`rpg sim lineages`)

A lineage is a template of kind `lineage` for the NPC statblocks written "Humanoid (Any Lineage)" (70 in the bestiary): a guard becomes a dwarf guard, a mage apprentice a kobold mage apprentice (`lib/domains/statblocks/lineage-template.ts`, `cli/rpg/sim/lineages.ts`). Two sources, the book's first:

- the Monster Vault's **NPC Features** table (Appendix, NPCs): each humanoid's row (darkvision, speeds, resistances, and its traits and actions taken as refs from its own statblock; the NPC's CR at least the humanoid's; save DCs to raise by hand);
- each lineage note's traits (`*Size.*`, `*Speed.*`, `*Darkvision.*`… paragraphs, or `######` headings), reworded from the player's "you" to a statblock's "the dwarf" and written to `worldbuilding/traits/features/Lineage NPC Traits.md`; a trait only a player character uses (levels, skills, talents, ability scores) is listed, not added.

`rpg sim lineages [--write [--force]]` lists them and writes each one's `rpg stat.template` block (with `id: npc`) at the end of its own lineage note, so one record holds the lineage and its NPC side. A list of lineages leaves the NPC block out with `.omit(npc)` (the Player's Guide's `` `@[[traits/lineages/]].omit(npc).highlight().tab()` ``, the topic pages' `.omit(npc).bare()` embeds); the lineage note itself shows both. A humanoid of the NPC Features table with no lineage note (Bugbear, Gnoll, Hobgoblin, Lizardfolk, Sahuagin…) gets a note of its own in `bestiary/templates/lineages/` (frontmatter `npc-lineage: true`); the monster lists (which filter by CR) leave these notes out. A humanoid's row also names the save DC to raise the NPC's to (the highest DC of its statblock). The sheet shows a "Lineage" chip; Try on names the result "Dwarf Guard" and saves it with **Save as NPC**; `rpg sim homebrew "Guard" --name "Dwarf Guard" --template dwarf` does the same from the CLI.

A template that asks to "choose a Humanoid" (the Lycanthrope) takes a lineage: `--choose elf`, or the Humanoid picker in Try on. Its senses, resistances, traits and tag are added, INT/WIS/CHA rise to +0 at least, and the Lycanthrope's Change Shape fills `[Size] [Beast]` from the base creature ("a Huge giant elk"); the book's size, speed and languages in Humanoid form stay to do by hand.

### The template sheet (`rpg stat.template`)

The block renders as a statblock of changes (`lib/components/statblock-template.tsx`): what the template applies to under the name, one row a change (green what the creature gains, red what it loses), the ability modifiers it caps or raises, the features it gives (by kind, a list to choose from apart, a feature one choice gives marked with it), and the things to do by hand folded at the end. **Try on** applies it to any creature of the bestiary (a search box): the result is the monster statblock with the changed values marked and the old ones struck, the features it added edged in green, whether it fits, and what is left by hand; a template with a choice (an element, a season) has a control for it, one with a list a checkbox each. **Save as homebrew** writes the result to `<system>/worldbuilding/bestiary/homebrew/<name>.md` as `rpg sim homebrew` does (`lib/domains/statblocks/homebrew-note.ts`), never over a note.

### Summons (`rpg stat.summon`)

A creature whose numbers come from whoever calls it: a spell's circle, the summoner's PB or class level (`lib/domains/statblocks/summon.ts`, `formula.ts`, `lib/components/statblock-summon.tsx`). Its stats and features hold formulas (`ac: "{{ 13 + circle }}"`, `"{{ floor(pb / 2) }} attacks"`: + − × ÷, parentheses, floor, ceil, round, min, max), over `params` (`circle: { min: 7, max: 9, ordinal: true }`; `attack: { default: 9, from: "pb + max(mod_int, mod_wis, mod_cha)" }`). A bar under the type line picks the summoner (a character note: `level`, `pb`, `level_<class>`, `mod_<ability>`; the character whose note it is opened from by default), the parameters and the `forms` (a form's stats replace the block's, its features are added). Each worked-out number is underlined and shows its formula on a tap. `apply:` makes a thrall: a creature of the bestiary with one of `templates` applied, of the `types` given, adding `ac` and `damage` formulas (the Necromancer's skeleton or zombie). In the vault: Leviathan Avatar (Summon Leviathan Avatar), Clockwork Companion (Tinker), Animated Item (Crafting Domain), Beast Spirit (Pack Master) and Undead Thrall (Necromancer).

- **What it applies to** from "This template can be applied to …": creature types, true dragons of an age, "Small or smaller", a CR or INT bound; the rest ("that worships the Void") is reported to check.
- **Statistics** from the `**Label.**` lines, carried out by `apply-template.ts` where the words are plain: a new type or tag, hit points by a percentage (or a flat amount, or only up to a CR), AC (a bonus, a natural armor floor, DEX lowered), a CR raised, resistances, immunities and vulnerabilities (a vulnerability that replaces a resistance), darkvision and other senses, the languages it understands, ability modifiers raised or lowered to a value, speeds, Perception or Stealth plus the proficiency bonus. Perception and Stealth follow a WIS or DEX that changes, AC a DEX that drops. A line it cannot carry out comes back under `byHand`.
- **Choices**: a template that asks for one (Element-Infused's element, the Fey Champion's season, the Gloomrot Hulk's corruption) takes `--choose` (an option or a damage type: `fire`, `summer`, `air:thunder`); the damage "you chose" and "you didn't choose" then fill the defence lines, and the features the rules give one season only are given for that season.
- **Features** from the `***Name.***` paragraphs of Traits, Actions, Bonus Actions, Reactions and Legendary Actions, as `rpg feature.details` blocks in `<system>/worldbuilding/traits/features/Monster Template Traits.md` (ids `"<Template>: <Name>"`, the template's noun as `{{ self.name() }}`). `rpg sim templates --write` writes that note from the template notes (and `homebrew --template --write` when it is missing or older). The book's bracketed formulas become parameters each statblock fills: `DC # [10 + the creature's CON modifier or matches the save DC of the creature's other features, whichever is higher]`, `[55 percent of HP maximum]`, `[half the dragon's CR, rounded down]`, `[PB + the creature's CHA modifier]`, `[base + 5]` (Perception), a breath weapon's or Frightful Presence's DC. One that needs a person ("the damage dice of the chosen primary attack") is reported. A feature name may carry one ("Overdrive (54 HP or Fewer)").
- **What it does not add:** a list to choose from (Demon Caller's manifestations: `--trait Stench --trait "Spider Climb"`), a paragraph that changes a feature the creature has ("Bite. If the dragon dealt any damage type…", Elemental Roar becoming Necrotic Roar), a rule of play ("half of that damage is cold"), and what the creature loses (Amphibious, Spellcasting, breath weapons, Change Shape): all reported under `byHand`.
- A trait named "… Resilience" is written on the defence line it grants, as the book's statblocks do (`immune: Undead Resilience`).

`rpg sim templates ["<base>"]` lists the templates (what each applies to, changes, asks to choose and adds) and, with a monster, which fit it. Applied to the book's own bases, the result matches its example monsters' hit points, speeds, defences, senses and languages (Owlbear Zombie, Adult Blue Dragon Zombie, Young Silver Dragon Skeleton, Veteran Swordbreaker Skeleton, Adult Red Dragon Lich, Thread-Bound Death Dog, Lightning-Infused Cloaker). The book's examples lower AC and Perception less than their own rule says (a zombie owlbear keeps AC 12 although its DEX falls by 3); the command follows the rule.

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

## Calibration: the simulator against real play

`rpg sim calibrate [<session note or folder>…] [--seed N] [--trials N] [--rounds N] [--difficulty D]` (`cli/rpg/sim/calibrate.ts`, read-only) reads every fight a session log records (`[COMBAT]` … `[/COMBAT]`): its foes (the `[F:…]` tags first written since the fight before, "Fat [[Kobold, A]]" counted as a `Kobold, A`), the party (the note's `pcs`), the party's HP as the fight opened and closed (from the sheets, less what the log did, as the log block folds it), its rounds and who dropped. It simulates the same fight and places the real one among the simulated: `hpLost` against `avgHpLost` and its spread (`z`), the share of simulated fights that cost no more than the real one (`percentile`), and the fit each would get. Across fights, a mean percentile that stays low says the simulator makes fights harder than play finds them (high: easier). With fewer than 10 fights it says the outcome profiles should not be tuned from them.

On the vault's one logged fight (four level-1 PCs against an elite kobold, a tinkerer and two kobolds) the simulator predicted 89% HP lost and a 77% TPK; the party won in two rounds having lost 22% (the 0.5th percentile). Part of the gap was the engine's (fixed): a "(Recharge 5-6)" action was used every turn and an area hit the whole party. The rest is what the simulator does not model yet (the party's conditions and control, monsters always on the weakest PC, PC features); the profiles are left as they are until more fights are logged.

**Borderline fits.** A fit carries sampling error: 200 trials leave about ±1.5 points on a rate. `fitMargin` (`lib/domains/encounter-sim/fit.ts`) gives the distance from the difficulty's profile a standard error (HP lost: its per-trial spread over the root of the trials; TPK: a binomial's), and a fit within two standard errors of the tolerance is borderline. `catalog check` runs a borderline entry again with four times the trials (at most 2000), stores `trials` when it did, and marks the fit `borderline: true` when it is still near the edge; `check` reports `borderlineRuns` and `borderline`, `list` and `suggest --brief` show it. Measured on a catalog of the Game Master's Guide's 243 high drafts over five seeds: 7 entries changed their fit between seeds, and every one was flagged borderline in at least one of the runs.

**Conditions, riders, targets.** A condition an action puts on its target is played: the PC's from the character sheet (`inflicts` of a spell or weapon: Luminous Bolt blinds on a failed CON save, Magnetobolt knocks prone, Toxic Plume poisons), a monster's from its prose ("must succeed on a DC 13 Strength saving throw or be knocked prone", "the target is poisoned until the end of its next turn", "and is knocked prone" after a failed save). Blinded, prone, restrained, poisoned and frightened give the creature disadvantage on its attacks; blinded, prone, restrained, stunned and paralyzed give attacks against it advantage; stunned, paralyzed and incapacitated lose it its turns. A condition lasts to the end of the target's next turn unless its words say otherwise ("1 minute": the fight, a save at the end of each of its turns; prone until it stands, at the start of its turn). At equal damage, an action that also hinders is preferred. A PC's damage rider from the sheet is added to its hits: a mark (Mystic Mark: a use marks the target, and every hit on it deals the extra die) or once a turn, with its uses from the feature's words ("a number of times equal to your PB"). Two-Weapon Fighting adds the off-hand swing to the main one. Monsters take the most hurt PC for half their target picks and a random one for the rest (`MONSTER_FOCUS` in `montecarlo.ts`; it was always the most hurt). `rpg sim run` shows each action's `inflicts`, `recharge`, `perDay` and area `targets`, and each PC's `riders`.

With these the logged kobold fight is predicted at 80% HP lost and a 62% TPK; the real one (22% lost, won in 2 rounds with most attacks landing) sits at the 3.5th percentile, an unlucky draw for the kobolds more than a bias that one fight can show. On the Game Master's Guide catalog the fits moved from 8 fit / 21 too easy / 214 too hard to 11 / 24 / 208.

**Defences, control spells, bonus heals.** A monster's resistances, immunities and vulnerabilities apply to the damage it takes (`lib/domains/encounter-sim/defences.ts`): from its `resistant`, `immune` and `vulnerable` lines, a named trait read from its text ("Undead Resilience": "immune to poison damage and the exhaustion and poisoned conditions"), "damage from nonmagical attacks" covering a weapon's bludgeoning, piercing and slashing (a PC's weapons count as nonmagical). A condition it is immune to never lands; one it is resistant to gives it advantage on the save. A control spell with no damage that the character sheet gives a condition and a save (Entangle: restrained on a failed STR save, a 20-foot square catching 4) is a save action that deals nothing; an action's worth when choosing counts its condition (`CONDITION_WORTH` in `engine.ts`: a lost turn most, then advantage against and disadvantage). A heal its text gives ("regains hit points equal to 1d4 + your spellcasting ability modifier") is modelled, and one cast as a bonus action (Healing Word) comes on top of the turn's action. `rpg sim run` shows each monster's `defences`. Measured with 2000 trials the logged kobold fight does not move (kobolds have no defences; Entangle is not the best choice there); the GM's Guide catalog reads 13 fit / 21 too easy / 209 too hard.

**Monster spellcasting.** A monster's Spellcasting action ("casts one of the following spells, using INT … (spell save DC 13)", "At will: …", "3/day each: …") is read into its lists (`parseMonsterSpellcasting`), each spell found among the vault's spell notes by name (`[[wikilinks]]` and "(self only)" dropped) and resolved like a PC's, with numbers that give the stated DC (casting modifier = DC − 8 − the proficiency bonus of its CR; a cantrip scaled by its CR as a level). A spell of a "N/day" list is used N times; spells are cast at no slot. A spell note with no `roll:` (most of them) is read from its prose (`spellFromText`): "Make a ranged spell attack … takes 1d10 fire damage" (scaled by level for a cantrip), "Each creature in a 15-foot cone must make a DEX save … 3d6 fire damage … or half as much" (an area of its size), "must succeed on a WIS save or be paralyzed for the duration" (a condition, for the fight when the spell lasts a minute or more); a die that is not damage (Bane's "penalty") is not read as damage. The Mage now casts Fireball (2/day, 4 caught) and Cone of Cold; the Cult Fanatic holds a PC; utilities and buffs are listed as skipped, one record a spell.

**Spell rolls from their text.** Most spell notes of an imported compendium have no `roll:`, so the character sheet's rolls table, the session log's cards and the simulator could not see what they do. `rpg sim spells [<note or folder>…] [--write]` (`cli/rpg/sim/spells.ts`) derives one from each spell's prose (`lib/domains/spells/derive-roll.ts`): a spell attack (cantrip damage by level as `leveled`), a save with its ability, damage and "half damage" or "no damage", a save that brings a condition (as `effects` and `notes`, which the system turns into the sheet's `inflicts`), healing, a smite's extra damage (`form: rider`), and damage by circle (`upcast`, from "increases by 1d6 for each slot above 2nd"). A dry run counts what it would write and why the rest get none; `--write` puts each roll into its note's spell fence under a comment to delete once checked. A note with a `roll:` is never touched. In the testing vault: 270 of the 814 notes without one got a roll (215 saves, 31 attacks, 17 riders, 7 heals); 431 read as no attack, save or healing (buffs, utilities, summonings), 87 as a save with nothing the simulator plays (charm, a speed change), 8 as an attack with no damage. The simulator reads a spell with no `roll:` through the same derivation.

**Buffs and debuffs.** A spell that adds a die to attack rolls and saves ("roll a d4 and add the number rolled to the attack roll or save": Bless, Resistance), takes one away ("…subtract the number rolled…": Bane, Aura of Bane) or gives a bonus to AC ("a +2 bonus to AC": Shield of Faith) is a buff action (`BuffAction`, read by `buffFromText` in `spell-actions.ts`): on up to the creatures it names ("up to three creatures"), one, or as many as an aura's size catches; a debuff on enemies who keep it off with the save it names. It lasts the fight. A caster casts it when it is worth more than its best attack (`BUFF_WORTH` a target still without it); its dice are rolled into each attack and save. These are read from the text only, since the `roll:` schema has no buff form. The Priest now blesses its allies and banes the party; the Cult Fanatic's Bane is a debuff, no longer 1d4 damage.

**Recharge and areas.** A monster's "(Recharge 5-6)" action is used, then rolled for at the start of each of its turns (a d6 of the number or more brings it back); "(N/Day)" is used N times. An area save catches as many creatures as its size gives by the usual table (a cone: its length / 10; a cube or square: its side / 5; a sphere, cylinder or radius: its radius / 5; a line: its length / 30), the first living enemies in initiative order; with no size, every one. A feature two creatures make together ("can combine their actions") is skipped.

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
- Counts are read from number words, group words ("a pair of", "a trio of") and dice (`1d4 + 1` becomes 3); a plural with no number is guessed as 2 (medium confidence), unless the row gives it later ("dozens of giant fire beetles … eight of them attack"). A mention with no number beside a counted one of the same creature ("a band of lizardfolk … four lizardfolk", "the haughty mages" after "three elf archmages") is the same creatures, not more.
- Creatures a row names only to describe the scene are left out, each with a reason: prey and the sought ("stalk a herd of 12 deer", "in search of a spy", "a mammoth being pursued by"), likenesses ("in the guise of a lone wolf"), the dead and the absent ("the corpse of a young brass dragon", "a dying mule", "the druid who summoned them died", "occupied by a powerful mage"), a creature that modifies a noun ("a gnoll hunting party", "werewolves in wolf form", "wolf-shaped"), and reinforcements that come later ("an additional four bugbears").
- Bestiary names that are everyday words (Shadow, Guard, Scout, Spy, Scavenger, Peer, Unearthed) count only with a number: "three shadows" are Shadows, "in the shadows", "city guards", "spies the PCs" are not. A singular name with no number or article ("to guard", "have unearthed") is a word, not a creature.
- Two names side by side are one creature, the higher CR's ("a void piper selang" is a Void Piper, "a duergar archmage" an Archmage); a rank after a name ("a frost giant chieftain") is read as the creature and makes the draft medium. "Four giant bees (use giant wasp)" takes the stats in the parenthesis.
- Rows whose fighting words are denied ("they don't fight") read as no fight; peaceful words ("means no harm", "friendly") with little fighting make the fight `possible` (medium).
- **Aliases:** `<system>/gm-tools/encounter-catalog/Bestiary aliases.md` holds a `yaml` block of `aliases:` (`warden robot: Robot Warden`): other names for bestiary notes, kept by a person. Drafting reads rows with them, and every `--monster` takes them, as it takes a note's spoken name ("Goblin" for `Goblin, A`, "dire wolf" for `Wolf, Dire`).
- Measured on the Game Master's Guide tables (430 drafts): 40-odd rows read wrong were fixed; 242 high and 192 medium drafts now.
- Names the bestiary lacks ("five shriekers") are listed as `unresolved` and make the draft medium.
- Rows that are not combat but a skill challenge, a hazard or a roleplay scene are not entries at all.
- A fit is only as good as the simulator: wards (Sanctuary), speed and action changes (Haste, Slow), reactions, positioning and legendary actions are left out (see the `fidelity` of `rpg sim run`). Conditions that ride on damage are played (below).
- Tags come from the table (environment, tier, CR band, book) and the monsters' habitats, lower-cased, so a "Forests" table has `forests` and its wolves' `forest`; `--tag` matches whole tags, case-insensitively.
