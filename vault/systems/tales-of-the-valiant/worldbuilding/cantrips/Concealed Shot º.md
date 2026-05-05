---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
  - "[[Primordial]]"
school: Illusion
casting: 1 action
range: Self
components:
  - S
  - M (a ranged weapon)
duration: Instantaneous
style:
  - Shadow
summary: Intraceable ranged shot.
.effect:
list_actions:
  - "[[Concealed Shot º]]"
.item: 
reference_desc:
  - As part of the action used to cast this spell, you must make an attack with a ranged weapon, otherwise the spell fails. The attack’s projectile is invisible while in flight, and the weapon itself is silent. If the weapon is a firearm, this spell suppresses the smoke and light the weapon produces, making it impossible to see or hear where the shot came from. <br/> <br/>
  - This spell only conceals the first shot you make; any additional shots aren’t concealed.
reference_img: "![[concealed-shot.webp|384]]"
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
|Make an `= this.summary`|
| --- |
[#css/tx/props/row]
```
`= join(this.reference_desc, " ")`

`= this.reference_img`
**Source**: *`= this.source`*