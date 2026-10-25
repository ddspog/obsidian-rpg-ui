# Test: levels kept in the map's own block (design §13.9)

The 30-mile map has a `level 1:` (5 mi) and a `level 2:` (1 mi), in global
coordinates: the 5-mile hex (6q, 6r) sits on the middle of the 30-mile hex (q, r).

- **Zoom** far enough in (Ctrl/Cmd + scroll, or the + button) and the map shows
  the level below, with the whole level above drawn faded under it and its grid;
  zoom out to go back up. The breadcrumb and Scale → Level jump between them.
- **Build:** paint at 5 mi anywhere, across 30-mile borders. The first stroke in a
  30-mile hex fills its inner 5-mile hexes with its tile (dimmed, staged); **Done**
  writes them. Scale → **Detail** does the same for the picked hex and zooms in.
- Hexes (1,0) and (1,0)'s middle have detail: they show the ⊕ mark.

```rpg map
grid: hex
title: Inline test
pack: basic
scale: 30 mi
---
0m:
  * t(0,0): ocean
  * t(1,0): plains @Dunlind
  * t(0,1): forest
  * t(2,0): hills

level 1:
  * t(6,0): plains
  * t(7,0): forest
  * t(6,1): forest
  * t(5,1): plains
  * t(3,1): ocean
  * t(3,2): ocean

level 2:
  * t(36,0): urban[lush][hamlet]
  * t(37,0): plains
  * t(35,0): fields
```
