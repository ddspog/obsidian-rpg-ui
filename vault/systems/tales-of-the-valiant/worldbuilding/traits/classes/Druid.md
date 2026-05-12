---
.metadata: 
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Druid
![[druid.webp|right|384]] Druids are the guardians and warriors of the natural world. All druids feel a deep affinity for the environment, whether it manifests as a spiritual connection to the beasts of the land, the plants of the earth, or the elemental energies that keep all things in balance. 

Druid is a class that interacts with the environment often. Your class is a “pure” spellcasting class, but your Wild Shape feature gives you some ability to mix it up. Lean into exploration with your various spells and capabilities.
## Druids as Adventurers
Druids are exceptional explorers and warriors. They hold an impressive range of magical abilities that allow them to heal allies, gather information, and invoke nature’s wrath. 

While druids regularly confront threats in the wild, their passions often clash with the values and ambitions of the civilized world. Few understand the awesome and often devastating forces of nature—and even fewer understand those who place nature’s interests above their own.
## Class Features
As a druid, you have the following class features. 
```rpg feature.details
name: Hit Points
text: |
  **Hit Dice:** 1d8 per druid level
  **Hit Points at 1st Level:** 8 + your CON modifier
  **Hit Points at Higher Levels:** 1d8 (or 5) + your CON modifier per druid level after 1st
traits:
  HP: "+8 +CON mod +[LV - 1][CON mod + 1d8]"
  Hit Dice: 1d8
```
```rpg feature.details
name: Proficiencies
text: |
  **Armor:** [[Light Armor]], [[Medium Armor]], and [[Shields]]
  **Weapons:** [[Simple]] weapons
  **Tools:** [[012. Worldbuilding/Items/Tools/Herbalist Tools|Herbalist Tools]]
  **Saves:** INT, WIS
  **Skills:** Choose two from [[Animal Handling]], [[systems/tales-of-the-valiant/glossary/skills/Arcana|Arcana]], [[Insight]], [[Medicine]], [[Nature]], [[Perception]], [[Religion]], and [[Survival]]
traits:
  Armor:
    - [[Light Armor]]
    - [[Medium Armor]]
    - [[Shields]]
  Weapons:
    - [[Simple]]
  Save P.:
    - INT
    - WIS
  Tools:
    - [[Herbalist Tools]]
choose:
  type: traits
  category: "Skill P."
  number: 2
  options:
    - [[Animal Handling]]
    - [[systems/tales-of-the-valiant/glossary/skills/Arcana|Arcana]]
    - [[Insight]]
    - [[Medicine]]
    - [[Nature]]
    - [[Perception]]
    - [[Religion]]
    - [[Survival]]
```
### Starting Equipment
You start with the following equipment, in addition to the equipment granted by your background: 
- (_a_) a [[Shield]] or (_b_) any [[Simple]] weapon
- (_a_) a [[012. Worldbuilding/Items/Weapons/Sickle]] or (_b_) any [[Simple]] [[Melee]] weapon
- [[Leather 1]] armor, an explorer's pack, and a [[Druidic Focus]]
```rpg table.progression
| DRUID PROGRESSION  |||||| PRIMORDIAL SPELL SLOTS BY CIRCLE      |||||||||
|LEVEL|PB|BEAST FORMS KNOWN|FEATURES|CANTRIPS KNOWN|RITUALS KNOWN|1ST|2ND|3RD|4TH|5TH|6TH|7TH|8TH|9TH|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1st|+2|__|Druidic, Nature's Gift,Spellcasting|3|1|2|—|—|—|—|—|—|—|—|
|2nd|+2|2|Wild Shape: Beast Form, Wild Shape: Draw Power (1/Rest)|3|1|3|—|—|—|—|—|—|—|—|
|3rd|+2|2|Druid Subclass|3|2|4|2|—|—|—|—|—|—|—|
|4th|+2|2|Improvement|4|2|4|3|—|—|—|—|—|—|—|
|5th|+3|3|Improved Beast Form (CR 1/2)|4|3|4|3|2|—|—|—|—|—|—|
|6th|+3|3|Wild Shape (2/Rest)|4|3|4|3|3|—|—|—|—|—|—|
|7th|+3|3|Subclass Feature|4|4|4|3|3|1|—|—|—|—|—|
|8th|+3|3|Improvement|4|4|4|3|3|2|—|—|—|—|—|
|9th|+4|4|Improved Beast Form (CR 1)|4|5|4|3|3|3|1|—|—|—|—|
|10th|+4|4|Heroic Boon|5|5|4|3|3|3|2|—|—|—|—|
|11th|+4|4|Subclass Feature|5|6|4|3|3|3|2|1|—|—|—|
|12th|+4|4|Improvement|5|6|4|3|3|3|2|1|—|—|—|
|13th|+5|5|Wild Shape (3/Rest)|5|7|4|3|3|3|2|1|1|—|—|
|14th|+5|5|Improved Beast Form (CR 2)|5|7|4|3|3|3|2|1|1|—|—|
|15th|+5|5|Subclass Feature|5|8|4|3|3|3|2|1|1|1|—|
|16th|+5|5|Improvement|5|8|4|3|3|3|2|1|1|1|—|
|17th|+6|6|Nature's Grace|5|9|4|3|3|3|2|1|1|1|1|
|18th|+6|6|Wild Shape (4/Rest)|5|9|4|3|3|3|3|1|1|1|1|
|19th|+6|6|Improvement|5|9|4|3|3|3|3|2|1|1|1|
|20th|+6|6|Epic Boon|5|9|4|3|3|3|3|2|2|1|1|
[#css/tx/table #css/tx/s/wide]
```
```rpg feature.details
name: Spellcasting
subtitle: "1st-Level Druid Feature"
level: 1
text: |
  As a conduit for divine power, you can cast Primordial spells. See [[07. Spellcasting]] for general rules of spellcasting and the [[Primordial]] spell list. 
  #### Cantrips 
  At 1st level, choose three cantrips from the Primordial spell list to learn. You choose more Primordial cantrips to learn at higher levels, as shown in the Cantrips Known column of the **Druid Progression** table.
  #### Preparing Spells 
  You must prepare spells in advance before you can cast them. You can prepare any spell on the [[Primordial]] spell list from circles for which you have Primordial spell slots. (You determine which spell slots you can access by checking your level on the **Druid Progression** table). You can choose a number of spells equal to your WIS modifier + your druid level (minimum of one spell). This is your list of prepared spells from which you can cast. 

  Preparing a new list of spells requires time spent in prayer and meditation: at least 1 minute per spell circle for each spell you change. You can change your list of prepared spells as part of a long rest.
  #### Casting Spells 
  You have prepared a number of spells and can cast any of them by using a Primordial spell slot of the spell’s circle or higher. 

  The **Druid Progression** table shows how many Primordial spell slots you have per day at a given level. For example, at 3rd level, you have four 1st-circle and two 2nd-circle spell slots, and with a 16 WIS, you can have six prepared spells of 1st or 2nd circle, in any combination. You only have two spell slots for 2nd-circle spells though, so if you prepare only 2nd-circle spells, you won’t be able to use your 1st-circle spell slots at all. 

  Casting a spell doesn’t remove it from your list of prepared spells, it just uses up a spell slot. You regain all used spell slots when you finish a long rest.
  #### Spellcasting Ability 
  Wisdom (WIS) is your spellcasting ability. Your WIS modifier determines the save DC and the attack modifier for certain spells you cast: 
  - **Spell save DC** = 8 + your proficiency bonus (PB) + your WIS modifier 
  - **Spell attack modifier** = your proficiency bonus (PB) + your WIS modifier
  #### Rituals 
  You can also cast a type of long-form spell called a ritual. Rituals don’t need to be prepared, and they don’t use up spell slots.  

  At 1st level, choose one ritual from the [[07. Spellcasting#Primordial Ritual List|Primordial Ritual List]]. You learn more rituals at higher levels, as shown in the Rituals Known column of the **Druid Progression** table, but only from a circle for which you have spell slots. Rituals you learn don't count against the number of spells you learn at each level.
  #### Spellcasting Focus 
  You can use a druidic focus (see **Adventuring Gear** in **Chapter 5**) as a spellcasting focus for your Primordial spells.
spellcasting:
  ability: WIS
  type: prepared
  tier: full
  pool: "[[Primordial]]"
  cantrips: 3
  rituals: 1
  prepared_max: "WIS_MOD + LV"
traits:
  Spellcasting: "WIS [[Primordial]]: Prepared Full-Caster"
```
```rpg feature.level
level: 3
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 4
spellcasting:
  cantrips: 1
```
```rpg feature.level
level: 5
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 7
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 9
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 10
spellcasting:
  cantrips: 1
```
```rpg feature.level
level: 11
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 13
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 15
spellcasting:
  rituals: 1
```
```rpg feature.level
level: 17
spellcasting:
  rituals: 1
```
>[!rules] DRUID QUICK BUILD  
>To quickly create a druid, follow these steps during character creation: 
>- For ability scores, prioritize WIS and then either CON.
>- For lineage and heritage, choose any combination you like. 
>- For background and talent, choose Homesteader and Aware. 
>- For spells, choose the _druidcraft_, _produce flame_, and _shillelagh_ cantrips. Then prepare your 1st-circle Primordial spells (choose a number of the following spells equal to your WIS modifier + 1): _burning hands_, _entangle_, _fire under the tongue_, [[Goodberry]], and _speak with animals_. Finally, choose your 1st-circle ritual: _purify food and drink_.
```rpg feature.details
name: Druidic
subtitle: 1st-Level Druid Feature
level: 1
text: |
  You know Druidic, the secret language of druids. You can speak the language and use a system of natural elements to leave hidden messages that only other druids will understand. You and others who know this language automatically spot such a message. Others spot the message’s presence with a successful WIS ([[Perception]]) check but can’t decipher it without magic.
action:
  text: |
    You can use a system of natural elements to leave hidden messages that only other druids will understand. You and others who know [[Druidic]] automatically spot such a message. Others spot the message’s presence with a successful WIS ([[Perception]]) check but can’t decipher it without magic.
traits:
  Languages: [[Druidic]]
```
>[!rules] DRUIDIC SIGNS AND SYMBOLS
>Druidic makes use of hidden signs to communicate messages.
```rpg feature.details
name: Nature's Gift
subtitle: 1st-Level Druid Feature
level: 1
text: |
  You have learned to harness the ambient energy of nature and can redirect that energy to encourage growth and healing. As a bonus action, choose one creature within 5 feet of you (this can be you). When you do so, roll a number of d4s equal to your PB (minimum of 2d4). That creature regains hit points equal to the total rolled. This feature has no effect on Constructs or Undead. 

  You can use this feature a number of times per day equal to your PB. You recover expended uses when you complete a long rest.
bonus:
  max: PB
  recharge: on long rest
  text: |
    You have learned to harness the ambient energy of nature and can redirect that energy to encourage growth and healing. As a bonus action, choose one creature within 5 feet of you (this can be you). When you do so, roll a number of d4s equal to your PB (minimum of 2d4). That creature regains hit points equal to the total rolled. This feature has no effect on Constructs or Undead. 
roll:
  form: healing
  range: 5 ft.
  damage:
    roll: 2d4
    type: healing
  notes: roll PB d4s (min 2d4); no effect on Constructs/Undead
  cost:
    type: pb-pool
    amount: 1
  leveled:
    by: class
    at:
      5:  { damage: { roll: 3d4, type: healing } }
      9:  { damage: { roll: 4d4, type: healing } }
      13: { damage: { roll: 5d4, type: healing } }
      17: { damage: { roll: 6d4, type: healing } }
```
>[!rules] PLAYER'S ADVICE
>Nature’s Gift is not a spell, which means a druid can use it even while transformed by their Wild Shape class feature.
```rpg feature.details
name: Wild Shap
subtitle: "2nd, 6th, 13th, and 18th-Level Druid Feature"
level: 2
text: |
  You gain the ability to channel energy directly from nature to produce effects beyond spells. You start with two effects: Beast Form and Draw Power. Some subclasses grant additional effects as you advance in levels, as noted in their descriptions (see **Druid Subclasses**). 

  When you use your Wild Shape feature, simply choose which specific effect you want, such as Beast Form. Some of these effects require a save, and in those cases, the DC is equal to your druid spell save DC. 

  Beginning at 2nd level, you can use your Wild Shape feature once until you finish a short or long rest, then twice between rests at 6th level, three times at 13th level, and four times at 18th level. When you finish a short or long rest, you regain all expended uses.
  #### Wild Shape: Beast Form
  As an action, you can magically assume the form of a Beast. When you first gain this feature, choose two Beasts of challenge rating (CR) 1/4 or less as your known forms. To select a known form, you must have seen or interacted with a Beast in your past. For example, a druid that hails from a desert environment is unlikely to be familiar enough with a sea-dwelling creature like a dolphin to select it as a known form. The Beast you choose can’t have any legendary actions or lair actions. See **Appendix C: Creature Statistics** for a selection of suitable Beasts to choose from. 

  As you advance in druid levels, you can choose more beast forms as shown in the Beast Forms Known column of the **Druid Progression** table. 

  When you gain a level of druid, you can replace one known form with a different form of your choosing. Any new form you choose must abide by the form restrictions. [^1]
  ![[Transformation|no-title clean]]
  #### Wild Shape: Draw Power
  As a bonus action, you can reshape the natural energies around you to draw them within yourself and recharge your spellcasting ability. When you do so, choose a single expended Primordial spell slot to recover. The recovered spell slot must be of a circle equal to or less than your proficiency bonus (PB). For example, a 5th-level druid with a PB of +3 could recover an expended 1st, 2nd, or 3rd-circle Primordial spell slot with this feature. 

  You can’t use Draw Power while transformed by the Beast Form effect of your Wild Shape feature, even if you have multiple uses of Wild Shape available to expend.
resource:
  name: Wild Shape
  text: |
    You gain the ability to channel energy directly from nature to produce effects beyond spells. When you use your Wild Shape feature, simply choose which specific effect you want, such as Beast Form. Some of these effects require a save, and in those cases, the DC is equal to your druid spell save DC.
  max:
    2: 1
    6: 2
    13: 3
    18: 4
  recovery: on short or long rest
action:
  name: Beast Form
  resource: Wild Shape
  text: |
    As an action, you can magically assume the form of a Beast (see [[Transformation]] rules). When you first gain this feature, choose two Beasts of challenge rating (CR) {{ leveled { 2: 1/4, 9: 1, 14: 2 } }} or less as your known forms. To select a known form, you must have seen or interacted with a Beast in your past. The Beast you choose can’t have any legendary actions or lair actions.

    When you gain a level of druid, you can replace one known form with a different form of your choosing. Any new form you choose must abide by the form restrictions. [^1]
choose:
  type: traits
  category: "Known Forms"
  number:
    2: 2
    5: 3
    9: 4
    13: 5
    17: 6
  options:
    - "@worldbuilding/druid-shapes"
bonus:
  name: Draw Power
  resource: Wild Shape
  text: |
    As a bonus action, you can reshape the natural energies around you to draw them within yourself and recharge your spellcasting ability. When you do so, choose a single expended Primordial spell slot to recover. The recovered spell slot must be of a circle equal to or less than your proficiency bonus (PB). For example, a 5th-level druid with a PB of +3 could recover an expended 1st, 2nd, or 3rd-circle Primordial spell slot with this feature. 

    You can’t use Draw Power while transformed by the Beast Form effect of your Wild Shape feature, even if you have multiple uses of Wild Shape available to expend.
```
```rpg feature.details
name: Amalgam
subtitle: "2nd-Level Optional Druid Feature [^2]"
level: 2
type: active
text: |
  When you long rest, you can switch one of you Known Forms for another. Whenever you're choosing a new Known Form for you Beast Form feature, choose any beast with a CR at least one level lower than the maximum available to you and increase its CR to the highest available for you.

  For each level up in CR level, do the following:
  - Gain one trait from the list below. See [[02ª. Wintercoat's Guide to Wild Shapes#Amalgam Trait List|Amalgam Traits]] for more details.
    - **Ability Score Improvement.** Increase your Dexterity, Constitution, and Strength scores.
    - **Environmental Adaptation.** Gain a special movement or adaptation from a list, like flying speed and underwater breathing.
    - **Growth.** Grow the beast by one size, increasing its hit points and damage potential.
    - **Heightened Senses.** Gain one special sense from the list, like Tremorsense or Darkvision.
    - **Precision.** Substitute the beast's proficiency bonus for your own, improving attacks, skill checks, and saving throws.
    - **Skilled.** Gain proficiency in two skills of your choice from a list.
    - **New Natural Weapon.** Gain a new natural weapon.
    - **Beast Styles.** Choose between multiple attacks, one powerful attack or defense. At CR 1, gain the Multiattack or the *Hardhitter* feature. At higher CRs, you can choose an extra feature or improve an existing one.
    - **Fighting Trait.** When you choose this, you gain or change a basic or advanced trait according to your CR. These can be a poisonous bite, a charge attack, or the flyby ability.
  - Gain an additional ability score improvement at CR 1/8, 1/4, 1 and 2.
```
### Druid Subclass
_3rd, 7th, 11th, and 15th-Level Druid Feature_ 

Choose a subclass that reflects your values and magical practices, either Leaf or Shifter (detailed at the end of this class). Your choice grants you spells and other features at 3rd, 7th, 11th, and 15th level.
#### Ring Spells 
Each subclass has a list of ring spells that you can access as soon as you can cast spells of that circle (as shown on the **Druid Progression** table). Once you gain such a spell, you always have it prepared, and it doesn’t count against the number of spells you can prepare. However, casting a ring spell still expends a Primordial spell slot as normal. 

If one of these spells isn’t on the [[Primordial]] spell list, it still counts as a Primordial spell for you.
```rpg feature.details
name: Improvement
subtitle: "4th, 8th, 12th, 16th, and 19th-Level Druid Feature"
level:
  - 4
  - 8
  - 12
  - 16
  - 19
pick: 1
text: |
  Choose one of the following improvements (ability scores can't be raised above 20 with this feature):
```
```rpg feature.choice
parent: Improvement
name: Ability Score Boost
text: |
  - Increase a single ability score by 2.
choose:
  type: asi
  number: 1
  quantity: 2
```
```rpg feature.choice
parent: Improvement
name: Balanced Growth
text: |
  - Increase two different ability scores by 1 each.
choose:
  type: asi
  number: 2
  quantity: 1
```
```rpg feature.choice
parent: Improvement
name: Talented Growth
text: |
  - Increase one ability score by 1 and select a talent from the magic talents list (see **Magic Talents** in **Chapter 4**).
choose:
  - type: asi
    number: 1
    quantity: 1
  - type: talent
    number: 1
    options:
      - "@worldbuilding/traits/talents/magic"
```
### Improved Beast Form
_5th, 9th, and 14th-Level Druid Feature_ 

You can now use the Beast Form effect of your Wild Shape feature to assume more powerful beast forms. When you learn a new form, you can choose a Beast of CR 1/2 or less. 

At 9th level, you can assume the form of any Beast of CR 1 or less. At 14th level, you can assume the form of any Beast of CR 2 or less.
```rpg feature.details
name: Heroic Boon
subtitle: "10th-Level Druid Feature"
level: 10
pick: 1
text: |
  Your commitment to the druid’s path grants you a powerful new ability. Choose one of the following heroic boons: 
```
```rpg feature.choice
parent: Heroic Boon
name: Kingdom
text: |
  - **Rite of the Kingdom.** All Beasts and creatures with the Animal tag understand your speech, and you can understand their noises and motions as if they were speaking, even if they don't speak a language. This ability doesn’t grant Beasts the intelligence to understand or communicate complex concepts, but you can share basic information with ease. Your GM has final say on what a particular creature can express. In addition, you have advantage on Charisma checks made to interact with or influence such creatures. 
passive:
  text: All Beasts and creatures with the Animal tag understand your speech, and you can understand their noises and motions as if they were speaking, even if they don't speak a language. This ability doesn’t grant Beasts the intelligence to understand or communicate complex concepts, but you can share basic information with ease. Your GM has final say on what a particular creature can express. In addition, you have advantage on Charisma checks made to interact with or influence such creatures.
```
```rpg feature.choice
parent: Heroic Boon
name: Shaper
text: |
  - **Rite of the Shaper.** When you roll initiative and have no remaining uses of Wild Shape, you regain one use. Once you use this feature, you can’t do so again until you complete a long rest.
active:
  text: When you roll initiative and have no remaining uses of Wild Shape, you regain one use. Once you use this feature, you can’t do so again until you complete a long rest.
  recharge: on long rest
```
```rpg feature.details
name: Nature's Grace
subtitle: "17th-Level Druid Feature"
level: 17
type: passive
text: |
  Your attunement to the natural energies of the world infuses your body, sustaining you and protecting you from unnatural harm. You gain the following benefits: 
  - You can’t be magically aged, and you suffer none of the frailty of old age. You can still die of old age though. 
  - You no longer need food or water to survive. 
  - Your ability scores and hit point maximum can’t be lowered by any means short of a _wish_ spell.
```
```rpg feature.details
name: Epic Boon
subtitle: "20th-Level Druid Feature"
level: 20
text: |
  Your commitment to the druid’s path grants you a powerful new ability. You gain the following epic boon: 
```
```rpg feature.choice
parent: Epic Boon
name: Archdruid
text: |
  - **Archdruid.** You can use the Beast Form effect of your Wild Shape feature an unlimited number of times. In addition, you can ignore the verbal and somatic components of Primordial spells, as well as any material components that lack a cost.
passive:
  text: |
    You can use the Beast Form effect of your Wild Shape feature an unlimited number of times. In addition, you can ignore the verbal and somatic components of Primordial spells, as well as any material components that lack a cost.
```
## Druid Subclasses
While all druids revere nature, subclasses represent the specific ways druids best commune with the primordial forces of the world. The subclass you choose represents the rites, traditions, and mysteries you embrace in your quest to better understand the awesome powers of nature.
### Leaf
![[Leaf|no-t clean hide-ll]]
### Shifter
![[Shifter|clean no-t hide-ll]]


[^1]: Homebrew rule inspired from **D&D** _Wintercoat's Guide to Wild Shapes_ book by **The Two Dicey Bards**.

[^2]: From **D&D** _"Wintercoat's Guide to Wild Shape"_ from **Two Dicey Bards**.
