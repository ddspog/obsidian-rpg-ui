---
.metadata: 
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Cleric
![[cleric.webp|right|384]]Clerics are as diverse as the gods they serve, but all are united in their mission to act as their faith demands. A cleric's abilities reflect the strength of their faith. The more powerful a cleric becomes, the more their features resemble those of the god they worship.

Cleric is a class that specializes in healing—a crucial part of the adventuring job. Your class features still give you plenty to do when no one is hurt, but no other class is set up to heal and restore damaged allies like yours.
## Clerics as Adventurers
Few people can channel divine power as easily as a cleric, so they are typically expected to face the world's challenges from an early age—or are compelled to do so if their power comes to them later in life.

Clerics possess awesome healing capabilities, a healthy mix of spells capable of harming foes or bolstering allies, and sturdy constitutions that allow them to survive a fight more easily than other casting classes. All these qualities make them welcome additions to an adventuring party.

However, clerics are bound to serve their faith first and their companions second. When faced with ethically or morally complex situations, a cleric's presence can be a boon—or hindrance—to making decisions as a group.
## Class Features
As a cleric, you have the following class features.
````rpg rule.tab
name: Basic
icon: plus
color: var(--color-green)
---
```rpg feature.details
name: Hit Points
traits:
  HP: "+8 +CON mod +[LV - 1][CON mod + 1d8]"
  Hit Dice: 1d8

---
**Hit Dice:** 1d8 per cleric level
**Hit Points at 1st Level:** 8 + your CON modifier
**Hit Points at Higher Levels:** 1d8 (or 5) + your CON modifier per cleric level after 1st
```
```rpg feature.details
name: Proficiencies
traits:
  Armor:
    - [[Light Armor]]
    - [[Medium Armor]]
    - [[Shields]]
  Weapons:
    - [[Simple]]
  Save P.:
    - WIS
    - CHA
choose:
  type: traits
  category: "Skill P."
  number: 2
  options:
    - [[History]]
    - [[Insight]]
    - [[Medicine]]
    - [[Persuasion]]
    - [[Religion]]

---
**Armor:** [[Light Armor]], [[Medium Armor]], and [[Shields]]
**Weapons:** [[Simple]] weapons
**Tools:** None
**Saves:** WIS, CHA
**Skills:** Choose two from [[History]], [[Insight]], [[Medicine]], [[Persuasion]], and [[Religion]]
```
### Starting Equipment
You start with the following equipment, in addition to the equipment granted by your background:
- (_a_) a [[Mace]] or (_b_) a [[Warhammer]] (if proficient)
- (_a_) scale mail, (_b_) [[Leather]] armor, or (_c_) [[Chain Mail]] (if proficient)
- (_a_) [[Crossbow, light]] and 20 [[Crossbow Bolts]] or (_b_) any [[Simple]] weapon
- (_a_) a priest's pack or (_b_) an explorer's pack
- A [[Shield]] and a [[Holy Symbol]]
```rpg table.progression
| CLERIC PROGRESSION  ||||| DIVINE SPELL SLOTS BY CIRCLE      |||||||||
|LEVEL|PB|FEATURES|CANTRIPS KNOWN|RITUALS KNOWN|1ST|2ND|3RD|4TH|5TH|6TH|7TH|8TH|9TH|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|+2|Manifestation of Faith, Spellcasting|3|1|2|—|—|—|—|—|—|—|—|
|2|+2|Channel Divinity: Turn the Profane (1/Rest)|3|1|3|—|—|—|—|—|—|—|—|
|3|+2|Cleric Subclass|3|2|4|2|—|—|—|—|—|—|—|
|4|+2|Improvement|4|2|4|3|—|—|—|—|—|—|—|
|5|+3|Destroy the Profane (CR 1/2)|4|3|4|3|2|—|—|—|—|—|—|
|6|+3|Channel Divinity (2/Rest)|4|3|4|3|3|—|—|—|—|—|—|
|7|+3|Subclass Feature|4|4|4|3|3|1|—|—|—|—|—|
|8|+3|Destroy the Profane (CR 1), Improvement|4|4|4|3|3|2|—|—|—|—|—|
|9|+4|Divine Intervention|4|5|4|3|3|3|1|—|—|—|—|
|10|+4|Heroic Boon|5|5|4|3|3|3|2|—|—|—|—|
|11|+4|Destroy the Profane (CR 2), Subclass Feature|5|6|4|3|3|3|2|1|—|—|—|
|12|+4|Improvement|5|6|4|3|3|3|2|1|—|—|—|
|13|+5|Channel Divinity (3/Rest)|5|7|4|3|3|3|2|1|1|—|—|
|14|+5|Destroy the Profane (CR 3)|5|7|4|3|3|3|2|1|1|—|—|
|15|+5|Subclass Feature|5|8|4|3|3|3|2|1|1|1|—|
|16|+5|Improvement|5|8|4|3|3|3|2|1|1|1|—|
|17|+6|Destroy the Profane (CR 4)|5|9|4|3|3|3|2|1|1|1|1|
|18|+6|Channel Divinity (4/Rest)|5|9|4|3|3|3|3|1|1|1|1|
|19|+6|Improvement|5|9|4|3|3|3|3|2|1|1|1|
|20|+6|Epic Boon|5|9|4|3|3|3|3|2|2|1|1|
[CLERIC PROGRESSION #css/tx/table #css/tx/s/wide]
```
```rpg feature.details
name: Spellcasting
subtitle: "1st-Level Cleric Feature"
level: 1
spellcasting:
  ability: WIS
  type: prepared
  tier: full
  pool: "[[Divine]]"
  cantrips: 3
  rituals: 1
  prepared_max: "WIS_MOD + LV"
traits:
  Spellcasting: "WIS [[Divine]]: Prepared Full-Caster"

---
As a conduit for divine power, you can cast Divine spells. See [[07. Spellcasting]] for general rules of spellcasting and the [[Divine]] spell list.

#### Cantrips
At 1st level, choose three cantrips from the Divine spell list to learn. You choose more Divine cantrips to learn at higher levels, as shown in the Cantrips Known column of the **Cleric Progression** table.

#### Preparing Spells
You must prepare spells in advance before you can cast them. You can prepare any spell on the [[Divine]] spell list from circles for which you have Divine spell slots. (You determine which spell slots you can access by checking your level on the **Cleric Progression** table). You can choose a number of spells equal to your WIS modifier + your cleric level (minimum of one spell). This is your list of prepared spells from which you can cast. 

Preparing a new list of spells requires time spent in prayer and meditation: at least 1 minute per spell circle for each spell you change. You can change your list of prepared spells as part of a long rest.

#### Casting Spells
You have prepared a number of spells and can cast any of them by using a Divine spell slot of the spell's circle or higher.

The **Cleric Progression** table shows how many Divine spell slots you have at a given level. For example, at 3rd level, you have four 1st-circle and two 2nd-circle spell slots, and with a 16 WIS, you can have six prepared spells of 1st or 2nd circle, in any combination. You only have two spell slots for 2nd-circle spells though, so if you prepare only 2nd-circle spells, you won't be able to use your 1st-circle spell slots at all.

Casting a spell doesn't remove it from your list of prepared spells, it just uses up a spell slot. You regain all used spell slots when you finish a long rest.

#### Spellcasting Ability
Wisdom (WIS) is your spellcasting ability. Your WIS modifier determines the save DC and the attack modifier for certain spells you cast:

- **Spell save DC** = 8 + your proficiency bonus (PB) + your WIS modifier
- **Spell attack modifier** = your proficiency bonus (PB) + your WIS modifier

#### Rituals
You can also cast a type of long-form spell called a ritual. Rituals don't need to be prepared, and they don't use up spell slots.

At 1st level, choose one ritual from the [[07. Spellcasting#Divine Ritual List|Divine Ritual List]]. You learn more rituals at higher levels, as shown in the Rituals Known column of the **Cleric Progression** table, but only from a circle for which you have spell slots. Rituals you learn don't count against the number of spells you learn at each level.

#### Spellcasting Focus
You can use a [[holy symbol]] (see [[05. Equipment & Magic Items#Equipment|Adventuring Gear]]) as a spellcasting focus for your Divine spells.
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
```rpg rule.side
type: rules
title: CLERIC QUICK BUILD  
---
To quickly create a cleric, follow these steps during character creation: 
- For ability scores, prioritize WIS and then either STR or CON (depending on if you take Manifest Might or Manifest Miracles). 
- For lineage and heritage, choose any combination you like. 
- For background and talent, choose Adherent and Mental Fortitude. 
- For spells, choose the [[Guidance]], [[sacred flame]], and [[Thaumaturgy]] cantrips (plus [[ray of frost]] if taking Manifest Miracles). Then prepare your 1st-circle Divine spells (choose a number of the following spells equal to your WIS modifier + 1): [[Bless]], [[Cure Wounds]], [[guiding bolt]], [[healing word]], and [[shield of faith]]. Finally, choose your 1st-circle ritual: [[Detect Poison and Disease]].
```
```rpg feature.details
name: Manifestation of Faith
subtitle: "1st-Level Cleric Feature"
level: 1
pick: 1
---
Clerics demonstrate their faith in one of two primary ways, wielding it as a holy warrior or calling it as a miracle worker. Choose how you manifest your faith with one of the following.
```
```rpg feature.choice
parent: Manifestation of Faith
name: Might
traits:
  Armor: [[Heavy Armor]]
  Manifestation of Faith: Might
active:
  recharge: once per turn
  text: When you hit a creature with a weapon attack, you can deal _additional radiant or necrotic damage_ (your choice) equal to your PB.
choose:
  type: traits
  category: "Weapons"
  number: 1
  options:
    - "@worldbuilding/martial"
    - "@worldbuilding/simple"
---
**_Manifest Might._** You gain proficiency with [[Heavy Armor]] and one type of [[Martial]] weapon of your choice. Once per turn, when you hit a creature with a weapon attack, you can deal additional radiant or necrotic damage (your choice) equal to your PB.
```
```rpg feature.choice
parent: Manifestation of Faith
name: Miracles
traits:
  Manifestation of Faith: Miracles
passive:
  text: You can add your PB to the damage you deal with any [[Divine]] cantrip. 
choose:
  type: traits
  category: "Cantrips"
  number: 1
  options:
    - "@worldbuilding/cantrips"
---
**_Manifest Miracles._** You learn one additional cantrip of your choice from any source of magic. This cantrip counts as a [[Divine]] cantrip for you, but it doesn't count against the number of cantrips you know. In addition, you can add your PB to the damage you deal with any Divine cantrip.
```
````
````rpg rule.tab
name: Main Features
icon: book
color: var(--color-orange)
---
```rpg feature.details
name: Channel Divinity
subtitle: "2nd, 6th, 13th, and 18th-Level Cleric Feature"
level: 2
resource:
  max:
    2: 1
    6: 2
    13: 3
    18: 4
  recovery: short or long rest
  text: You gain the ability to channel divine energy directly from your deity to produce effects beyond spells. When you use your Channel Divinity feature, choose which specific effect you want. Some effects require a save; the DC is equal to your cleric spell save DC.
action:
  name: Turn the Profane
  resource: Channel Divinity
  text: |
    As an action, you present your [[Holy Symbol]] and speak a prayer to censure unholy creatures.

    - Each Fiend and Undead of your choice within 30 feet of you and that can see or hear you must make a WIS save.
    - If the creature fails its save, it is turned for 1 minute or until it takes any damage.
    - A turned creature must try to move as far away from you as it can, though it can’t first get closer to you to do it. On its turn, it can use only the [[Dash]] action or otherwise try to escape from an effect that prevents it from moving. If there’s nowhere to move, it can use the [[Dodge]] action. It can’t take any reactions.
traits:
  Channel Divinity: Turn the Profane

---
You gain the ability to channel divine energy directly from your deity to produce effects beyond spells. You start with one effect: Turn the Profane. Some subclasses grant additional effects as you advance in levels.

When you use your Channel Divinity feature, choose which specific effect you want. Some effects require a save; the DC is equal to your cleric spell save DC.

Beginning at 2nd level, you can use this feature once per short or long rest, then twice between rests at 6th level, three times at 13th level, and four times at 18th level.

#### Channel Divinity: Turn the Profane

As an action, you present your holy symbol and speak a prayer to censure unholy creatures. Each Fiend and Undead of your choice within 30 feet of you that can see or hear you must make a WIS save. On a failed save, it is turned for 1 minute or until it takes any damage.

A turned creature must try to move as far away from you as it can, though it can't first get closer to you. On its turn, it can use only the Dash action or otherwise try to escape from an effect that prevents it from moving. If there's nowhere to move, it can use the Dodge action. It can't take any reactions.
```
```rpg rule.side
direction: left
title: CLERICS AND GODS
type: rules
---
One of the most important aspects of creating a cleric is choosing which god (or gods) you revere. Your relationship to these holy entities defines much of what you do and how others view you. Who you worship factors heavily into the subclass you choose at 3rd level, so think ahead and keep the themes of your faith in mind.

Most campaign settings include pantheons of gods tailored to that particular setting. Your GM’s homebrew setting might have unique deities for your cleric to worship, as well. See Appendix B: Gods & Pantheons for a list of deities unique to the Labyrinth setting.
```
```rpg feature.details
name: Cleric Subclass
subtitle: "3rd, 7th, 11th, and 15th-Level Cleric Feature"
level: 3
---
Choose a subclass that reflects your relationship to your deity, Life, Light, or War (detailed at the end of this class). Your choice grants you spells and other features at 3rd, 7th, 11th, and 15th level.
#### Domain Spells
Each cleric subclass has a list of domain spells that you can access as soon as you can cast spells of that circle. Once you gain such a spell, you always have it prepared, and it doesn't count against the number of spells you can prepare. However, casting a domain spell still expends a Divine spell slot as normal.

If one of these spells isn't on the [[Divine]] spell list, it still counts as a Divine spell for you.
```
```rpg feature.details
name: Improvement
subtitle: "4th, 8th, 12th, 16th, and 19th-Level Cleric Feature"
level:
  - 4
  - 8
  - 12
  - 16
  - 19
pick: 1
---
Choose one of the following improvements (ability scores can't be raised above 20 with this feature):
```
```rpg feature.choice
parent: Improvement
name: Ability Score Boost
choose:
  type: asi
  number: 1
  quantity: 2

---
- Increase a single ability score by 2.
```
```rpg feature.choice
parent: Improvement
name: Balanced Growth
choose:
  type: asi
  number: 2
  quantity: 1

---
- Increase two different ability scores by 1 each.
```
```rpg feature.choice
parent: Improvement
name: Talented Growth
choose:
  - type: asi
    number: 1
    quantity: 1
  - type: talent
    number: 1
    options:
      - "@worldbuilding/traits/talents/magic"

---
- Increase one ability score by 1 and select a talent from the magic talents list (see [[04. Backgrounds and Talents#Talent|Magic Talents]]).
```
```rpg feature.details
name: Destroy the Profane
subtitle: "5th, 8th, 11th, 14th, and 17th-Level Cleric Feature"
level: 5
passive:
  text: When a Fiend or Undead fails its save against your Turn the Profane feature, it is instantly destroyed if its challenge rating (CR) is {{ table "destroy-the-profane" row=CLASS_LEVEL col="cr" step=true }}

---
When a Fiend or Undead fails its save against your Turn the Profane feature, it is instantly destroyed if its challenge rating is at or below the threshold shown in the **Destroy the Profane** table below.
```
```rpg table.destroy-the-profane
|CLERIC LEVEL|CR|
|---|---|
|5|1/2 or lower|
|8|1 or lower|
|11|2 or lower|
|14|3 or lower|
|17|4 or lower|
[DESTROY THE PROFANE #css/tx/table]
```
````
````rpg rule.tab
name: High Level
icon: brain
color: var(--color-blue)
---
```rpg feature.details
name: Divine Intervention
subtitle: "9th-Level Cleric Feature"
level: 9
active:
  max: 1
  recovery: 1/week on success, 1/long rest on failure
  text: |
    You can call on your deity to intervene on your behalf when your need is great. At the start of your turn, you can request aid from your deity by rolling a d20 and adding your PB. If the result is 19 or lower, your request fails, and your deity doesn't intervene. If the result is 20 or higher, your deity intervenes on your behalf, imbuing you with a fraction of their power. 

    If your deity intervenes, you can immediately use your action to cast any spell with a casting time of 1 action from the [[Divine]] spell list or your domain spell list, regardless of preparation rules. Casting a spell in this way doesn't expend a spell slot and doesn’t require material components. If the spell is of a higher circle than you can normally cast, you must make an ability check using your spellcasting ability to determine whether you cast it successfully. The DC for this check equals 10 + the spell’s circle. On a failed check, the spell fails, your deity’s power fades, and your action is lost. 

    Alternatively, on a successful intervention, your GM can propose the form of the intervention. Anything that replicates the effects of a Divine spell is appropriate. In this instance, you still use your action but don’t cast a spell. You have final say on allowing the GM to pursue this option or choosing your own spell. 
---
You can call on your deity to intervene on your behalf when your need is great. At the start of your turn, you can request aid from your deity by rolling a d20 and adding your PB. If the result is 19 or lower, your request fails, and your deity doesn't intervene. If the result is 20 or higher, your deity intervenes on your behalf, imbuing you with a fraction of their power. 

If your deity intervenes, you can immediately use your action to cast any spell with a casting time of 1 action from the [[Divine]] spell list or your domain spell list, regardless of preparation rules. Casting a spell in this way doesn't expend a spell slot and doesn’t require material components. If the spell is of a higher circle than you can normally cast, you must make an ability check using your spellcasting ability to determine whether you cast it successfully. The DC for this check equals 10 + the spell’s circle. On a failed check, the spell fails, your deity’s power fades, and your action is lost. 

Alternatively, on a successful intervention, your GM can propose the form of the intervention. Anything that replicates the effects of a Divine spell is appropriate. In this instance, you still use your action but don’t cast a spell. You have final say on allowing the GM to pursue this option or choosing your own spell. 

If your deity intervenes, you can’t use this feature again for 1 week. Otherwise, you can use it again after you finish a long rest.
```
```rpg feature.details
name: Heroic Boon
subtitle: "10th-Level Cleric Feature"
level: 10
pick: 1
---
Your commitment to the cleric's path grants you a powerful new ability. Choose one of the following heroic boons:
```
```rpg feature.choice
parent: Heroic Boon
name: Consecration
passive:
  text: You are now immune to disease. If you die, your body is instantly preserved as per the [[gentle repose]] spell for up to a year and a day.
traits:
  Immunity:
    - Poison Damage
    - [[Poisoned]]

---
- **_Gift of Consecration._** You are now immune to disease, poison damage, and the poisoned condition. If you die, your body is instantly preserved as per the [[gentle repose]] spell for up to a year and a day.
```
```rpg feature.choice
parent: Heroic Boon
name: Wrath
passive:
  text: When you cast a spell that deals damage of any type, you can choose for it to deal radiant or necrotic damage instead.
choose:
  type: traits
  category: "Resistance"
  number: 1
  options:
    - Radiant Damage
    - Necrotic Damage

---
- **_Gift of Wrath._** Choose either the radiant or necrotic damage type. You are now resistant to damage of the chosen type. In addition, when you cast a spell that deals damage of any type, you can choose for it to deal radiant or necrotic damage instead.
```
```rpg feature.details
name: Epic Boon
subtitle: "20th-Level Cleric Feature"
level: 20
---
Your commitment to the cleric's path grants you a powerful new ability. You gain the following epic boon:
```
```rpg feature.choice
parent: Epic Boon
name: Divine Herald
update:
  active: Divine Intervention
  recovery: once per long rest
  text: |
    You can call on your deity to intervene on your behalf when your need is great. At the start of your turn, you can request aid from your deity. Your deity intervenes on your behalf, imbuing you with a fraction of their power. 

    As it intervenes, you can immediately use your action to cast any spell with a casting time of 1 action from the [[Divine]] spell list or your domain spell list, regardless of preparation rules. Casting a spell in this way doesn't expend a spell slot and doesn’t require material components. If the spell is of a higher circle than you can normally cast, you must make an ability check using your spellcasting ability to determine whether you cast it successfully. The DC for this check equals 10 + the spell’s circle. On a failed check, the spell fails, your deity’s power fades, and your action is lost. 

    Alternatively, your GM can propose the form of the intervention. Anything that replicates the effects of a Divine spell is appropriate. In this instance, you still use your action but don’t cast a spell. You have final say on allowing the GM to pursue this option or choosing your own spell.

---
- **_Divine Herald._** When you use your Divine Intervention feature, your deity automatically intervenes without a roll, and you no longer have to wait a week before you use Divine Intervention again, though you can still use it only once per long rest.
```
````
## Cleric Subclasses
You have proved your devotion, and your efforts are rewarded. You gain access to the powers of a domain that your god presides over or that best aligns with your faith. Three domains are presented here: Life, Light, and War.
```rpg rule.tab
name: Life
icon: plus
color: var(--color-green)
---
### Life Domain
`@[[Life Domain]].highlight().bare()`
```
```rpg rule.tab
name: Light
icon: lightbulb
color: var(--color-yellow)
---
### Light Domain
_Subclass of Cleric. Channels radiant light to burn enemies and dazzle foes. (Subclass details not yet documented in this compendium.)_
```
```rpg rule.tab
name: War
icon: sword
color: var(--color-red)
---
### War Domain

_Subclass of Cleric. Wields weapons and armor with divine focus. (Subclass details not yet documented in this compendium.)_
```
