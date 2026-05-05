---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Transmutation
casting: 1 action
range: 30 ft.
components:
  - V
  - S
duration: Instantaneous
style:
  - Shadow
summary: Put out small light sources.
.effect:
gain_cantrip:
  - "[[Douse Light ᴷ]]"
list_actions:
  - "[[Douse Light ᴷ]]"
.item: 
reference_desc:
  - With a simple gesture, you can put out a single small source of light within range. This spell extinguishes a [[torch]], a [[candle]], a lantern, or a light or dancing lights cantrip.
reference_img: "![[douse-light.webp|384]]"
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