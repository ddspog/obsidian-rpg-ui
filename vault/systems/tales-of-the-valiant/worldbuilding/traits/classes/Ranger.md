---
.metadata: 
cssclasses:
  - note-feature
---
# Ranger
![[ranger.webp|right|384]]Rangers are unparalleled explorers with a mystical connection to the natural world. A combination of martial prowess, spellcasting, and supernatural awareness ensures rangers excel as scouts, trackers, and hunters. Few classes prove as deadly as a ranger once their quarry is within sight. 

Ranger is a class that blends features from multiple classes and has plenty of opportunity for customization. Your class features lend themselves to creating a skirmisher, archer, or warrior focused on high-utility magic. 
## Rangers as Adventurers
Rangers are born adventurers. No class is better suited to surviving the rigors of the wild than a ranger, and their excellent survival skills are often the difference between life and death for adventuring parties far from civilization. 

While rangers shine outside of combat, they also possess an impressive array of martial abilities. They might lack the brawn of fighters or full spellcasting abilities of druids, but they make up for it with excellent damage output and mobility. 
## Class Features
As a ranger, you have the following class features. 
```rpg feature.details
name: Hit Points
text: |
  **Hit Dice:** 1d10 per ranger level
  **Hit Points at 1st Level:** 10 + your CON modifier
  **Hit Points at Higher Levels:** 1d10 (or 6) + your CON modifier per ranger level after 1st
traits:
  HP: "+10 +CON mod +[LV - 1][CON mod + 1d10]"
  Hit Dice: 1d10
```
```rpg feature.details
name: Proficiencies
text: |
  **Armor:** [[Light Armor]], [[Medium Armor]], and [[Shields]]
  **Weapons:** [[Simple]] weapons, [[Martial]] weapons
  **Tools:** Your choice of [[Herbalist Tools]], [[Navigator Tools]], or Trapper Tools
  **Saves:** STR, DEX
  **Skills:** Choose three from [[Animal Handling]], [[Athletics]], [[Insight]], [[Investigation]], [[Nature]], [[Perception]], [[Stealth]], and [[Survival]]
traits:
  Armor:
    - [[Light Armor]]
    - [[Medium Armor]]
    - [[Shields]]
  Weapons:
    - [[Simple]]
    - [[Martial]]
  Save P.:
    - STR
    - DEX
choose:
  - type: traits
    category: "Tools"
    number: 1
    options:
      - [[Herbalist Tools]]
      - [[Navigator Tools]]
  - type: traits
    category: "Skill P."
    number: 3
    options:
      - [[Animal Handling]]
      - [[Athletics]]
      - [[Insight]]
      - [[Investigation]]
      - [[Nature]]
      - [[Perception]]
      - [[Stealth]]
      - [[Survival]]
```
### Starting Equipment
You start with the following equipment, in addition to the equipment granted by your background: 
- _(a)_ scale mail or _(b)_ [[Leather 1]] armor 
- _(a)_ two [[Shortsword]] or _(b)_ two [[Simple]] weapons 
- _(a)_ a dungeoneer's pack or _(b)_ an explorer's pack 
- A [[Longbow]] and [[Quiver]] of 20 [[Arrows]] 
```rpg table.progression
| RANGER PROGRESSION  ||| PRIMORDIAL SPELL SLOTS BY CIRCLE      ||||||
| LEVEL | PB | FEATURES | SPELLS KNOWN | 1ST | 2ND | 3RD | 4TH | 5TH |
| --------- | --- | --- | ------------ | --- | --- | --- | --- | --- |
| 1st | +2 | Explorer, Mystic Mark            | —                | —       | —       | —       | —       | —       |
| 2nd | +2 | Martial Action, Spellcasting     | 2                | 2       | —       | —       | —       | —       |
| 3rd | +2 | Ranger Subclass                  | 3                | 3       | —       | —       | —       | —       |
| 4th                | +2                               | Improvement                      | 3                | 3       | —       | —       | —       | —       |
| 5th                | +3                               | Multiattack (2/Attack Action)    | 4                | 4       | 2       | —       | —       | —       |
| 6th                | +3                               | Empowered Mark, [[Mystic Mark]] (d6) | 4                | 4       | 2       | —       | —       | —       |
| 7th                | +3                               | Subclass Feature                 | 5                | 4       | 3       | —       | —       | —       |
| 8th                | +3                               | Improvement                      | 5                | 4       | 3       | —       | —       | —       |
| 9th                | +4                               | Stalker’s Step                   | 6                | 4       | 3       | 2       | —       | —       |
| 10th               | +4                               | Heroic Boon                      | 6                | 4       | 3       | 2       | —       | —       |
| 11th               | +4                               | Subclass Feature                 | 7                | 4       | 3       | 3       | —       | —       |
| 12th               | +4                               | Improvement                      | 7                | 4       | 3       | 3       | —       | —       |
| 13th               | +5                               | [[Mystic Mark]] (d8)                 | 8                | 4       | 3       | 3       | 1       | —       |
| 14th               | +5                               | Keensense                        | 8                | 4       | 3       | 3       | 1       | —       |
| 15th               | +5                               | Subclass Feature                 | 9                | 4       | 3       | 3       | 2       | —       |
| 16th               | +5                               | Improvement                      | 9                | 4       | 3       | 3       | 2       | —       |
| 17th               | +6                               | [[Mystic Mark]] (d10)                | 10               | 4       | 3       | 3       | 3       | 1       |
| 18th               | +6                               | Strider                          | 10               | 4       | 3       | 3       | 3       | 1       |
| 19th               | +6                               | Improvement                      | 11               | 4       | 3       | 3       | 3       | 2       |
| 20th               | +6                               | Epic Boon                        | 11               | 4       | 3       | 3       | 3       | 2       |
[#css/tx/table]
```
```rpg feature.details
name: Explorer
subtitle: "1st-Level Ranger Feature"
level: 1
text: |
  Your ability to deal with environmental challenges is unmatched. You gain the following benefits: 
  - You gain either a [[Climbing]] speed or swimming speed equal to your base movement speed. 
  - You have advantage on checks to [[Tracking|track a creature]]. 
  - Your speed isn’t halved when you move through nonmagical or magical [[Difficult Terrain]]. You suffer other penalties caused by moving through difficult terrain as normal.
passive:
  text: |
    Your ability to deal with environmental challenges is unmatched. You gain the following benefits: 
    - You have advantage on checks to [[Tracking|track a creature]]. 
    - Your speed isn’t halved when you move through nonmagical or magical [[Difficult Terrain]]. You suffer other penalties caused by moving through difficult terrain as normal.
choose:
  type: traits
  category: "Speed"
  number: 1
  options:
    - [[Climbing]]
    - Swimming
```
```rpg feature.details
name: Mystic Mark
subtitle: "1st, 6th, 13th, and 17th-Level Ranger Feature"
level: 1
text: |
  When you hit a creature with an attack roll, you can mystically mark it as your favored quarry. The creature remains marked for 1 minute, until you use this feature to mark a different creature, or until you become [[Incapacitated]].

  While a creature is marked (including for the attack that triggered the mark), you deal an extra 1d4 damage to it (of the same damage type as the weapon) each time you successfully hit it with a weapon attack. 

  You can use this feature a number of times equal to your PB. You regain all uses when you finish a long rest. 

  This extra damage increases as you gain ranger levels, becoming 1d6 at 6th level, 1d8 at 13th, and 1d10 at 17th.
resource:
  max: PB
  recovery: on long rest
  text: |
    When you hit a creature with an attack roll, you can mystically mark it as your favored quarry. The creature remains marked for 1 minute, until you use this feature to mark a different creature, or until you become [[Incapacitated]].

    While a creature is marked (including for the attack that triggered the mark), you deal an extra {{ leveled: { 1: 1d4, 6: 1d6, 13: 1d8, 17: 1d10 } }} damage to it (of the same damage type as the weapon) each time you successfully hit it with a weapon attack.
roll:
  form: rider
  range: Any
  damage:
    roll: 1d4
    type: origin
  leveled:
    at:
      6: { damage: { roll: 1d6, type: origin } }
      13: { damage: { roll: 1d8, type: origin } }
      17: { damage: { roll: 1d10, type: origin } }
  notes: apply when hitting marked creature with weapon
  cost:
    type: mystic-mark
    amount: 1
```
>[!rules] RANGER QUICK BUILD
>To quickly create a ranger, follow these steps during character creation: 
>- For ability scores, prioritize DEX and then WIS. 
>- For lineage and heritage, choose any combination you like. 
>- For background and talent, choose Homesteader and Far Traveler.
```rpg feature.details
name: Martial Action
subtitle: "2nd-Level Ranger Feature"
level: 2
text: |
  Your tactical expertise allows you to act quickly on the battlefield. You can take a bonus action on each of your turns in combat to perform a [[Weapon Option]] or one of the martial actions granted by this feature. 
  
  Choose one of the following martial actions that you know. 
  #### Aim 
  _Requires Wielding a Ranged or Thrown Weapon_ 

  As a bonus action, you take the time to increase the effectiveness of your next [[Ranged]] weapon attack. Select one target you can see. If you make a ranged weapon attack against that target before the end of your turn, double your PB for the first attack roll.
  #### Quick Strike 
  _Requires Wielding Two Light Weapons_ 

  After you take the Attack action on your turn and attack with a [[Light]] [[Melee]] weapon that you’re holding in one hand, you can use a bonus action to make two attacks with a different Light melee weapon that you’re holding in the other hand—instead of the one attack typically granted by [[Two-Weapon Fighting]]. Don’t add your ability modifier to the damage of these additional attacks unless the modifier is negative.
bonus:
  - [[Weapon Option]]
  - name: Aim
    text: |
      As a bonus action, you take the time to increase the effectiveness of your next [[Ranged]] weapon attack. Select one target you can see. If you make a ranged weapon attack against that target before the end of your turn, double your PB for the first attack roll.
  - name: Quick Strike
    text: |
      After you take the Attack action on your turn and attack with a [[013. Glossary/Weapon Property/Light]] [[Melee]] weapon that you’re holding in one hand, you can use a bonus action to make two attacks with a different Light melee weapon that you’re holding in the other hand—instead of the one attack typically granted by [[Two-Weapon Fighting]]. Don’t add your ability modifier to the damage of these additional attacks unless the modifier is negative.
```
```rpg feature.details
name: Spellcasting
subtitle: "2nd-Level Ranger Feature"
level: 2
text: |
  At 2nd level, you enhance your martial prowess with the ability to cast Primordial spells. See **Chapter 7: Spellcasting** for general rules of spellcasting and the Primordial spell list. 
  #### Casting Spells 
  You know a small number of spells and can cast any of them by using a Primordial spell slot of the spell’s circle or higher. You don't need to prepare spells ahead of time. 

  The **Ranger Progression** table shows how many spells you know and how many Primordial spell slots you have at a given level. For example, at 5th level, you have four 1st-circle slots and two 2nd-circle slots. If you know the 1st-circle spell _animal friendship_ and have a 1st-circle and a 2nd-circle spell slot available, you can cast _animal friendship_ using either slot. If you use a 1st-circle slot, you have three 1st-circle slots remaining. 

  You regain all used spell slots when you finish a long rest. 
  #### Spells Known of 1st Circle and Higher
  At 2nd level, choose two 1st-circle spells from the Primordial spell list that you know. 

  The Spells Known column of the **Ranger Progression** table shows when you learn additional Primordial spells. Each spell you choose must be from a circle for which you have Primordial spell slots. For instance, when you reach 5th level as a ranger, you can learn one new Primordial spell from the 1st or 2nd circle. 

  In addition, when you gain a level of ranger, you can choose one Primordial spell you know and replace it with another spell of your choice from the Primordial spell list. The replacement spell must be of a circle for which you have Primordial spell slots. 
  #### Spellcasting Ability
  Wisdom (WIS) is your spellcasting ability. Your WIS modifier determines the save DC or the attack modifier for certain spells you cast: 
  - **Spell save DC** = 8 + your proficiency bonus (PB) + your WIS modifier 
  - **Spell attack modifier** = your proficiency bonus (PB) + your WIS modifier 
  #### Spellcasting Focus
  You can use a druidic focus (see **Adventuring Gear** in **Chapter 5**) as a spellcasting focus for your Primordial spells.
spellcasting:
  ability: WIS
  type: known
  tier: half
  pool: "[[Primordial]]"
  known: 2
traits:
  Spellcasting: "WIS [[Primordial]]: Known Half-Caster"
```
```rpg feature.level
level: 3
spellcasting:
  known: 1
```
```rpg feature.level
level: 5
spellcasting:
  known: 1
```
```rpg feature.level
level: 7
spellcasting:
  known: 1
```
```rpg feature.level
level: 9
spellcasting:
  known: 1
```
```rpg feature.level
level: 11
spellcasting:
  known: 1
```
```rpg feature.level
level: 13
spellcasting:
  known: 1
```
```rpg feature.level
level: 15
spellcasting:
  known: 1
```
```rpg feature.level
level: 17
spellcasting:
  known: 1
```
```rpg feature.level
level: 19
spellcasting:
  known: 1
```
### Ranger Subclass
_3rd, 7th, 11th, and 15th-Level Ranger Feature_ 

Choose a subclass that reflects your connection to the natural world, either [[Hunter]] or [[Pack Master]] (detailed at the end of this class). Your choice grants you spells and other features at 3rd, 7th, 11th, and 15th level. 
#### Calling Spells
Each ranger subclass has a list of calling spells that you can access as soon as you can cast spells of that circle (as shown in the **Ranger Progression** table). Once you gain such a spell, it is always on your list of known spells, and it doesn’t count against the number of spells you know. However, casting a calling spell still expends a Primordial spell slot as normal. 

If one of these spells isn’t on the Primordial spell list, it still counts as a Primordial spell for you. You can’t replace calling spells when you gain a level of ranger.
```rpg feature.details
name: Improvement
subtitle: "4th, 8th, 12th, 16th, and 19th-Level Ranger Feature"
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
  - Increase one ability score by 1 and select a talent from either the martial or the technical talents list (see [[04. Backgrounds and Talents#Talents|Talents]]).
choose:
  - type: asi
    number: 1
    quantity: 1
  - type: talent
    number: 1
    options:
      - "@worldbuilding/traits/talents/martial"
      - "@worldbuilding/traits/talents/technical"
```
```rpg feature.details
name: Multiattack
subtitle: 5th-Level Ranger Feature
level: 5
type: action
text: |
  Your physical prowess has grown. On your turn, you can make two attacks when you take the [[Attack]] action.
```
```rpg feature.details
name: Empowered Mark
subtitle: 6th-Level Ranger Feature
level: 6
type: passive
text: |
  Your instincts have sharpened, granting you supernatural awareness of your quarry. While a creature marked by your Mystic Mark feature is within 60 feet of you, you know its exact location, and it can’t gain advantage on attacks against you as a result of being invisible or otherwise unseen. In addition, when you attack a marked creature within 60 feet of you, an inability to see it doesn’t impose disadvantage on your attack rolls against it. 
```
```rpg feature.details
name: Stalker's Step
subtitle: 9th-Level Ranger Feature
level: 9
text: |
  While you are in [[Dim Light]], darkness, or are [[Lightly Obscured]] or heavily obscured by foliage, mist, or some other natural phenomenon, you can use a bonus action to magically become [[invisible]], along with any equipment you are wearing or carrying, until the start of your next turn. This invisibility ends early if you attack or cast a spell. 

  You can use this feature a number of times equal to your PB and regain all uses when you complete a long rest.
bonus:
  text: |
    While you are in [[Dim Light]], darkness, or are [[Lightly Obscured]] or heavily obscured by foliage, mist, or some other natural phenomenon, you can use a bonus action to magically become [[invisible]], along with any equipment you are wearing or carrying, until the start of your next turn. This invisibility ends early if you attack or cast a spell.
    max: PB
    recharge: on long rest
```
```rpg feature.details
name: Heroic Boon
subtitle: "10th-Level Ranger Feature"
level: 10
pick: 1
text: |
  Your commitment to the ranger’s path grants you a powerful new ability. Choose one of the following heroic boons: 
```
```rpg feature.choice
parent: Heroic Boon
name: Predator
text: |
  - **Path of the Predator.** When you roll initiative, you can expend a use of Mystic Mark to automatically mark one creature you can see, no attack required. In addition, if a marked creature is reduced to 0 HP, you can use your reaction to transfer the mark to a different creature you can see within 60 feet of the original target.
passive:
  text: When you roll initiative, you can expend a use of Mystic Mark to automatically mark one creature you can see, no attack required.
reaction:
  text: If a marked creature is reduced to 0 HP, you can use your reaction to transfer the mark to a different creature you can see within 60 feet of the original target.
```
```rpg feature.choice
parent: Heroic Boon
name: Sage
text: |
  - **Path of the Sage.** You learn two cantrips of your choice from the Primordial spell list. You also learn two ritual spells of your choice from the Primordial spell list. Both ritual spells must be from circles you have spell slots for, as shown on the **Ranger Progression** table. Ritual spells learned this way don't count against your total number of spells known. WIS is your spellcasting ability for cantrips and ritual spells learned in this way. When you gain a level of ranger, you can replace one of these cantrips and one of these rituals with another cantrip or ritual spell from the Primordial spell list, as long as the replacement ritual spell is still of a circle you have spell slots for. 
spellcasting:
  cantrips: 2
  rituals: 2
```
```rpg feature.details
name: Keensense
subtitle: "14th-Level Ranger Feature"
level: 14
text: |
  You have keensense (see **Special Senses** in **Chapter 6**) to a range of 10 feet. Your keensense ceases to function while you are [[deafened]] or otherwise deprived of hearing. 
traits:
  Senses: "[[Keensense]] 10ft."
```
```rpg feature.details
name: Strider
subtitle: "18th-Level Ranger Feature"
level: 18
type: passive
text: |
  Your movement never provokes opportunity attacks, and you have advantage on any check made to resist an effect that would cause you to become [[Grappled]], [[Restrained]], or [[paralyzed]] or that would otherwise reduce your movement speed to 0 feet.
```
```rpg feature.details
name: Epic Boon
subtitle: "20th-Level Ranger Feature"
level: 20
text: |
  Your commitment to the ranger’s path grants you a powerful new ability. You gain the following epic boon: 
```
```rpg feature.choice
parent: Epic Boon
name: Foe Slayer
text: |
  - **Foe Slayer.** You can add your WIS modifier to either the attack roll or the damage roll of each attack you make against a creature marked by your Mystic Mark on your turn. 
passive:
  text: |
    You can add your WIS modifier to either the attack roll or the damage roll of each attack you make against a creature marked by your Mystic Mark on your turn.
```
## Ranger Subclasses
As a ranger fosters their skills, they gain new abilities that reflect their deepening relationship with the natural world. Your choice of subclass represents the way your connection to the Primordial manifests. 
### Hunter
![[Hunter|no-t clean hide-ll]]
### Pack Master
![[Pack Master|no-t clean hide-ll]]
**Source**: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.