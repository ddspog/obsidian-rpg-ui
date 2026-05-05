---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Illusion
casting: 1 action
range: Self
components:
  - S
duration: 1 round
style:
  - Shadow
summary: Simple invisibility for a turn.
.effect:
list_actions:
  - "[[Vanish º]]"
.item: 
reference_desc:
  - You become [[invisible]] along with anything you are wearing or carrying until the end of the current turn, or until you attack, cast a spell, make a damage roll, or force a creature to make a saving throw.
reference_img: "![[vanish.webp|384]]"
source: From **D&D 5e** "Uvoir's Assemblage of Arcane Might" book by **Sunbear Games**
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