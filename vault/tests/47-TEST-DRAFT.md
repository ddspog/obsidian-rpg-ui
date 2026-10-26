# Test: the GM's drafting block (`rpg draft`)

A draft gathers ideas for the adventure and copies them as one prompt for an
LLM (docs/draft-block.md).

Try it:
- **Drawer:** open *Fate Question* in the GM hotbar at the foot, ask, pick the odds, roll, *Append*: the lines land in the ideas, told as prose with the Log beside them.
- **Log:** click a die in the Log to reroll it (or type a value), then *Save*; *Undo* drops the edits.
- **Code:** switch to *Code* to see and edit the ideas as text; back to *Prose* to read them.
- **Tables:** *Add a table note…* and pick a note with `rpg table` blocks (one under `gm-tools/tables`), then roll one.
- **Map:** *Pick hexes*, then click hexes on Pointy Woods at level 2 (1 mi); the cart's hex is picked already.
- **Attached:** *Attach a note…* a statblock or an item.
- **Ask for:** choose what the prompt asks the LLM to make; *Prompt* shows it, *Copy prompt* puts it on the clipboard.

```rpg draft
draft: Kobold cult in the Pointy Woods
gm: "[[00. GM Screen]]"
map: "[[Pointy Woods]]"
level: 2
hexes: [[33, -51]]
attach: ["[[Kobolds]]", "[[Kobold, Elite]]"]
ask: encounter
---
The cult that Kowyn fled tracks him to the wreck of the cart.
They want the bag back more than they want Kowyn.

? Are the kobolds already at the cart?
-> d100=34 vs Likely (CF 5) -> Yes
```
