---
cssclasses:
  - note-spell
source: From **D&D 5e** "Deep Magic 2" book by **Kobold Press**
---
# Lunarbolt Waxing ᴷ
```rpg spell
circle: 1st-Circle
source:
  - "[[Divine]]"
  - "[[Primordial]]"
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Evocation
casting: 1 action
range: 120 ft.
components:
  - V
  - S
  - M (a small spherical stone painted white)
duration: Instantaneous
style:
  - Portal
summary: Bolt that hits more by distance.
image: "![[lunarbolt-waxing.webp|384]]"
roll:
  form: spell
  circle: 1
  range: ≤30 ft.
  damage:
    - { roll: 1d10, type: cold }
  notes: radiant scales with distance; upcast increases cold dice (see spell text)
  swapOn:
    field: range
    options:
      - value: ≤30 ft.
        damage:
          - { roll: 1d10, type: cold }
      - value: 35–60 ft.
        damage:
          - { roll: 1d10, type: cold }
          - { roll: 1d4, type: radiant }
      - value: 65–90 ft.
        damage:
          - { roll: 1d10, type: cold }
          - { roll: 2d4, type: radiant }
      - value: 95–120 ft.
        damage:
          - { roll: 1d10, type: cold }
          - { roll: 3d4, type: radiant }
  upcast:
    2: { damage: [{ roll: 2d10, type: cold }, { roll: 3d4, type: radiant }] }
    3: { damage: [{ roll: 2d10, type: cold }, { roll: 3d6, type: radiant }] }
    4: { damage: [{ roll: 3d10, type: cold }, { roll: 3d6, type: radiant }] }
    5: { damage: [{ roll: 3d10, type: cold }, { roll: 3d6, type: radiant }] }

---
You hurl a bolt of concentrated moonlight at a creature you can see within range. The bolt expands in size and grows in strength as it travels. Make a ranged spell attack against the target. On a hit, a target takes 1d10 cold damage and suffers additional damage based on the distance between you and the target, as detailed below <ul>

<li>If the target is between 35 and 60 feet away from you, it takes an additional 1d4 radiant damage.

<li>If the target is between 65 and 90 feet away from you, it takes an additional 2d4 radiant damage.

<li>If the target is between 95 and 120 feet away from you, it takes an additional 3d4 radiant damage.</ul>

**_At Higher Levels._** When you cast this spell using a spell slot of 2nd level or higher, the cold damage increases by 1d10 for every two slot levels above 1st. When you cast this spell using a spell slot of 3rd level or higher, the d4s of the additional radiant damage become d6s.
```
