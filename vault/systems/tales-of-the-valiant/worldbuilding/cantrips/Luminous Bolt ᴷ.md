---
.spell: 
circle: Cantrip
magic_source:
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
.effect:
list_actions:
  - "[[Luminous Bolt ᴷ]]"
.item: 
reference_desc:
  - A ray of sunlight shoots out at a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d6 radiant damage, and it must succeed on a Constitution saving throw or become [[blinded]] until the end of its next turn.  <br/> <br/>
  - The spell’s damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), and 17th level (4d6).
reference_img: "![[luminous-bolt.webp|384]]"
source: From **D&D 5e** "Deep Magic 1" book by **Kobold Press**
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