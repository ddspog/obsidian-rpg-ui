---
.spell: 
circle: Cantrip
magic_source:
  - "[[Arcane]]"
school: Enchantment
casting: 1 action
range: Self
components:
  - S
duration: 4 hours
style:
  - Shadow
summary: Share memories on a thought strand.
.effect:
list_actions:
  - "[[Encode Thoughts º]]"
.item: 
reference_desc:
  - Putting a finger to your head, you pull a memory, idea, or message from your mind and transform it into a tangible string of glowing energy called a thought strand, which persists for the duration or until you cast this spell again to create a new thought strand. The thought strand appears in an unoccupied space within 5 ft of you as a Tiny, weightless, semi-solid object that can be held and carried like a ribbon. It is otherwise stationary. <br/> <br/>
  - If you cast this spell while concentrating on a spell or an ability that allows you to read or manipulate the thoughts of others (such as the Detect Thoughts or Modify Memory spells), you can transform the thoughts or memories you read, rather than your own, into a thought strand. Over the course of 1 minute, a creature can concentrate on the thought strand (as if they were concentrating on a spell) and see the memory, idea, or message as if they had experienced it themselves, at which point, the strand is consumed by the creature. Casting the Detect Thoughts spell on the strand has the same effect without consuming the strand. <br/> <br/>
  - "**At Higher Levels**: Starting at 5th level, the duration for this spell increases to 8 hours. At 11th level, the spell's duration increases to 24 hours. At 17th level, the spell's duration increases to Until Dispelled"
reference_img: "![[encode-thoughts.webp|384]]"
source: From **D&D 5e** "Reworked Cantrips" book by **FJFSOM656 at [D&D Beyond]((https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/110268-cantrip-rework-encode-thoughts))**
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