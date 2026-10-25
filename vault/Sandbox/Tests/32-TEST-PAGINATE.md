---
source:
  system: tov
  book: Player's Guide
  company: Kobold Press
---

# Phase 5 Demo — `@paginate` directive

The `@paginate <size> <controls>` directive at the top of an `rpg table.*` body enables client-side pagination. Off-page rows are DOM-removed (not hidden).

## `prev-next` — Previous / Next buttons

```rpg table.wild-magic
@paginate 5 prev-next
| d20* | Effect |
|------|--------|
| 1 | You cast *fireball* centered on yourself |
| 2 | You turn invisible for 1 minute |
| 3 | A unicorn appears within 5 feet of you |
| 4 | You cast *magic missile* at 5th level |
| 5 | Your height changes by 1d10 inches |
| 6 | You cast *confusion* centered on yourself |
| 7 | You regain 5 hit points each round for 1 minute |
| 8 | You grow a long beard of feathers |
| 9 | You cast *grease* centered on yourself |
| 10 | Each creature within 30 ft takes 1d10 necrotic |
| 11 | You teleport up to 60 feet to a random spot |
| 12 | You are transported to the Astral Plane for 1 round |
| 13 | You maximize the damage of the next spell you cast within 1 minute |
| 14 | Your skin turns blue for 24 hours |
| 15 | A third eye appears on your forehead for 1 minute granting truesight |
| 16 | All your spells have a loud thunderclap for 1 minute |
| 17 | You cast *polymorph* on yourself — you become a sheep |
| 18 | Illusory butterflies flutter around you for 1 minute |
| 19 | You can take one additional action immediately |
| 20 | Each creature within 30 ft becomes invisible for 1 minute |
```

## `pages` — Numbered page buttons

```rpg table.spell-list
@paginate 6 pages
| Level | Spell | School | Ritual |
|-------|-------|--------|--------|
| 0 | Fire Bolt | Evocation | No |
| 0 | Mage Hand | Conjuration | No |
| 0 | Prestidigitation | Transmutation | No |
| 0 | Light | Evocation | No |
| 0 | Minor Illusion | Illusion | No |
| 0 | Ray of Frost | Evocation | No |
| 1 | Magic Missile | Evocation | No |
| 1 | Shield | Abjuration | No |
| 1 | Detect Magic | Divination | Yes |
| 1 | Mage Armor | Abjuration | No |
| 1 | Thunderwave | Evocation | No |
| 1 | Find Familiar | Conjuration | Yes |
| 2 | Misty Step | Conjuration | No |
| 2 | Scorching Ray | Evocation | No |
| 2 | Hold Person | Enchantment | No |
| 2 | Invisibility | Illusion | No |
| 2 | Shatter | Evocation | No |
| 2 | Web | Conjuration | No |
| 3 | Fireball | Evocation | No |
| 3 | Counterspell | Abjuration | No |
| 3 | Fly | Transmutation | No |
| 3 | Haste | Transmutation | No |
| 3 | Lightning Bolt | Evocation | No |
| 3 | Dispel Magic | Abjuration | No |
```

## `show-more` — Appends next batch on click

```rpg table.equipment
@paginate 4 show-more
| Item | Cost | Weight |
|------|------|--------|
| Longsword | 15 gp | 3 lb |
| Shortbow | 25 gp | 2 lb |
| Chain Mail | 75 gp | 55 lb |
| Shield | 10 gp | 6 lb |
| Dagger | 2 gp | 1 lb |
| Handaxe | 5 gp | 2 lb |
| Leather Armor | 10 gp | 10 lb |
| Longbow | 50 gp | 2 lb |
| Studded Leather | 45 gp | 13 lb |
| Plate Armor | 1500 gp | 65 lb |
| Greatsword | 50 gp | 6 lb |
| Rapier | 25 gp | 2 lb |
```

## No pagination (existing behavior preserved)

```rpg table.ability-scores
| Score | Modifier |
|-------|----------|
| 1 | -5 |
| 2-3 | -4 |
| 4-5 | -3 |
| 6-7 | -2 |
| 8-9 | -1 |
| 10-11 | +0 |
| 12-13 | +1 |
| 14-15 | +2 |
| 16-17 | +3 |
| 18-19 | +4 |
| 20 | +5 |
```

## Pagination + Roll footer combined

```rpg table.random-encounters
@paginate 4 prev-next
| d20* | Encounter | CR |
|------|-----------|-----|
| 1 | Pack of wolves | 1/4 |
| 2 | Bandit ambush | 1/2 |
| 3 | Goblin patrol | 1/2 |
| 4 | Owlbear | 3 |
| 5 | Orc raiding party | 2 |
| 6 | Giant spider nest | 1 |
| 7 | Troll bridge | 5 |
| 8 | Wyvern flyby | 6 |
| 9 | Hill giant | 5 |
| 10 | Young dragon | 7 |
| 11 | Undead horde | 4 |
| 12 | Elemental rift | 5 |
|= {{ roll : encounter, cr }} =|
```
