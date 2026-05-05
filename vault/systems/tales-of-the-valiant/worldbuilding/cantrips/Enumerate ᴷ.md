---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
school: Divination
casting: 1 action
range: 30 ft.
components:
  - V
duration: Instantaneous
style:
  - Rune
summary: Count anything with magic.
.effect:
list_actions:
  - "[[Enumerate ᴷ]]"
.item: 
reference_desc:
  - You are able to divine the exact amount of a number of like objects in a 10-foot-cube centered on a point within range. You can be general (“How many coins in this chest?”) or specific (“How many silver coins in this chest?”) but can receive only one number as a response from the casting of this spell. If, for example, you want to know the number of coins of each denomination in a chest, you must cast the spell anew for each type of coin to be counted (copper, silver, gold, and so forth).
reference_img: "![[enumerate.webp|384]]"
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