---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Divine]]"
school: Conjuration
casting: 1 reaction, taken at the start of your turn
range: Self
components:
  - V
  - S
duration: 1 minute
style:
  - Portal
summary: Conjured weapon or shield.
.effect:
list_reactions:
  - "[[Conjure Arms º]]"
.item: 
reference_desc:
  - Until the end of your turn, when you would be able to draw a weapon or shield, you can instead conjure an object of that form into your hand(s) as if you'd drawn it. You cannot create items of value greater than 50 gp in total. If you conjure a shield, you can choose to have it appear already equipped to you. <br/> <br/>
  - Equipment made by this spell is slightly translucent and obviously conjured, and is no sturdier than equipment of low quality, but otherwise functions the same as any nonmagical version for the duration. Though they are conjured by magic, they are not magical. If the spell ends, you cast the spell again, or you do not hold the equipment for an entire round, the conjured equipment instantly vanishes. <br/> <br/>
  - When you reach 5th level this spell's duration increases to 10 minutes. It increases to 1 hour at 11th level and it increases to 8 hours at 17th level.
reference_img: "![[conjure-arms.webp|384]]"
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
|Draw a `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*