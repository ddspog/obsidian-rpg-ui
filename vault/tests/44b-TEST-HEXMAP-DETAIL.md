# Test: a 5-mile detail map (design §13.7)

It details hex (1,0) of [[44-TEST-HEXMAP-PAINT]]. The parent's 30-mile tiles show
underneath, faded and six times larger, with the parent's hex outlines over
them. The parent map marks (1,0) with a small ⊕ that opens this note.

```rpg map
grid: hex
title: Paint test (1,0) 5 mi
pack: basic
scale: 5 mi
of: "[[44-TEST-HEXMAP-PAINT]]"
at: [1, 0]
---
t(0,0): plains
t(1,0): forest
t(0,1): forest
t(-1,1): plains
t(-1,0): plains
t(0,-1): hills
```
