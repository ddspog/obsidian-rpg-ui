# Test 16: Log Tag Dateline

## Test Objective

Visual check of the **entry tag strip** in the Log sidebar. Tags (`CF`, NPCs,
foes, locations, clocks, PC changes, threads, …) used to sit in a third column;
they now collect into a typographic **dateline** across the top of each entry —
a muted small-caps key (tinted by category) + an emphasized value, joined by
faint middots.

Open this note in Reading View and click **Log** (top-right) to see the strips.
Category hues: oracle/CF & NPC = amethyst, foe = ember-red, PC = periwinkle,
place/goods = faded-amber, clocks/tracks/threads = arcane-teal.

```rpg log
=> S01 The Crypt Door

? (GM) [CF:5] Does the ancient door yield?
gen: Oracle says
  Likely: d10=8 vs CF 5 -> Yes, and...
=> The door grinds open, dust pluming. [N:Skeletal Sentinel|stirring] [L:The Crypt]

@ Aria pries the rusted lock
  Check: d20+5=22 vs DC 15 -> Success
=> The lock shatters. [PC:Aria|-1 HP] [Inv:Lockpick-1]

! A bell tolls somewhere deep below [Clock:Alarm 3/6] [E:Ritual 1/4]
=> The sentinels begin to stir. [F:Skeletal Sentinel|reanimated,hostile] [Thread:The Hollow King|Open]

? (GM) [CF:4] What waits beyond the ash?
=> A throne room, long abandoned. [L:Throne of Ash] [N:Whispering Echo] [Track:Dread 2/4]
```
