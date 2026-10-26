# Test: hex map labels (l(q,r) title banners)

## Every family, grown to fit

```rpg map
grid: hex
title: Title banners (test)
pack: basic
---
0m:
  * t(0,0): plains
  * t(1,0): plains
  * t(2,0): forest
  * t(3,0): forest
  * t(4,0): hills
  * t(0,1): plains
  * t(1,1): plains
  * t(2,1): plains
  * t(3,1): forest
  * t(4,1): mountain
  * t(0,2): water
  * t(1,2): water
  * t(2,2): plains
  * t(3,2): plains
  * t(4,2): hills
l(2,-0.6): (The Kingdom of Dunlind) title-1
l(1,0.5): (Barelgrove) title-2 size=0.7
l(3.5,0.6): (Caulkin Wood) title-3 size=0.7 rot=-6
l(0.5,2): (The Grey Sea) title-4 size=0.8
l(3,2.5): (Featherbark) title-5 size=0.7 [[Holy City of Featherbark]]
l(4.4,1.4): (Peak) title-6 size=0.6
```

## Short and long text on one family

```rpg map
grid: hex
pack: basic
---
t(0,0): plains
t(4,0): plains
l(2,-1): (Ford) title-1
l(2,0): (Aldermere) title-1
l(2,1): (The Long Road to Everwinter) title-1
l(2,2): (Smaller, same banner) title-1 size=0.8
l(2,3): (Plain tag: unknown family) title-9 size=0.6
```
