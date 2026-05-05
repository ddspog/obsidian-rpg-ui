---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Conjuration
casting: 1 action
range: 30 ft.
components:
  - V
  - S
duration: 1 minute
summary: Magical hand for simple tasks.
.effect:
list_actions:
  - "[[Mage Hand]]"
.item: 
reference_desc:
  - A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an action. The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again.  <br/> <br/>
  - You can use your action to control the hand. You can use the hand to manipulate an object, open an unlocked door or container, stow or retrieve an item from an open container, or pour the contents out of a vial. You can move the hand up to 30 feet each time you use it.  <br/> <br/>
  - The hand can’t attack, activate magic items, or carry more than 10 pounds.
reference_img: "![[mage-hand.webp|384]]"
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
|You conjure a `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*