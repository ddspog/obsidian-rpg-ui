---
.spell: 
circle: Cantrip
magic_source:
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
.effect:
list_actions:
  - "[[Magnetobolt º]]"
.item: 
reference_desc:
  - A near-invisible pulse of arcanomagnetic energy shoots towards a creature within range. Make a ranged spell attack against the target. On a hit, the target takes _1d6 force_ damage and must succeed on a _Strength saving throw_ or be knocked _prone_. A creature made of ferrous metal or wearing ferrous armour has _disadvantage_ on this saving throw. <br/> <br/>
  - This spell’s damage increases by _1d6_ when you reach 5th level (_2d6_), 11th level (_3d6_), and 17th level (_4d6_).
reference_img: "![[magnetobolt.webp|384]]"
source: From **D&D 5e** "Heliana's Guide to Monster Hunting" book by **Hitpoint Press**
.metadata: 
cssclasses:
  - note-spell
---
```tx
| --- |
|`= this.circle`, `= this.magic_source` (`= this.school`)|
[#css/tx/props/row]
```
```tx
| --- |
|**Casting Time**: `= this.casting`|
|**Range**: `= this.range`|
|**Components**: `= this.components`|
|**Duration**: `= this.duration`|
|**Suitable for** `= this.style` style|
[#css/tx/props/stats]
```
```tx
|`= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*