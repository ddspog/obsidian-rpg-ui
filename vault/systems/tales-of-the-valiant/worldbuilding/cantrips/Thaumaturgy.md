---
.spell: 
circle: Cantrip
magic_source:
  - "[[Divine]]"
  - "[[Wyrd]]"
school: Transmutation
casting: 1 action
range: 30 feet
components:
  - V
duration: Up to 1 minute
summary: Harmless display of power.
.effect:
list_actions:
  - "[[Thaumaturgy]]"
.item: 
reference_desc:
  - "You manifest a minor wonder, a sign of supernatural power, within range. You create one of the following magical effects within range:<ul>"
  - "<li>Your voice booms up to three times as loud as normal for 1 minute."
  - "<li>You cause flames to flicker, brighten, dim, or change color for 1 minute."
  - "<li>You cause harmless tremors in the ground for 1 minute."
  - "<li>You create an instantaneous sound that originates from a point of your choice within range, such as a rumble of thunder, the cry of a raven, or ominous whispers."
  - "<li>You instantaneously cause an unlocked door or window to fly open or slam shut."
  - "<li>You alter the appearance of your eyes for 1 minute.</li></ul>"
  - "If you cast this spell multiple times, you can have up to three of its 1-minute effects active at a time, and you can dismiss such an effect as an action."
reference_img: "![[thaumaturgy.webp|384]]"
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