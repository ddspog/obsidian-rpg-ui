# UI review

How the plugin's interface gets reviewed, and the real notes to review it on.

- **[Block census](./block-census.md)**: every `rpg` block type, where the plugin defines it, which stylesheet draws it, how many notes use it, and the best real examples. Generated; refresh it with `node scripts/block-census.mjs --vault vault --vault "$RPG_VAULT_ROOT" --md docs/ui-review/block-census.md`.
- **`/ui-review <goal> [scope]`**: the Claude command (`.claude/commands/ui-review.md`) that runs the review with the Impeccable skill, on a phone and on a desktop, and writes a board of findings with before and after pictures to rate and answer.

## The example set

One real note per thing worth looking at, in `testing-vault` (the owner's vault, read only; the cloud harness copies it). Where the repo's own `vault/` has a copy, it is the same note.

| What                               | Note                                                                                                                      | Shows                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Character sheet, caster            | `tales-of-the-valiant/adventuring/characters/Kowyn.md`                                                                    | all eleven `character.*` blocks, spells, loadouts                                 |
| Character sheet, martial           | `…/characters/Talon Pallton.md`                                                                                           | one cantrip, a longbow                                                            |
| Character sheet, no spells         | `…/characters/Lilith.md`                                                                                                  | the empty Spells heading                                                          |
| Character sheet, `character.sheet` | `…/characters/Jacqui Ilitul.md`                                                                                           | the one-block sheet                                                               |
| Session log                        | `tales-of-the-valiant/binder/01. Journey to Wisdom's Path.md`                                                             | prose, dialogue, a fight, the drawer, the card form                               |
| GM screen                          | `…/binder/00. GM Screen.md`                                                                                               | the log's GM side                                                                 |
| Battle map in a note               | `tales-of-the-valiant/atlas/maps/Kowyn Encounter.md`, `Kobold Ambush.md`                                                  | picture maps, Place tokens, Expand                                                |
| World map                          | `020. Lands and Planes/Cultural Basins/Caulkin.md`                                                                        | a hex map made of six imports                                                     |
| Realm, region, place maps          | `…/Realms/Dunlind.md`, `…/Regions/Barelgrove.md`, `…/Cities and Villages/Mervine.md`                                      | labels, markers, one layer each                                                   |
| Hex modes, travel                  | `Sandbox/Tests/45-TEST-HEXMAP-MODES.md`, `46-TEST-TRAVEL-LOG.md`                                                          | play, mark, build; a journey in a log                                             |
| Class page                         | `tales-of-the-valiant/worldbuilding/traits/classes/Cleric.md` (also `Ranger.md`, `Fighter.md`)                            | `rule.tab`, `feature.choice`, `feature.level`, `table.*`                          |
| Feature                            | `…/traits/talents/martial/Vanguard.md`, `…/traits/lineages/Kobold.md`                                                     | `feature.details`, `feature.choice`                                               |
| GM tools                           | `tales-of-the-valiant/gm-tools/dials/Chaos Factor.md`                                                                     | `feature.gm`, `figure.mermaid`, `rule.*`                                          |
| Hazard                             | `…/worldbuilding/dangers/hazards/Extreme Cold.md`                                                                         | `feature.danger`                                                                  |
| Items                              | `…/items/tools/Artist Tools.md`, `…/equipment-packs/Burglar's Pack.md`, `…/enchantments/Sword of Vengeance ᴰ.md`          | `item.element`, `item.magic`                                                      |
| Containers and personal items      | `…/adventuring/collected/magic/Kowyn's Bag.md`, `Druid Glaive.md`                                                         | `item.container`, `item.personal`                                                 |
| Statblocks                         | `…/bestiary/creatures/beast-forms/Panther.md`, `…/vehicles/land/Sand Skimmer.md`, `…/monsters/categories/Lycanthropes.md` | `stat.monster`, `stat.vehicle`, `stat.category`                                   |
| Spell card, spell lists            | `…/spells/1st-circle/Goodberry.md`, `…/spells/spell-lists/Arcane.md`                                                      | `spell`, `list.*` and its tabs                                                    |
| Tables, figures                    | `…/gm-tools/oracle/Fate Chart.md`, `…/glossary/topics/solo-scenes/Generating NPC Behavior.md`                             | `table.*`, `figure.mermaid`                                                       |
| Standalone inventory               | `Sandbox/Tests/11-TEST-INVENTORY.md`                                                                                      | the `inventory` block                                                             |
| Legacy blocks                      | `Sandbox/Tests/10-TEST-ALL-BLOCKS.md`                                                                                     | `attributes`, `skills`, `stats`, `badges`, `consumable`, `healthpoints`, `events` |
| System definitions                 | `vault/systems/inline-system/DnD5e-System.md` (in the repo)                                                               | `system.*`, `expression`                                                          |
| Draft                              | `Sandbox/Tests/47-TEST-DRAFT.md`                                                                                          | the draft block                                                                   |

Surfaces that have no fence of their own (settings, the card form, the drawer, the modals) are listed at the end of the [block census](./block-census.md#surfaces-that-are-not-blocks).

## Reviewed so far

Phone first, then desktop, by eye on these notes (no Impeccable score yet unless noted).

| Area                                               | Phone                                 | Desktop                               |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| Character sheet, spells, inventory                 | reviewed, fixed                       | reviewed, fixed                       |
| Session log, drawer, card form                     | reviewed, fixed (Impeccable critique) | reviewed, fixed (Impeccable critique) |
| Plugin settings                                    | reviewed, fixed                       | reviewed                              |
| Battle map in a note, token editor                 | built and checked                     | built and checked                     |
| Hex maps (world map)                               | controls reworked                     | reviewed                              |
| Statblocks, items, spell cards, features           | reviewed, fixed                       | reviewed                              |
| Rule tabs, tables, spell lists                     | reviewed, fixed                       | reviewed, fixed                       |
| Legacy blocks, `system.*`, draft, `figure.mermaid` | not reviewed                          | not reviewed                          |
| Standalone `inventory`, `character.sheet`          | not reviewed                          | not reviewed                          |
