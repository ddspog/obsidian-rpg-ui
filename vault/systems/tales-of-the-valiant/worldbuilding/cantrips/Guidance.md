---
.spell: 
circle: Cantrip
magic_source:
  - "[[Divine]]"
  - "[[Wyrd]]"
school: Divination
casting: 1 action
range: Touch
components:
  - V
  - S
duration: Concentration, 1 minute
style:
  - Dream
summary: Adds d4 to ally ability check.
.effect:
list_actions:
  - "[[Guidance]]"
.item: 
reference_desc:
  - You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. It can roll the die before or after making the ability check. The spell then ends.
reference_img: "![[guidance.webp|384]]"
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