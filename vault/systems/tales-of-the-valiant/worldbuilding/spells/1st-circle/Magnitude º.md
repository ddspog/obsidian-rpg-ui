---
cssclasses:
  - note-spell
---
# Magnitude º

```rpg spell
circle: 1st-Circle
source:
  - "[[Arcane]]"
  - "[[Primordial]]"
school: Evocation
casting: 1 action
range: 60 ft.
components:
  - S
  - M (a stone gathered from a fault line)
duration: Instantaneous
style:
  - Draconic
summary: People go prone and terrain goes rough.
text: |-
  You send echoing vibrations into the ground in a 10-foot radius circle centered on a point you can see within range.<br/><br/>

  Each creature in the area must make a Dexterity saving throw or take 1d6 bludgeoning damage, plus an additional 1d6 bludgeoning damage for each Small or larger creature in the area. On a successful save, a creature takes half as much damage.<br/><br/>

  If the total of the damage roll of the spell is 10 or higher, each creature that failed its saving throw is knocked prone. If the total is 15 or higher, any loose earth or stone in the area becomes difficult terrain until cleared, with each 5-foot-diameter portion requiring at least 1 minute to clear by hand.<br/><br/>

  **At Higher Levels**. When you cast this spell using a spell slot of 2nd level or higher, you can increase the diameter of the circle by up to 5 feet for each slot level above 1st.
image: "![[magnitude.webp|384]]"
roll:
  form: save
  circle: 1
  range: Self (10-ft radius)
  save:
    ability: DEX
    on_success: "half damage"
  damage:
    roll: 1d6
    type: bludgeoning
  effects:
    - prone
  notes: +1d6 per Small+ creature; prone if total ≥10, difficult terrain if ≥15
  upcast:
    2: { range: "Self (15-ft radius)" }
    3: { range: "Self (20-ft radius)" }
    4: { range: "Self (25-ft radius)" }
    5: { range: "Self (30-ft radius)" }
```



**Source**: *From **D&D 5e** "Uvoir's Assemblage of Arcane Might" book by **Sunbear Games***
