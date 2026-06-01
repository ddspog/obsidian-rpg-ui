# TEST: Table vertical cell merge (`^`)

A `^` body cell merges with the cell directly above it (same column), the
vertical mirror of the `||` colspan convention. Glyph suffixes pick the
span's vertical alignment: `^^` top, `^v` bottom, `^`/`^-` centre.

## 1. Basic merge — centred (default)

The PB column collapses each proficiency-bonus run into one spanning cell.

```rpg table.basic-merge
| LEVEL | PB | FEATURES |
|---|---|---|
| 1st | +2 | Last Stand, Martial Action |
| 2nd | ^ | Action Surge |
| 3rd | ^ | Fighter Subclass |
| 4th | ^ | Improvement |
| 5th | +3 | Multiattack (2/Attack Action) |
| 6th | ^ | Improvement |
| 7th | ^ | Subclass Feature |
| 8th | ^ | Improvement |
[BASIC MERGE]
```

## 2. Alignment glyphs

`^^` rides the value to the top, `^v` drops it to the bottom, `^-` centres it.

```rpg table.alignment-merge
| GROUP | VALUE | NOTE |
|---|---|---|
| top | rides up | ^^ aligns to the first row |
| ^^ | ^ | second row |
| ^^ | ^ | third row |
| middle | centred | ^- (or bare ^) centres |
| ^- | ^ | second row |
| ^- | ^ | third row |
| bottom | drops down | ^v aligns to the last row |
| ^v | ^ | second row |
| ^v | ^ | third row |
```

## 3. Merge under a colspanned cell

A single `^` under a `||` colspan cell extends the whole merged cell downward.

```rpg table.merge-colspan
| A | B | C |
|---|---|---|
| 1 | wide cell || 
| 2 | ^ | x |
| 3 | ^ | y |
```

## 4. Category dividers reset spans

A section band breaks any active vertical merge — a `^` right after a band has
nothing to merge into and renders blank.

```rpg table.merge-category
| TYPE | ITEM |
|---|---|
| Light Armor ||
| Padded | 5 gp |
| ^ | Leather |
| Medium Armor ||
| Hide | 10 gp |
| ^ | Chain Shirt |
```

## 5. Merge across pagination (carry-down)

When a page begins partway through a merge, the anchor value is carried down so
it still reads on that page.

```rpg table.merge-paginated
@paginate 3 prev-next
| LVL | PB |
|---|---|
| 1 | +2 |
| 2 | ^ |
| 3 | ^ |
| 4 | ^ |
| 5 | +3 |
| 6 | ^ |
```
