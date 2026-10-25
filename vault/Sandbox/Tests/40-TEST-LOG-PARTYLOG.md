# Session Log Test: Partylog Format

Test demonstrating Partylog notation with attributed actions, world events, and combat.

```rpg log
state_key: test-partylog
scene: "Forest Ambush"
entities:
  - file: "tales-of-the-valiant/adventuring/characters/Kowyn.md"
    type: character
  - file: "tales-of-the-valiant/adventuring/characters/Lilith.md"
    type: character
---
S1 *Dense forest path. Sunlight filters through the canopy.*

@(Kowyn) Scout ahead along the trail
d(Kowyn): Perception d20+4=16 vs DC 12 -> Success
=> She spots movement in the underbrush. [N:Bandit Scout|hidden]

? Does the bandit notice Kowyn?
-> No, but... (d6=4)
=> He's wary, but hasn't spotted her yet.

! Three bandits spring from the tree line
=> [F:Bandit×3|HP 11 each|Close]

[COMBAT]
R1
@(Kowyn) Cast Entangle on the bandit group
d(Kowyn): Spell DC 13, bandits DEX save d20+1=8 -> Fail
=> Roots erupt from the ground. Two bandits restrained.

@(Lilith) Eldritch Blast at the free bandit
d(Lilith): d20+5=18 vs AC 12 -> Hit
d: 1d10+3=9 force
=> [F:Bandit×3→2]

@(Bandit Scout) Breaks free and runs
d: Athletics d20+2=14 vs DC 13 -> Success
=> Escapes toward the road. [N:Bandit Scout|fleeing]

R2
@(Kowyn > Lilith) Coordinated attack on restrained bandits
d(Kowyn): d20+4=17 vs AC 12 -> Hit
=> Both remaining bandits fall. [F:Bandit×2→0]
[/COMBAT]

=> Combat ends. [Clock:Bandit Alert 1/4]

PC(Kowyn): "That scout got away. They'll know we're coming."
N(Bandit Scout): [distant] "Captain! Intruders on the north trail!"

S2 *Looting the fallen bandits*

@(Lilith) Search the bodies
d(Lilith): Investigation d20+2=14 vs DC 10 -> Success
=> [Inv:Short Sword|2|rusty] [Inv:Rations|3|days] [Wealth:Gold+8]

@(Kowyn) Use a healing potion after the fight
=> [Inv:Healing Potion-1] [PC:Kowyn|HP+7]

[RESOURCES]
[PC:Kowyn|HP 18/22|Supply d8]
[PC:Lilith|HP 15/15]
[Wealth:Gold 53|Silver 4]
[Inv:Healing Potion|1]
[Inv:Rations|7|days]
[Inv:Short Sword|2|rusty]
[/RESOURCES]

(note: great ambush scene, Entangle was clutch)

S3 *Tarot reading at camp*

? What awaits us on the road ahead?
d: Past=M16r // The Tower reversed, Present=KWa // King of Wands, Future=ACu // Ace of Cups
=> Collapse delayed. The fire is ours. Something new awaits.

@(Lilith) Draw from her oracle deck
d: draw=Qs -> Dark omen
=> The Queen of Spades. A watchful enemy moves in shadow.
```
