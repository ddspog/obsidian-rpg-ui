---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
  - "[[Primordial]]"
  - "[[Wyrd]]"
school: Conjuration
casting: 1 action
range: 60 ft.
components:
  - V
  - S
duration: Concentration, up to 1 minute
style:
  - Dragon
summary: Make a bonfire on the ground.
.effect: 
list_actions:
  - "[[Create Bonfire ᴰ]]"
.item: 
reference_desc:
  - You create a bonfire on ground that you can see within range. Until the spell ends, the magic bonfire fills a 5-foot cube. Any creature in the bonfire’s space when you cast the spell must succeed on a Dexterity saving throw or take 1d8 fire damage. A creature must also make the saving throw when it moves into the bonfire’s space for the first time on a turn or ends its turn there.<br/><br/>  
  - The bonfire ignites flammable objects in its area that aren’t being worn or carried.<br/><br/>
  - "**At Higher Levels**. The spell’s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8)."
reference_img: "![[create-bonfire.webp|384]]"
source: From **D&D 5e** "Elemental Evil Player's Companion" book by **D&D Beyond**
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