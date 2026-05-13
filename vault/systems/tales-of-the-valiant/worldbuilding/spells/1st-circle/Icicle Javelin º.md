---
cssclasses:
  - note-spell
source: From **D&D 5e** "Valda's Spire of Secrets" book by **Mage Hand Press**
---
# Icicle Javelin º

```rpg spell
circle: 1st-Circle
source:
  - "[[Arcane]]"
  - "[[Primordial]]"
school: Conjuration
casting: 1 action
range: 60 ft.
components:
  - V
  - S
  - M (a small icicle)
duration: Instantaneous
style:
  - Dragon
summary: Hurl an ice lance that can pin target.
text: |-
  You fling a massive icicle toward a target of your choice within range. Make a ranged spell attack against the target. On a hit, the target takes 3d8 cold damage. If the target is also adjacent to a wall, or a similar large, immobile object, it may also be pinned to that surface on its next turn. At the beginning of its turn, the target can make a Strength saving throw. On a failed save, it has a speed of 0 until the start of its next turn.<br/><br/>

  **_At Higher Levels._** When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.
image: "![[icicle-javelin.webp|384]]"
roll:
  form: spell
  circle: 1
  range: 60 ft.
  damage:
    roll: 3d8
    type: cold
  effects:
    - pin
  notes: may pin target adjacent to large surface
  upcast:
    2: { damage: { roll: 4d8, type: cold } }
    3: { damage: { roll: 5d8, type: cold } }
    4: { damage: { roll: 6d8, type: cold } }
    5: { damage: { roll: 7d8, type: cold } }
```
