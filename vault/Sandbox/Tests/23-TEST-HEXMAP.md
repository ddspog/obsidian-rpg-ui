# Test: hex maps (rpg map, grid: hex)

## Overworld — basic pack

```rpg map
grid: hex
title: The Caulkin coast (test)
pack: basic
scale: 6 mi
regions:
  Dunlind: { color: "#8a3b2e", link: "[[Dunlind]]" }
  Barelgrove: { color: "#2f6b45", link: "[[Barelgrove]]", parent: Dunlind }
---
0m:
  * t(0,0): ocean
  * t(1,0): ocean
  * t(2,-1): ocean
  * t(3,-1): ocean
  * t(4,-2): ocean
  * t(5,-2): ocean
  * t(6,-3): ocean
  * t(7,-3): ocean
  * t(8,-4): ocean
  * t(9,-4): ocean
  * t(0,1): ocean
  * t(1,1): ocean @Dunlind
  * t(2,0): plains
  * t(3,0): plains @Dunlind @Barelgrove
  * t(4,-1): forest @Dunlind @Barelgrove
  * t(5,-1): forest @Dunlind @Barelgrove
  * t(6,-2): hills
  * t(7,-2): mountain
  * t(8,-3): peak
  * t(9,-3): ocean
  * t(0,2): ocean
  * t(1,2): plains @Dunlind
  * t(2,1): plains @Dunlind
  * t(3,1): forest @Dunlind
  * t(4,0): conifer-forest @Dunlind @Barelgrove
  * t(5,0): forest @Dunlind @Barelgrove
  * t(6,-1): hills
  * t(7,-1): (Stelscar Watch) tower
  * t(8,-2): mountain
  * t(9,-2): ocean
  * t(0,3): ocean
  * t(1,3): plains
  * t(2,2): dry-plains @Dunlind
  * t(3,2): (Featherbark) [[Holy City of Featherbark]] city @Dunlind
  * t(4,1): plains @Dunlind
  * t(5,1): forest @Dunlind
  * t(6,0): wetlands
  * t(7,0): wetlands
  * t(8,-1): hills
  * t(9,-1): ocean
  * t(0,4): ocean
  * t(1,4): ocean
  * t(2,3): plains @Dunlind
  * t(3,3): dry-plains @Dunlind
  * t(4,2): plains @Dunlind
  * t(5,2): (Old Ruin) ruin
  * t(6,1): wetlands
  * t(7,1): wetlands
  * t(8,0): plains
  * t(9,0): ocean
  * t(0,5): ocean
  * t(1,5): ocean
  * t(2,4): ocean
  * t(3,4): plains
  * t(4,3): plains
  * t(5,3): plains
  * t(6,2): plains
  * t(7,2): ocean
  * t(8,1): ocean
  * t(9,1): ocean
  * t(0,6): ocean
  * t(1,6): ocean
  * t(2,5): ocean
  * t(3,5): ocean
  * t(4,4): ocean
  * t(5,4): ocean
  * t(6,3): ocean
  * t(7,3): ocean
  * t(8,2): ocean
  * t(9,2): ocean
  * s(4,1): buildings(blue) x3
  * s(2,2): foliage(lush) x2
  * p(3,2): roads
  * p(4,1): roads
  * p(5,0): roads
  * p(6,-1): roads
  * p(7,-1): roads
  * p(8,-2): rivers
  * p(8,-1): rivers
  * p(8,0): rivers
```

## The editor's own example (svg pack)

```rpg map
grid: hex
---
title: Terrain, Path & Stack Example
pack: svg

0m:
  * t(0,0): (Ground) grass + #4CAF50
  * s(0,0): (Stack) grass + #FF5722
  * t(1,0): forest
  * t(-1,0): water
  * p(1,1): (Path) grass + #2196F3

100m:
  * t(0,2): (Mountain) stone + #795548
  * p(0,3): (High Path) grass + #9C27B0
```

## Flat colours and a mistake

```rpg map
grid: hex
pack: flat
coords: always
---
t(0,0): forest
t(1,0): water
t(0,1): lava + #d84315
t(1,1): mountain
this line is wrong
```
