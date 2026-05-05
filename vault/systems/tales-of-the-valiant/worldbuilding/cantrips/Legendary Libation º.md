---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Divine]]"
  - "[[Primordial]]"
school: Conjuration
casting: 1 bonus action
range: Self
components:
  - V
  - M (a container, such as a mug, tankard, or flask, which is filled with liquid that is purified by the spell)
duration: Instantaneous
style:
  - Dream
summary: Drink that gives courage.
.effect:
list_bonus_actions:
  - "[[Legendary Libation º]]"
.item: 
reference_desc:
  - You speak a word of power and your container fills with a drink of your choosing, which can be imbibed as an action. The drink is delicious and satisfies the drinker’s thirst for the next 24 hours. Furthermore, for one hour after consuming this libation, the drinker has advantage on saving throws it makes to avoid or end the [[frightened]] condition on itself. If the drink is not consumed within one hour of being conjured, it loses its magic and turns into mundane, flavorless water. <br/> <br/>
  - A creature can’t benefit from more than one legendary libation in any given 24-hour period.
reference_img: "![[legendary-libation.webp|384]]"
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
|Make a `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*