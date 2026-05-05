---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Illusion
casting: 1 action
range: 30 ft.
components:
  - S
  - M (a bit of fleece)
duration: 1 minute
style:
  - Shadow
summary: Small illusory sound or image.
.effect:
list_actions:
  - "[[Minor Illusion]]"
.item: 
reference_desc:
  - You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.  <br/> <br/>
  - If you create a sound, its volume can range from a whisper to a scream. It can be your voice, someone else’s voice, a lion’s roar, a beating of drums, or any other sound you choose. The sound continues unabated throughout the duration, or you can make discrete sounds at different times before the spell ends.  <br/> <br/>
  - If you create an image of an object, such as a chair, muddy footprints, or a small chest, it must be no larger than a 5-foot cube. The image can’t create sound, light, smell, or any other sensory effect.  <br/> <br/>
  - Physical interaction with the image reveals it to be an illusion because things can pass through it. <br/> <br/>
  - If a creature uses its action to examine the sound or image, the creature can determine that it is an illusion with a successful INT ([[Investigation]]) check against your spell save DC. If a creature discerns the illusion for what it is, the illusion becomes faint to the creature.
reference_img: "![[minor-illusion.webp|384]]"
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
|Draw a `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*