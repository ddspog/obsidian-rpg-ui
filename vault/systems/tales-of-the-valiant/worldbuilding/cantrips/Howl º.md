---
.spell: 
circle: Cantrip
magic_source:
  - "[[Primordial]]"
school: Transmutation
casting: 1 action
range: Self
components:
  - V
duration: 1 round
style:
  - Rune
summary: Long-range communication with a beast.
.effect:
list_actions:
  - "[[Howl º]]"
.item: 
reference_desc:
  - "You utter a bestial, magically-augmented howl that can be heard for 1000 feet. The howl can manifest as any animal call you’ve heard, such as the screech of a hawk or trumpet of an elephant. Choose one creature with whom you are familiar as the recipient: if it can hear your howl, it understands your meaning and can respond in a likewise manner. <br/> <br/>"
  - Creatures other than your recipient that hear the howl and that are under the effects of the comprehend languages spell or similar magic, or that can understand beasts, can understand the howl’s meaning. Otherwise, the howl is unintelligible to creatures that can hear it.
reference_img: "![[howl.webp|384]]"
source: From **D&D 5e** "Heliana's Guide to Monster Hunting" book by **Hitpoint Press**
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
|Make `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*