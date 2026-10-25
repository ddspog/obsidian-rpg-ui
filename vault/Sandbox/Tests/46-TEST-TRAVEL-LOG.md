# Test 46: Travel in the session log (hex-map-design §14.2)

A journey on the hex map in [[45-TEST-HEXMAP-MODES]]: groups, a split, a lone
scout, a mark for a while, and the arrival setting the clock. The map stays in
view while the journey's entries scroll under it; ◀ ▶ step through them, and
Fog darkens what nobody has seen. After the journey, a teleport
jumps the party east without a `[TRAVEL]` block.

```rpg log
state_key: travel-log-test
---
S1 The road north
[Group: Party = Elara, Thorne, Talon, Lilith]
[Pos: Party (0,0)]
[TRAVEL: [[45-TEST-HEXMAP-MODES]]]
@(Party) [Mv: (1,0)] Down to the plains road
=> The road is quiet; a tower watches from the hills.
[Group: Party > Scouts = Talon, Lilith]
@(Scouts) [Mv: (3,-1)] Ride ahead to the tower
=> The watch is empty, its fire still warm.
[Mark: Ambush|here-red[skull]@(4,-1)|until dawn]
@(Elara) [Mv: (1,1)] Goes to the camp alone
=> She finds tracks: a dozen boots, heading east.
@(Party) [Mv: (2,0)] Follow the road east
[Mark: -Ambush]
[Group: Scouts > Party]
[/TRAVEL: arrive Day 3, 18:00 | 90 mi | 3 days | rations -8 | outcome Reached the ford; the scouts saw the ambush coming]
=> They camp at the ford.
@(Party) [Mv: (4,0) | teleport] Kowyn's circle takes them east
=> The air folds; they stand among white mushrooms.
```
