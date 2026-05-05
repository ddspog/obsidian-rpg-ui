---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Divine]]"
school: Evocation
casting: 1 action
range: Touch
components:
  - V
  - S
  - M (a firefly or phosphorescent moss)
duration: 1 hour
summary: Object emits bright light.
.effect: 
list_actions:
  - "[[012. Worldbuilding/Spells/Cantrips/Light|Light]]"
.item: 
reference_desc:
  - You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds [[bright light]] in a 20-foot radius and [[dim light]] for an additional 20 feet. The light can be colored as you like. Completely covering the object with something opaque blocks the light. The spell ends if you cast it again or dismiss it as an action.
  - If you target an object held or worn by a hostile creature, that creature must succeed on a DEX save to avoid the spell.
reference_img: "![[light.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
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