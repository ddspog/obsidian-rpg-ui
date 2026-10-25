# Test 19: Dice Notation Breadth

## Test Objective

Companion to **Test 15: Dice Gallery**. Test 15 covers the dice that become
interactive badges (every die type, rolled and pending, modifiers, pools,
contests). This note covers the rest of the notation the parser accepts, plus
attribution and oracle rolls.

Every form here renders as a **roll chip**, which rests on its **result**: the
number, with a small die raised beside it. Point at it and the chip lifts over its
neighbours to show the expression and **every die it recorded** — click the
expression to reroll, or type the dice in to register a roll you made on the table.
Collapsed reads the outcome, expanded reads the dice. A chip with no result yet
shows its notation instead, since there is no number to rest on.

A pool logs **every die it rolled** as a list (`2d6=[4,3]`) and shows their
**sum**, so the entry stays auditable without making you read four numbers where
one roll happened.

When a `<special>` produces dice of its own, they go in a **second list**:
`3d8!=[8,5,6][3]` is three dice thrown, and the 8 exploding into one more. The two
lists are what let the log say where a die came from — `[8,5,6,3]` alone would leave
a `3d8` with four dice to explain. An **exploded** die adds to the total; a
**rerolled** one is kept in the first list but replaced, so `4d6ro1=[1,5,2,6][4]`
reads 17: the 1 was thrown, set aside, and the 4 took its place.

The `<special>` after `XdY` decides **which of those dice count, and at what
value** — advantage on `[19,4]` is 19, not 23. There are three kinds:

- **by position** — `kh1`, `dl1`: keep or drop the highest / lowest dice
- **by value** — `drop<3`, `drop>4`: throw away the dice that miss a bar (`<=`, `>=` also work)
- **at the bar** — `floor3`, `cap4`: throw away nothing, and count a die at the bar instead

The last two are the easy pair to confuse, so they read differently: on `[1,5,2,6]`,
`drop<3` is **11** (the 1 and 2 are gone) while `floor3` is **17** (they count as
3s). `!` and `ro` describe how the dice were obtained, so every die they produced is
recorded and all of them count. Each one is named in the chip: a mark
beside the number (`▲` keeps the high die, `▽` drops the low one, `✱` explodes,
`↻` rerolls, `▽<3` drops dice under 3, `⌊3` floors them at 3) and spelled out when
the chip is expanded. A mark carries its threshold, because a total of 17 from dice
reading 1, 5, 2, 6 can only be checked once you can see the floor that produced it.

Where a mechanic has a name every table already uses, the chip says the name:
**keeping one d20 out of several is advantage**, however many dice a feature grants,
so `3d20kh1` reads `adv` just as `2d20kh1` does. Off the d20 it stays literal —
`4d6kh1` keeps the best of four, which nobody calls advantage. The count is optional
when it is one, so `kh` means `kh1`. Your note keeps whatever you wrote either way;
only the reading is named.

Open the **Log** panel on the right.

## Selectors

Exploding, rerolls, and keep / drop. The die renders as a badge; the selector sits
beside it as the notation you wrote.

```rpg log
state_key: dice-notation-rich
---
gen: Exploding and rerolls
  exploding: 3d8!=[8,5,6][3]
  explode once: 2d6!p=[6,5][2]
  reroll ones: 4d6ro1=[1,5,2,6][4]
  chained: 2d6!=[6,3][6,2]
  totals only: 3d8!=19
gen: Keep and drop
  advantage: 2d20kh1=[19,4]
  disadvantage: 2d20kl1=[19,4]
  three dice: 3d20kh1=[19,4,11]
  shorthand: 2d20kh=[19,4]
  best of four: 4d6kh1=[4,3,6,2]
  drop lowest: 4d6dl1=[4,3,6,2]
  drop highest: 4d6dh1=[4,3,6,2]
gen: Thresholds, by value
  drop below 3: 4d6drop<3=[1,5,2,6]
  drop above 4: 4d6drop>4=[1,5,2,6]
  drop 2 and under: 4d6drop<=2=[1,5,2,6]
gen: Clamps, nothing removed
  floored: 4d6floor3=[1,5,2,6]
  capped: 4d6cap4=[1,5,2,6]
  drop lowest then floor: 4d6dl1floor3=[1,5,2,6]
gen: Pools, die by die
  two dice: 2d6=[4,3]
  four dice: 4d6=[4,3,6,2]
  advantage: 2d20kh1=[19,4]
  drop lowest: 4d6dl1=[4,3,6,2]
gen: With the kept dice shown
  breakdown: 4d6dl1 [4, 3, 6, 2]=13
  exploded: 3d8! [8!, 5, 6]=19
gen: Several dice summed
  mixed: d8+d6+2=13
  sneak attack: 2d6+1d4+3=14
  two of a kind: d4+d4=6
gen: Special dice
  percentile: d%=45
  fudge: dF=1
  fudge scaled: 4dF.2=2
```

## Labels: `Name |` for a check, `name:` for a die

Two different things can be named, so they are written differently.

A **pipe** divides a name from the formula it belongs to: `Stealth | d20+5=` names
the whole check. It reads the way the pill renders — label, then dice, then value —
and since everything up to the pipe is the name, commas and apostrophes need no
escaping.

A **colon** glues a name to the single die that follows it: `sneak:2d6=[4,3]`. It
binds with no space, so it is visibly attached to that die and cannot be mistaken for
the check's own name. This one is rare on purpose: a check is normally written with
modifiers, and only a formula whose dice mean different things needs them named one
by one.

A roll does NOT name who made it. The action line already says that, so crediting
the dice as well would state it twice.

```rpg log
state_key: dice-notation-labelled
---
S1 Naming Things

@(Talon) tries the lock, quietly.
d: Stealth | d20+5=18 vs DC 14 -> success
=> The action line says who; the label says what.

d: Sneak Attack | d8=6 + sneak:2d6=[4,3] + 3 =
=> The check is named, and so is the one die that is not the weapon.

d: Thieves' Tools | d20+0=8 vs DC 15 -> fail
=> An apostrophe is just a character in a name.

d: 4d6dl1=[5,2,6,4]
=> No label at all: a roll that needs no naming.
```

## Party rolls

Several expressions on one line, one per character, separated by **`;`** — each name
is a character, because here the character is what distinguishes one check from the
next.

`;` rather than a comma, for the same reason list entries use it: **character names
contain commas.** "Loki, the old God" is one name, not two rolls.

```rpg log
state_key: dice-notation-party
---
S2 Everyone Listens

d: Talon | d20+5=18; Kowyn | d20+3=12; Lilith | d20+7=21
=> Three checks, one entry.

d: Loki, the old God | d20+2=15; Brian | d20=9
=> A name with a comma in it stays one name.

d: 4d6dl1 // STR=14, 4d6dl1 // DEX=12
=> The older comma form still reads, where each label follows its dice.
```

## Oracle rolls

A question carries its chaos factor as a pill; the answer keeps its roll in
parentheses. The roll is metadata on the answer, not a separate badge.

An **`o:` line** consults an oracle for the question above it — the sibling `tbl:`
and `gen:` always had. One letter, like `d:`: a fate question is the most frequent
mechanical line in solo play, so the most-written marker is the shortest.

```
o: Fate Chart (likely) d100=22 -> Yes
   └ source ┘  └ odds ┘ └roll┘   └result┘
```

Like them it names its source with a **bare name** and shows how it was rolled. The
question stays prose on its own `?` line; the odds live with the source they qualify;
and the result is **read off the roll**, so the row shows the number to beat and a
written answer that disagrees with the dice is corrected rather than believed.

```rpg log
state_key: dice-notation-oracle
---
S3 Reading the Signs

? [CF:5] Is the gate still guarded?
o: Fate Chart (likely) d100=22 ->
=> Two watchmen, and one is alert.

? [CF:7] Does the storm break before dawn?
o: Fate Chart (Nearly Impossible) d100=88 ->
=> The clouds hold all night.

? [CF:3] Was the ledger ever recovered?
o: Fate Chart (50/50) d100=97 ->
=> It burned with the counting house.

? [CF:5] Is anyone else awake?
-> Yes, and… (d100=22)
=> No oracle consulted, so the written answer stands.
```

## Table and generator rolls

`tbl:` records a table consultation, `gen:` a generated concept. Both keep their
source, roll, and result.

```rpg log
state_key: dice-notation-sources
---
S4 Consulting the Books

tbl: Wilderness Encounters d100=63 -> Abandoned camp, still warm
=> Someone left in a hurry.

gen: Random Event
  Event Focus: d100=34 -> NPC Action
  Event Meaning: d100=12 -> Betray
=> An ally moves against the party.
```

## Expected results

| Section | Renders as |
|---|---|
| Every chip | Idle: the result plus a raised die. Hovered: the expression, a reroll button, and the editable result. |
| Selectors | A mark beside the number, and the name spelled out in the expanded pill. |
| Generated dice | A second bracketed field: `[8,5,6][3]`. Exploded dice add to the total; a rerolled die stays recorded but stops counting. Both fields are editable, so a physical roll can be entered in full. |
| Keep and drop | Advantage reads 19 from `[19,4]`, disadvantage 4; drop-lowest reads 13 from `[4,3,6,2]`, drop-highest 9. |
| Named mechanics | `3d20kh1` and `2d20kh` both read `adv`; `4d6kh1` reads `keep 1 hi`. |
| Thresholds | `drop<3` **removes** the dice that miss the bar: 11 from `[1,5,2,6]`, keeping only the 5 and 6. `drop>4` reads 3. All dice failing is a real 0. |
| Clamps | `floor3` removes nothing and counts a low die AT the bar: 17 from `[1,5,2,6]`. `cap4` reads 11. |
| Pools | Collapsed: the SUM of the recorded list. Expanded: the dice themselves, editable one by one and each clamped to a real face, inside brackets the chip draws rather than lets you type. Keep / drop selectors sum only the dice they count. |
| Special dice | A chip shaped for the die, subscripted as authored (`%`, `F.2`). |
| Summed dice | One chip per die joined by operators, then the recorded total. |
| Kept dice shown | The breakdown reads as a pool; the total the author wrote wins. |
| Labelled checks | The name before the pipe as the pill's first section, then the formula. |
| Labelled die | The name before the colon on that die's chip, not on the check. |
| Party rolls | One labelled chip per character on a single row, split on `;`. |
| Oracle rolls | `?` row with a CF pill; `->` row with the roll in parentheses. |
| `o:` lines | The source and its odds as pills, plus the chart's threshold (`yes on ≤65`), then the roll and the answer read off it. |
| Table and generator | Source, roll, and result on one row; `gen:` detail rows resolve. |

Rolling honours the special too: an exploding die that hits its maximum rolls
another and records it in the second list, and `ro1` rerolls a 1 there rather than
overwriting the 1 it replaced. A replacement can itself explode, since explosions
look at the dice actually on the table. Keep and drop are
NOT applied when rolling — every die is recorded and which of them count is decided
when the roll is read, so a `2d20kh1` still shows both dice behind its 19.

The expanded chip is drawn **outside** its container, so it is never cut off by the
Log sidebar's clamp — only by the window itself.

A pool's sum is **derived** from its list, so it cannot drift out of step with the
dice: rolling rewrites the list and the sum follows, and so does editing a die in
the expanded field. Typing a bare total instead records just that total (`2d6=11`),
since a sum entered by hand is not a set of dice.

Party rolls **parse** into one labelled expression per character, but still render as
text: a row displays one formula, so the second and third have nowhere to go yet.
That is the remaining half of the work, and it falls out of the expression rewrite —
each `;` segment becomes one expression carrying its label.

The older unmarked form (`Stealth d20+5=18`, no pipe) still reads, because the
session logs are written that way. The pipe is preferred: without a divider the
parser has to guess where the name ends, and a name it cannot guess — one holding a
comma — was silently dropped.


