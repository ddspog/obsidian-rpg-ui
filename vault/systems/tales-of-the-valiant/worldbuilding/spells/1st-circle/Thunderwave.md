---
cssclasses:
  - note-spell
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
---
# Thunderwave

```rpg spell
circle: 1st-Circle
source:
  - "[[Arcane]]"
  - "[[Primordial]]"
school: Evocation
casting: 1 action
range: Self (15-foot cube)
components:
  - V
  - S
duration: Instantaneous
style:
  - Draconic
summary: Push and damage foes.
text: |-
  A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a CON save. On a failed save, a creature takes 2d8 thunder damage and is pushed 10 feet away from you. On a successful save, the creature takes half as much damage and isn’t pushed.<br/><br/>

  In addition, unsecured objects that are completely within the area of effect are automatically pushed 10 feet away from you by the spell’s effect, and the spell emits a thunderous boom audible out to 300 feet.<br/><br/>

  **_At Higher Circles._** When you cast this spell using a spell slot of 2nd circle or higher, the damage increases by 1d8 for each slot above 1st.
image: "![[thunderwave.webp|384]]"
roll:
  form: save
  circle: 1
  range: Self (15-ft cube)
  save:
    ability: CON
    on_success: "half damage"
  damage:
    roll: 2d8
    type: thunder
  effects:
    - push
  notes: pushes foes 10 ft on fail
  upcast:
    2: { damage: { roll: 3d8, type: thunder } }
    3: { damage: { roll: 4d8, type: thunder } }
    4: { damage: { roll: 5d8, type: thunder } }
    5: { damage: { roll: 6d8, type: thunder } }
```
