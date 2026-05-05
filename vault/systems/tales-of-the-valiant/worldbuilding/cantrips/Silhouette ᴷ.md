---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
school: Illusion
casting: 1 action
range: Touch
components:
  - V
  - S
duration: Concentration, 1 minute
style:
  - Shadow
summary: Fool creatures with a shadow.
.effect:
list_actions:
  - "[[Silhouette ᴷ]]"
.item: 
reference_desc:
  - You create a shadow play against a screen or wall. The surface can encompass up to 100 square feet. The number of creatures that can see the shadow play equals your Intelligence score. The shadowy figures make no sound but they can dance, run, move, kiss, fight, and so forth. Most of the figures are generic types—a rabbit, a dwarf— but a number of them equal to your Intelligence modifier can be recognizable as specific individuals.
reference_img: "![[silhouette.webp|384]]"
source: From **D&D 5e** "Deep Magic 2" book by **Kobold Press**
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