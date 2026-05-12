---
cssclasses:
  - note-spell
source: *From **Tales of the Valiant** "Player's Guide" book by **Kobold Press***
---
# Cure Wounds
```rpg spell
circle: 1st-Circle
source:
  - "[[Divine]]"
  - "[[Primordial]]"
school: Necromancy
casting: 1 action
range: Touch
components:
  - V
  - S
duration: Instantaneous
style:
  - Dream
summary: Average heal to ally.
text: |-
  A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. <br/> <br/>

  This spell has no effect on Constructs or Undead. <br/> <br/>

  **_At Higher Circles._** When you cast this spell using a spell slot of 2nd circle or higher, the healing increases by 1d8 for each slot above 1st.
image: "![[cure-wounds.webp|384]]"
roll:
  form: healing
  circle: 1
  range: Touch
  damage:
    roll: 1d8
    type: healing
  notes: no effect on Constructs or Undead
  upcast:
    2: { damage: { roll: 2d8, type: healing } }
    3: { damage: { roll: 3d8, type: healing } }
    4: { damage: { roll: 4d8, type: healing } }
    5: { damage: { roll: 5d8, type: healing } }
```
