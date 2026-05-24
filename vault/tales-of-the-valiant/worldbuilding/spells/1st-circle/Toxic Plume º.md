---
cssclasses:
  - note-spell
source: From **D&D 5e** "Uvoir's Assemblage of Arcane Might" book by **Sunbear Games**
---
# Toxic Plume º

```rpg spell
circle: 1st-Circle
source:
  - "[[Arcane]]"
  - "[[Primordial]]"
school: Evocation
casting: 1 action
range: Self
components:
  - S
  - M (a pinch of spores from a toxic mushroom)
duration: 1 minute
style:
  - Draconic
summary: Give poisoned to creatures on a cone.
image: "![[toxic-plume.webp|384]]"
roll:
  form: save
  circle: 1
  range: Self (15-foot cone)
  save:
    ability: CON
    on_success: "no damage"
  damage:
    roll: 2d6
    type: poison
  effects:
    - poisoned
  notes: poisoned (1m) on failed save
  upcast:
    2: { damage: { roll: 3d6, type: poison } }
    3: { damage: { roll: 4d6, type: poison } }
    4: { damage: { roll: 5d6, type: poison } }
    5: { damage: { roll: 6d6, type: poison } }

---
A cloud of noxious gas spews forth in a 15-foot cone. Each creature in the area must make a Constitution saving throw or take 2d6 poison damage and become poisoned for 1 minute.A creature can repeat the save at the end of each of its turns.On a success, the effect ends for it.On a failure, it takes 1d6 poison damage.<br/><br/>

**_At Higher Levels._** When you cast this spell using a spell slot of 2nd level or higher, the initial damage increases by 1d6 for each slot level above 1st.
```
