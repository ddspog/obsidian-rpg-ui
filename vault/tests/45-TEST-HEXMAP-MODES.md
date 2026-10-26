# Test: map modes — Play, Mark, Build (design §14)

The switch in the map's corner: **Play** (the default) moves pieces, measures
and traces routes — a sandbox, nothing is saved; **Mark** places and drags
markers and labels; **Build** paints terrain, bases, paths and stacks.

Elara and Thorne are party figures, so they're pieces; the camp pin is one
because its line says `piece`.

```rpg map
grid: hex
title: Modes test
pack: basic
scale: 30 mi
---
0m:
  * t(0,0): plains
  * t(1,0): plains
  * t(2,-1): forest
  * t(2,0): forest
  * t(3,-1): hills
  * t(3,0): plains
  * t(0,1): ocean
  * t(1,1): plains
  * t(2,1): forest
  * t(4,-1): mountain
  * t(4,0): forest
  * m(0,0): party[1] (Elara)
  * m(0,0): party[2] (Thorne)
  * m(1,1): pin[red] (Camp) piece
  * m(3,-1): pedestal-gold[tower] (Watch)
```
