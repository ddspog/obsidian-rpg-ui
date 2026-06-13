# Test 06 — GM Screen (feature.gm)

This session log links a **GM Screen** via the `gm:` field. The GM actor chip's
card stacks come from the screen's `rpg feature.gm` blocks (Oracle / Roll / Table
/ Generator / Event / Scene) instead of the built-in generic GM cards.

**To verify:** open the bottom drawer, select the **GM** actor chip, and click a
card (e.g. *Scene Check*). Fill the prompted slots; the emitted lonelog appends
to the log body with dice left unrolled (`d10=`) for inline filling.

```rpg log
state_key: test-gm-screen
gm: "[[GM-Screen-Mythic]]"
entities:
  - file: "tales-of-the-valiant/adventurers/Lilith.md"
    type: character
---
S1 *The road north out of Carnsperbourne.*

@(Lilith) Scouts the ridge for the landslide the rumors warned of
d: Perception d20+4=16 vs DC 12 -> Success
=> The slope is unstable — one wrong step and the path goes out from under us.
```
