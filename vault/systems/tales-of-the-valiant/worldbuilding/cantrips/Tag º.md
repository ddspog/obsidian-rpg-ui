---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
school: Illusion
casting: 1 action
range: Touch
components:
  - S
  - M (a drop of paint)
duration: Instantaneous
style:
  - Rune
summary: Uncleanable message on 10-foot square surface.
.effect:
list_actions:
  - "[[Tag º]]"
.item: 
reference_desc:
  - You press your hand against a flat plane on an object and imprint an elaborate and vibrant image that can fit within a 10-foot square onto the surface. The image can contain a message up to three words in length, and can include art, caricatures, or identifying logos in any combination of colors, decided when you cast the spell. Nonmagical cleaning supplies can’t remove the image, which fades after seven days.
reference_img: "![[tag.webp|384]]"
source: From **D&D 5e** "Valda's Spire of Secrets" book by **Mage Hand Press**
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
|Inscribe `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*