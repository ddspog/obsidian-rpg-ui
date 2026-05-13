---
cssclasses:
  - note-spell
source: From **D&D 5e** "Heliana's Guide to Monster Hunting" book by **Hitpoint Press**
---
# Magnetobolt º

```rpg spell
circle: Cantrip
source:
  - "[[Arcane]]"
  - "[[Primordial]]"
  - "[[Wyrd]]"
school: Evocation
casting: 1 action
range: 90 ft.
components:
  - V
  - S
duration: Instantaneous
style:
  - Rune
summary: Pull a creature to the ground.
text: |-
  A near-invisible pulse of arcanomagnetic energy shoots towards a creature within range. Make a ranged spell attack against the target. On a hit, the target takes _1d6 force_ damage and must succeed on a _Strength saving throw_ or be knocked _prone_. A creature made of ferrous metal or wearing ferrous armour has _disadvantage_ on this saving throw. <br/> <br/>

  This spell’s damage increases by _1d6_ when you reach 5th level (_2d6_), 11th level (_3d6_), and 17th level (_4d6_).
image: "![[magnetobolt.webp|384]]"
roll:
  form: spell
  circle: 0
  range: 90 ft.
  damage:
    roll: 1d6
    type: force
  save:
    ability: STR
    on_success: "negates prone"
  effects:
    - prone
  notes: knocked prone on failed save
  leveled:
    at:
      5:  { damage: { roll: 2d6, type: force } }
      11: { damage: { roll: 3d6, type: force } }
      17: { damage: { roll: 4d6, type: force } }
```
