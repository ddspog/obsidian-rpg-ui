# Session Log Test 1: Basic Combat

This test demonstrates basic combat with actions, rolls, and consequences.

```rpg log
state_key: test-basic-combat
scene: "Goblin Ambush"
entities:
  - file: "sessions/Characters/Elara.md"
    type: character
  - file: "sessions/NPCs/Goblin.md"
    type: monster
---
S1 *Dark forest clearing at dusk. Goblins lurk in the shadows.*

@ Elara sneaks toward the goblin camp
d: Stealth d20+7=18 vs DC 14 -> Success
=> She moves silently between the trees. [N:Goblin Lookout|unaware]

@ Elara attacks Goblin Lookout with surprise
d: Attack d20+7=19 vs AC 15 -> Hit
d: Damage 1d8+4=9 slashing
=> [N:Goblin Lookout|HP-9|dead]

@ Remaining goblins hear the scuffle
=> [N:Goblin Warrior|alert] [N:Goblin Archer|alert]

@ Goblin Warrior charges Elara
d: Attack d20+4=12 vs AC 16 -> Miss
=> His scimitar swings wide.

@ Elara ripostes
d: Attack d20+7=21 vs AC 15 -> Critical Hit!
d: Damage 2d8+4=14 slashing
=> [N:Goblin Warrior|HP-14|dead]

@ Goblin Archer shoots
d: Attack d20+4=16 vs AC 16 -> Hit
d: Damage 1d6+2=5 piercing
=> [PC:Elara|HP-5]

@ Elara throws dagger
d: Attack d20+7=15 vs AC 15 -> Hit
d: Damage 1d4+4=7 piercing
=> [N:Goblin Archer|HP-7|dead]

=> Combat ends. [PC:Elara|victorious]
```

## Expected Visual Results

**Scene Header:**
- S1 marker with scene context
- Styled as flashback/normal/parallel based on marker

**Event Cards:**
- Action cards (@ symbol) with action text
- Roll cards (d: symbol) showing dice, result, vs DC/AC, outcome
- Consequence cards (=> symbol) with outcome text
- Tags inline with proper styling

**Entity Tags:**
- [N:Goblin Lookout|HP-9|dead] → NPC tag with HP delta and death status
- [PC:Elara|HP-5] → PC tag with HP delta
- [N:Goblin Warrior|alert] → NPC tag with status

**Change Overview:**
- Summary showing:
  - Elara: HP 45 → 40 (-5)
  - Goblin Lookout: HP 7 → 0 (dead)
  - Goblin Warrior: HP 7 → 0 (dead)
  - Goblin Archer: HP 7 → 0 (dead)

## Success Criteria

- ✅ Scene header renders with proper styling
- ✅ All event types render as distinct cards
- ✅ Rolls show proper formatting (d20+7=19)
- ✅ Tags have appropriate styling (NPC vs PC)
- ✅ HP deltas are calculated correctly
- ✅ Status changes are tracked (dead, alert)
- ✅ Change overview summarizes all deltas
- ✅ No console errors
