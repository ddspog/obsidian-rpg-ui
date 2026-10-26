# Test: painting a hex map (paint mode, design §13)

Press the brush in the map's corner. Pick a tool and a layer, and something from
the sidebar's palette, then click or drag over the hexes. Right-click erases,
Alt-click picks, and Space-drag pans. Ctrl/Cmd+Z undoes. Each stroke is written
back into the block below.

- **Fill** (lasso): draw a loop, and every hex inside gets the brush.
- **Select**: drag a box (Shift adds, Alt takes away), then Fill, Erase, add to a
  region, or **Make a custom tile** from those hexes.
- **Custom tiles** (first in the palette): **+ new** opens the tile builder, where
  you paint a hex (or a few) from the pack's art on any layer, adjust it with
  Look, and save it by name to the pack. Pick one to paint it like any tile; R
  turns it. **Expand** turns one on the map back into its own lines.
- **Look**: click a hex and drag it to shift it. Size, hue and saturation are
  sliders in the sidebar.
- **Scale → Detail**: makes (or opens) a 5-mile map of the hex last clicked. The
  hex (1,0) already has one: [[44b-TEST-HEXMAP-DETAIL]].

```rpg map
grid: hex
title: Paint test
pack: basic
scale: 30 mi
---
0m:
  * t(0,0): ocean
  * t(1,0): plains @Dunlind
  * t(0,1): forest
  * t(1,1): plains size=1.2 hue=30
  * t(-1,1): forest
  * t(-1,2): forest
  * t(1,-1): forest
  * t(2,-2): forest
  * t(3,-2): forest
  * t(4,-3): forest
  * t(2,-1): forest
  * t(3,-1): forest
  * t(0,-1): forest
  * t(1,-2): forest
100m: base=rocky
  * t(2,0): hills
```

## An empty map

```rpg map
grid: hex
title: Empty paint test
pack: basic
---
```
