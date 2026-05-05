---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
school: Transmutation
casting: 1 bonus action
range: Self
components:
  - V
duration: 1 round
style:
  - Rune
summary: Boost your speed a bit.
.effect:
list_bonus_actions:
  - "[[Quickstep º]]"
.item: 
reference_desc:
  - You call upon your inner reserves to give you a brief flash of speed. When you cast this spell, your walking speed increases by 10 feet until the start of your next turn.
reference_img: "![[quickstep.webp|384]]"
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
|`= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*