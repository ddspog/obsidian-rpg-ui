# Table.* — math, header merge, axis cells, tfoot cells

Smoke-test for the four new `rpg table.*` features. Open in reading view.

## 1 — Vertical header merge (`^` / `^^` / `^v` / `^-`)

`LEVEL` spans both header rows via `^-` (centred). Use `^^` to top-align the
label, `^v` to bottom-align, or a bare `^` / `^-` to centre it.

```rpg table.combatprog
| LEVEL | COMBAT ||
| ^- | Attack | AC |
|---|---|---|
| 1 | +2 | 12 |
| 2 | +2 | 13 |
| 3 | +3 | 13 |
```

## 2 — Axis (diagonal corner) cell + `$math$` in cells

The separator IS the diagonal: `\` → ↘, `/` → ↗. The first label names the
columns (hugs the top); the second names the rows (hugs the bottom). Body
cells carry inline `$…$` math.

`\` (↘) — column label upper-right, row label lower-left:

```rpg table.abilitymath
| {{ axis Score \ Mod }} | STR | DEX |
|---|---|---|
| Score | $10$ | $14$ |
| Modifier | $\frac{10-10}{2}=0$ | $+2$ |
```

`/` (↗) — mirrored: column label upper-left, row label lower-right:

```rpg table.abilitymathflip
| {{ axis Score / Mod }} | STR | DEX |
|---|---|---|
| Score | $10$ | $14$ |
| Modifier | $0$ | $+2$ |
```

## 3 — Footer cells (2nd `|---|`), math, roll + positioned paginate

Rows after the **second** `|---|` separator render in the `<tfoot>` ABOVE the
roll and pagination rows, and aren't paginated. Note the colspan (`||`) and
display math (`$$…$$`) in the footer cell. Pagination is a **positioned**
`|= {{ paginate pages=N }} =|` expression — the control type is the kwarg key
(`pages` / `prev-next` / `show-more`). Two consecutive `|= … =|` rows with no
`|---|` between them get the ◆ ornament.

```rpg table.weapondice
| WEAPON* | DAMAGE | AVG |
|---|---|---|
| Dagger | $1d4$ | 2.5 |
| Shortsword | $1d6$ | 3.5 |
| Longsword | $1d8$ | 4.5 |
| Greatsword | $2d6$ | 7 |
| Maul | $2d6$ | 7 |
|---|---|---|
| Average damage || $$\bar{x}=4.9$$ |
|= You draw the {{ roll : weapon }} dealing {{ roll : damage }}. =|
|= {{ paginate pages=3 }} =|
[Weapon Damage #css/tx/table]
```

## 4 — Everything at once

Axis corner spanning both header rows (`^-`), a group header, math, a footer
cell, and a roll row.

```rpg table.kitchen
| {{ axis Tier \ Stat }} | ATTRIBUTES ||
| ^- | Might | Grace |
|---|---|---|
| Novice | $+1$ | $+0$ |
| Veteran | $+3$ | $+2$ |
| Master | $+5$ | $+4$ |
|---|---|---|
| Cap || $+5$ |
|= Your standout trait: {{ roll : might }} / {{ roll : grace }}. =|
```

## 5 — Cell `@modifier`s

Leading `@…` tokens (stripped from the text), stackable. `@highlight-col` /
`@highlight-row` / `@highlight-cross` band the column / row / both like a
category divider — `cross` is named for the **cross shape** the bands form
when they meet. `@header` styles the cell like a `<th>` (the element stays a
`<td>`). The caption's `@title` styles the caption like a `<th>` row, but
keeps the caption's own font.

`@header` takes precedence over `@highlight-*` on the same cell (note how the
`Fortitude` row's first cell — the header — keeps its header look even though
the row is highlighted; the rest of the row still highlights):

```rpg table.savemods
| SAVE | Novice | @highlight-col Expert |
|---|---|---|
| @header Reflex | 10 | 18 |
| @highlight-row Will | 12 | 20 |
| @header Fortitude | @highlight-cross 14 | 22 |
[Saving Throws @title]
```

`@compact` shrinks an overlong cell so it fits without forcing the column wide:

```rpg table.compactdemo
| ITEM | DESCRIPTION |
|---|---|
| Rope | @compact 50 ft of hempen rope, 2 lb, holds up to 600 lb before it snaps |
| Torch | Burns for 1 hour |
```

Inline `**bold**`, `*italic*` / `_italic_`, and `***both***` work in any cell
(alongside math, wikilinks, and modifiers):

```rpg table.bolddemo
| TRAIT | EFFECT |
|---|---|
| **Reckless** | Advantage on attacks; *enemies* gain it against you too. |
| _Lucky_ | Reroll a **1** once per rest ($+0$ cost). |
| ***Doomed*** | snake_case and 2 * 3 stay literal. |
```

`@middle` / `@middle-col` / `@middle-row` / `@middle-cross` vertically centre a
cell's content within its row height — visible when a neighbour wraps tall.
Here column 1 is `@middle-col`, so its short labels sit centred against the
wrapped descriptions instead of riding the top:

```rpg table.middledemo
| ABILITY | EFFECT |
|---|---|
| @middle-col Cleave | A wide swing that strikes every adjacent enemy, dealing half damage to each beyond the first and knocking prone on a failed save. |
| @middle-col Brace | Ready your weapon against a charge. |
```

## 6 — Mythic Fate Chart (math + axis + cross + header, no thead)

Real-world combo: a header-less table (starts with `|---|`), `$…$` math in
every body cell, and a footer row (after the 2nd `|---|`) whose corner is
`{{ axis Odds / Chaos Factor }}` with trailing `@header @highlight-cross` —
banding column 1 (the odds) and the footer row (the CF numbers) into a cross,
with the corner kept as a header. Caption `@title`. **Hover a probability cell**
to crosshair-highlight its whole row + column (the Odds label and CF number at
the ends light up); only the axis's data cells (here, top-right of the `/`
corner) respond.

```rpg table.fate-chart
|---|---|---|---|---|---|---|---|---|---|
|Certain|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|$^{20}\;99\;^{x}$|$^{20}\;99\;^{x}$|$^{20}\;99\;^{x}$|
|Nearly Certain|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|$^{20}\;99\;^{x}$|$^{20}\;99\;^{x}$|
|Very Likely|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|$^{20}\;99\;^{x}$|
|Likely|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|
|50/50|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|
|Unlikely|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|
|Very Unlikely|$^{x}\;1\;^{81}$|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|
|Nearly Impossible|$^{x}\;1\;^{81}$|$^{x}\;1\;^{81}$|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|
|Impossible|$^{x}\;1\;^{81}$|$^{x}\;1\;^{81}$|$^{x}\;1\;^{81}$|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|
|---|---|---|---|---|---|---|---|---|---|
|{{ axis Odds / Chaos Factor }} @header @highlight-cross |1|2|3|4|5|6|7|8|9|
|---|---|---|---|---|---|---|---|---|---|
|= {{ oracle }} =|
[FATE CHART @title]
```

A `|---|` authored **between** two footer rows (here, between the axis row and
the oracle row) renders a thin accent **group divider** instead of the ◆
ornament — grouping the odds/CF axis apart from the oracle roll.

**Oracle:** click a probability cell to select it (accent ring), then click the
`{{ oracle }}` row to roll a d100 and read the answer — **Exceptional Yes /
Yes / No / Exceptional No** — from that cell's three thresholds. The roll shows
in the log blocks' dice UI (the d100 percentile pair) → answer. Configure with
`{{ oracle dice=d100 answers="Exceptional Yes | Yes | No | Exceptional No" }}`.
