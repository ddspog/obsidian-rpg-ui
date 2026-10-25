# Session Log Test: Action Cards

Test for the interactive action card system with characters.

```rpg log
state_key: test-action-cards
scene: "Forest Ambush"
entities:
  - file: "tales-of-the-valiant/adventuring/characters/Kowyn.md"
    type: character
  - file: "tales-of-the-valiant/adventuring/characters/Lilith.md"
    type: character
---
S1 *Dense forest path. Sunlight filters through the canopy.*

@ Elara scouts ahead
d: Perception d20+4=16 vs DC 12 -> Success
=> She spots movement in the underbrush. [N:Bandit Scout|hidden]

? Does the bandit notice Elara?
-> No, but... (d6=3)
=> He's wary, but hasn't spotted her yet.

@ Thorne prepares a blessing
=> [PC:Thorne|Shield of Faith active]
@ Kowyn uses Druidic
S2 *res*
S23 *test*
```

## What to Test

1. **Bottom Drawer** renders below the log entries with Actions/Changes tabs
2. **Actor Tabs** show: Game Master, Elara, Thorne
3. **Elara's stacks**:
   - Action: Shortsword Attack, Shortbow Attack, Throw Dagger, Stealth
   - Bonus: Cunning Action, Potion of Healing (2/2)
   - Reaction: Uncanny Dodge (1/1)
   - Passive: Sneak Attack
4. **Thorne's stacks**:
   - Action: Sacred Flame, Warhammer Attack, Guiding Bolt (4/4), Channel Divinity (1/1)
   - Bonus: Healing Word (4/4), Spiritual Weapon (3/3), Shield of Faith (4/4)
   - Active: Blessing of the Forge (1/1)
   - Passive: Destroy Undead
5. **GM stacks**: Narration, Oracle, Mechanics, Meta
6. **Card hover**: Fan animation expands cards upward
7. **Card click**: Cards with `{{target}}` show popover with entity dropdown
8. **Append**: Resolved text appends to the log body
