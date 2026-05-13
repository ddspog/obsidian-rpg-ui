---
cssclasses:
  - note-spell
source: From **D&D 5e** "Deep Magic 1" book by **Kobold Press**
---
# Luminous Bolt ᴷ

```rpg spell
circle: Cantrip
source:
  - "[[Arcane]]"
  - "[[Divine]]"
  - "[[Primordial]]"
school: Evocation
casting: 1 action
range: 60 ft.
components:
  - V
  - S
duration: Instantaneous
style:
  - Portal
summary: Shoot a blinding light.
text: |-
  A ray of sunlight shoots out at a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d6 radiant damage, and it must succeed on a Constitution saving throw or become [[blinded]] until the end of its next turn.  <br/> <br/>

  The spell’s damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), and 17th level (4d6).
image: "![[luminous-bolt.webp|384]]"
roll:
  form: spell
  circle: 0
  range: 60 ft.
  damage:
    roll: 1d6
    type: radiant
  save:
    ability: CON
    on_success: "negates blinded"
  effects:
    - blinded
  notes: blinded until end of its next turn on failed save
  leveled:
    at:
      5:  { damage: { roll: 2d6, type: radiant } }
      11: { damage: { roll: 3d6, type: radiant } }
      17: { damage: { roll: 4d6, type: radiant } }
```
