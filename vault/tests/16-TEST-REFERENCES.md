---
cssclasses: ["note-adventurer"]
---
# Reference Test

A compact smoke-test for the `@[[File]].path` inline reference system.
Open this note in reading view to see each reference replaced with its
resolved value.

## Scalars

Longsword cost: **@[[Longsword]].item.element.cost**
(expected: `15 gp`).

Longsword damage: **@[[Longsword]].item.element.weapon.damage**
(expected: `1d8/1d10 slashing`).

Shield AC: **@[[Shield]].item.element.armor.ac**
(expected: `+2`).

## Arrays

Longsword properties: @[[Longsword]].item.element.weapon.properties
(expected: a comma-joined list of wikilinks).

Longsword availability: @[[Longsword]].item.element.shop.availability

## Named-entry match

Jacqui's class (from the Cleric compendium):
@[[Cleric]].feature.details[Spellcasting].text

## Frontmatter

This note's cssclasses[0]: @[[16-TEST-REFERENCES]].metadata.cssclasses[0]
(expected: `note-adventurer`).

## Missing / invalid

Missing file: @[[Nope]].item.element.cost
(expected: red `[missing: …]` marker).

Invalid path: @[[Longsword]].item
(expected: red `[invalid: …]` — needs `<entity>.<block>` pair).

Missing inner key: @[[Longsword]].item.element.doesnotexist
(expected: red `[missing: item.element.doesnotexist]`).

## Live-update test

1. Open `worldbuilding/items/weapons/martial/Longsword.md` in a split
   pane.
2. Change the `cost: 15 gp` line to `cost: 99 gp`.
3. Watch the first reference in this note update without reloading.
