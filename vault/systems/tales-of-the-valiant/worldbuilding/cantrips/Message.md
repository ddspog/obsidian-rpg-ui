---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Enchantment
casting: 1 action
range: 120 ft.
components:
  - V
  - S
  - M (a short piece of copper wire)
duration: 1 round
style:
  - Dream
summary: Only target hears your whisper.
.effect:
list_actions:
  - "[[Message]]"
.item: 
reference_desc:
  - You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear.  <br/> <br/>
  - You can cast this spell through solid objects if you are familiar with the target and know it is beyond the barrier. Magical silence, 1 foot of stone, 1 inch of common metal, a thin sheet of lead, or 3 feet of wood blocks the spell. The spell doesn’t have to follow a straight line and can travel freely around corners or through openings.
reference_img: "![[message.webp|384]]"
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