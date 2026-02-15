# Session Log Test 2: Scene Variants & Progress Trackers

This test demonstrates different scene types and progress tracking mechanisms.

```rpg log
state_key: test-scene-variants
scene: "The Heist"
entities:
  - file: "Session-Tests/Characters/Elara.md"
    type: character
  - file: "Session-Tests/Characters/Thorne.md"
    type: character
---
S1 *Present: Planning the heist in a shadowy tavern.*

@ Elara studies the manor blueprints
? Oracle: Does she find a secret entrance? -> Yes
=> She discovers a servant's passage. [Track:Planning 1/3]

@ Thorne gathers supplies
=> [E:Grappling Hook|acquired] [E:Rope|acquired]
[Track:Planning 2/3]

S1a *Flashback: Elara's first burglary, ten years ago.*

@ Young Elara picks her first lock
d: Sleight of Hand d20+3=15 vs DC 12 -> Success
=> The lock clicks open. A career is born.

S1 *Back to present: Final preparations complete.*

=> [Track:Planning 3/3|complete]

S2 *Night of the heist. The manor looms dark.*

@ Elara and Thorne approach the servant's entrance
d: Group Stealth d20+7=14, d20+2=8 vs DC 13 -> Partial Success
=> Elara makes it, but Thorne stumbles on gravel.
[Clock:Guards Alert 1/4]

T1-S2 *Meanwhile: Guards making their rounds.*

@ Guard captain hears noise
d: Perception d20+3=16 vs DC 15 -> Success
=> "What was that? Check the east wall!"
[Clock:Guards Alert 2/4]

S2 *Elara helps Thorne into the passage.*

@ They move through the dark corridor
d: Stealth d20+7=19, d20+2=15 vs DC 14 -> Success
=> They slip past the kitchen unnoticed.

S2.1 *Montage: Various challenges overcome.*

=> [Clock:Treasure Found 1/4]
=> [Clock:Treasure Found 2/4]
=> [Clock:Treasure Found 3/4]

S3 *The treasure vault. One lock remains.*

@ Elara picks the final lock
d: Sleight of Hand d20+7=22 vs DC 18 -> Success
=> [Clock:Treasure Found 4/4|complete]
[E:Noble's Jewels|acquired]

@ They escape via rooftop
=> [Thread:The Heist|resolved|success]
[PC:Elara|reputation+1] [PC:Thorne|reputation+1]
```

## Expected Visual Results

**Scene Headers:**
- S1: Normal scene (present)
- S1a: Flashback style (different visual treatment)
- T1-S2: Parallel scene (different visual treatment)
- S2.1: Montage style (different visual treatment)

**Progress Trackers:**
- Track bars showing progress (1/3, 2/3, 3/3)
- Clock indicators (1/4, 2/4, etc.)
- Thread markers with resolution status
- Visual indication when complete

**Entity Tags:**
- [E:Grappling Hook|acquired] → Equipment tag
- [PC:Elara|reputation+1] → Character stat change
- [Thread:The Heist|resolved|success] → Thread completion

**Oracle Queries:**
- "?" questions with "→ Yes" answers
- Formatted distinctly from normal text

## Success Criteria

- ✅ S1a renders with flashback styling
- ✅ T1-S2 renders with parallel scene styling
- ✅ S2.1 renders with montage styling
- ✅ Track progress bars show correctly (1/3, 2/3, 3/3)
- ✅ Clock trackers increment properly
- ✅ Thread shows resolved status
- ✅ Equipment tags render distinctly
- ✅ Oracle queries have special formatting
- ✅ Change overview includes all tracker updates
