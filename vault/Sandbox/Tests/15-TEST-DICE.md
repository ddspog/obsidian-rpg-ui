# Test 15: Dice Gallery

## Test Objective

Visual gallery of the formula/dice rendering in the **Log sidebar**. Open this
note in Reading View and click **Log** to see every die type and state together.
Each indented line under a `gen:` is a detail row, so its content runs through
the formula renderer (dice as inline-SVG silhouettes, contest winners, CF/DC
thresholds, `check -> result`).

Open the **Log** panel on the right to see the gallery.

```rpg log
gen: Rolled, one digit
  d4: d4=0
  d6: d6=5
  d8: d8=7
  d10: d10=8
  d12: d12=9
  d20: d20=4
  d100: d100=7
gen: Rolled, two and three digit
  d10: d10=10
  d12: d12=11
  d20: d20=17
  d100: d100=29
  d100: d100=100
gen: Unrolled (pending, no result yet)
  d4: d4=0
  d6: d6=
  d8: d8=
  d10: d10=
  d12: d12=
  d20: d20=
  d100: d100=
gen: Modifiers and dice pools
  bonus: d20+5=22
  penalty: d8-1=4
  pool: 2d6+3=11
  big pool: 4d6=15
gen: Contests (winner emphasized)
  dice wins: d10=8 vs CF 5 -> Expected Scene
  threshold wins: d20+2=8 vs DC 20 -> Fail
  pending contest: d10= vs CF 5
  single + result: d6=4 -> Heavy Rain
```
