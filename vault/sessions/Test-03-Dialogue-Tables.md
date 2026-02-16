# Session Log Test 3: Dialogue, Tables & Meta Notes

This test demonstrates dialogue formatting, table/generator rolls, and meta notes.

```rpg log
state_key: test-dialogue-tables
scene: "The Mysterious Stranger"
entities:
  - file: "sessions/Characters/Elara.md"
    type: character
  - file: "sessions/Characters/Thorne.md"
    type: character
---
S1 *A hooded figure approaches the party at the crossroads.*

N (Stranger): "Greetings, travelers. I have a proposition for you."

PC (Elara): "We don't talk to strangers in dark cloaks."

N (Stranger): "Wise. But I come bearing gold... and information."

@ Thorne senses deception
d: Insight d20+5=12 vs DC 14 -> Failure
=> He can't get a read on the stranger.

PC (Thorne): "What kind of information?"

N (Stranger): "The location of the artifact you seek. For a price."

(note: The stranger is actually Lord Vane in disguise, setting up next session's betrayal)

@ Elara negotiates
d: Persuasion d20+4=18 vs DC 15 -> Success
=> They agree to 100 gold pieces instead of 200.

N (Stranger): "Very well. Meet me at the old mill at midnight."

=> The stranger disappears into the mist. [Thread:Stranger's Deal|active]

S2 *Later that evening, at the inn.*

@ Elara asks the bartender about the old mill
tbl: Local Rumors d6=4 -> "Haunted by restless spirits"

@ Thorne consults his deity for guidance
? Oracle: Should we trust the stranger? -> No, but...
=> Thorne receives a vision of danger mixed with opportunity.

@ They prepare for the meeting
gen: Random Encounter d100=23 -> "Traveling Merchant"

N (Merchant): "Fine wares! Potions! Scrolls!"

@ Elara buys healing potions
=> [E:Healing Potion|acquired|count=2]
[PC:Elara|gold-30]

PC (Elara): "We might need these tonight."

PC (Thorne): "Let's hope not. But yes, good thinking."

(note: Foreshadowing the ambush at the mill - 3 bandits waiting)

=> [Timer:Meeting Time 0/4] Evening falls.
```

## Expected Visual Results

**Dialogue:**
- PC(Name): "text" → Character speech with distinct styling
- N(Name): "text" → NPC speech with distinct styling
- Proper quote formatting and speaker identification

**Tables & Generators:**
- tbl: prefix with table name and result
- gen: prefix with generator name and result
- Distinct visual treatment from normal rolls

**Meta Notes:**
- (note: text) → Styled as GM notes
- Visually distinct (perhaps dimmed or italicized)
- Clearly meta-information, not in-game content

**Mixed Content:**
- All content types flowing together
- Each maintains distinct visual identity
- Clear hierarchy and readability

## Success Criteria

- ✅ PC dialogue has character-specific styling
- ✅ NPC dialogue has NPC-specific styling
- ✅ Speaker names are properly formatted
- ✅ Table rolls show table name and result
- ✅ Generator rolls show generator name and result
- ✅ Meta notes are visually distinct
- ✅ Timer tracker displays correctly (0/4)
- ✅ Thread tag shows "active" status
- ✅ Equipment with count displays properly (count=2)
- ✅ Gold delta tracked in change overview
