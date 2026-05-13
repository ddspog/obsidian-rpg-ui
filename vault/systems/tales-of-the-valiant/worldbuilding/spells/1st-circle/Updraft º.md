---
cssclasses:
  - note-spell
source: From **D&D 5e** "Uvoir's Assemblage of Arcane Might" book by **Sunbear Games**
---
# Updraft º

```rpg spell
circle: 1st-Circle
source:
  - "[[Arcane]]"
  - "[[Primordial]]"
school: Evocation
casting: 1 action
range: 30 ft.
components:
  - V
  - S
duration: Instantaneous
style:
  - Ritual
summary: Whirlwind throwing people up.
text: |-
  A surge of air rises up in a 5-foot radius, 20-foot-high cylinder centered upon a point within range, All creatures within the spell’s area must make a Strength saving throw. On a failed save, a creature is swept up by the winds and carried up to the top of the cylinder.<br/><br/>

  All creatures within 5 feet of the cylinder must succeed on a Strength saving throw or be moved into the nearest unoccupied space within the cylinder and carried to the top as air sweeps into the space.<br/><br/>

  A creature brought to the top of the cylinder then fall as the wind fades, unless it has a flying speed or something holding it aloft.<br/><br/>

  **_At Higher Levels._** When you cast this spell using a spell slot of 2nd level or higher, the height of the cylinder increases by 10 feet for each slot level above 1st.
image: "![[updraft.webp|384]]"
roll:
  form: save
  circle: 1
  range: Self (5-ft radius, 20-ft up)
  save:
    ability: STR
    on_success: "stays grounded"
  notes: swept to top of cylinder then falls (falling damage); +10 ft height/circle
  upcast:
    2: { range: "Self (5-ft radius, 30-ft up)" }
    3: { range: "Self (5-ft radius, 40-ft up)" }
    4: { range: "Self (5-ft radius, 50-ft up)" }
    5: { range: "Self (5-ft radius, 60-ft up)" }
```
