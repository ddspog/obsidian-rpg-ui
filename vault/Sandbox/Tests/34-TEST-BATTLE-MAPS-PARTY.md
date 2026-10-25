---
cssclasses:
  - note-feature
pcs:
  - "[[Jacqui Ilitul]]"
  - "[[Kowyn]]"
  - "[[Lilith]]"
  - "[[Talon Pallton]]"
gm: "[[00. GM Screen]]"
---
# Battle Maps — Sandbox

A fight left **open** on a map declared in the log itself (`maps:` in its header, used by `[COMBAT: Clearing]`), to play cards into. Open the drawer under the log, pick someone on the **Party** or **Foes** side and play any card: since the fight is still on, the popup asks for a **Move** — it says where they stand now, and takes a square (`E3`) or a route (`K12>L10`). Open the Log sidebar to watch the map follow.

Played too much? Delete the lines you added from the block (everything after `T1` and the elite's round) to start over. Close the fight with `[/COMBAT]` and the cards stop asking.

```rpg log
state_key: battle-map-sandbox
maps:
  Clearing:
    image: "[[01s02-encounter-with-kowyn-clean.png]]"
    cell: 33
    offset: -1, -1
---
? Combat begins with no one surprised. [F:[[Kobold, Tinkerer]]|HP 25] [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9] [F:Thin [[Kobold, A]]|HP 9]
=> Movement rustled through the brush, and suddenly, we were surrounded.
[Init: [[Kobold, Tinkerer]] 22 @H5; [[Kobold, Elite]] 20 @N5; Thin [[Kobold, A]] 18 @R8; Talon 14 @J14; Fat [[Kobold, A]] 9 @F7 🐸; Kowyn 8 @L11; Jacqui 7 @M15; Lilith 2 @O14]
[COMBAT: Clearing]
T1
@(Kobold, Elite) [Mv: N8] Closes in
=> The elite came down off the rocks, pick in hand.
```
