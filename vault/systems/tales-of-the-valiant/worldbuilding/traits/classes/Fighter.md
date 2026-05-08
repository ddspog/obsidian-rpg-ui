---
.metadata: 
cssclasses:
  - note-feature
---
# Fighter
![[fighter.webp|right|384]] There are many ways to build a fighter, but at the end of the day, their talents shine brightest in the thick of a fight. Whether archer, knight, wrestler, or general, your class options are designed to make you the best at dishing out damage with your favorite weapons. 

What fighters are good at is written on the label. Your class gives you more options than just standing and swinging to hit, however. Use weapon options to change up a fight and make things easier for the less martially inclined party members.
## Fighters as Adventurers
Fighters are capable and hardy, and they excel at combat— all qualities well-suited to life as an adventurer. With the diverse weapon and armor options available, they can easily thrive on the frontlines of combat or decimate foes from afar with ranged attacks. 

While everyone benefits from having a fighter at their side in combat, fighters often serve as a grounding force in adventuring parties. A fighter’s skills are recognizable across numerous cultures and communities. This can make them more relatable to common folk who understand skill with a weapon more than rarefied magic use.
## Class Features
As a fighter, you have the following class features. 
```rpg feature.details
name: Hit Points
text: |
  **Hit Dice:** 1d10 per fighter level
  **Hit Points at 1st Level:** 10 + your CON modifier
  **Hit Points at Higher Levels:** 1d10 (or 6) + your CON modifier per fighter level after 1st
traits:
  HP: "+10 +CON mod +[LV - 1][CON mod + 1d10]"
  Hit Dice: 1d10
```
```rpg feature.details
name: Proficiencies
text: |
  **Armor:** All armor and [[Shields]]
  **Weapons:** [[Simple]] weapons, [[Martial]] weapons
  **Tools:** None
  **Saves:** STR, CON
  **Skills:** Choose two from [[Acrobatics]], [[Animal Handling]], [[Athletics]], [[History]], [[Insight]], [[Intimidation]], [[Perception]], and [[Survival]]
traits:
  Armor:
    - [[Light Armor]]
    - [[Medium Armor]]
    - [[Heavy Armor]]
    - [[Shields]]
  Weapons:
    - [[Simple]]
    - [[Martial]]
  Save P.:
    - STR
    - CON
choose:
  type: traits
  category: "Skill P."
  number: 2
  options:
    - [[Acrobatics]]
    - [[Animal Handling]]
    - [[Athletics]]
    - [[History]]
    - [[Insight]]
    - [[Intimidation]]
    - [[Perception]]
    - [[Survival]]
```
### Starting Equipment
You start with the following equipment, in addition to the equipment granted by your background: 
- _(a)_ [[systems/tales-of-the-valiant/worldbuilding/items/armor/heavy/Chain Mail]] or _(b)_ [[Leather 1]] armor, [[012. Worldbuilding/Items/Weapons/Longbow]], and 20 [[Arrows]]
- _(a)_ a [[Martial]] weapon and a [[Shield]] or _(b)_ two [[Martial]] weapons 
- _(a)_ a [[012. Worldbuilding/Items/Weapons/Crossbow, light]] and 20 [[Crossbow Bolts]] or _(b)_ two handaxes 
- *(a)* a dungeoneer's pack or *(b)* an explorer's pack
```rpg table.progression
| LEVEL | PB | FEATURES |
| --------- | --- | --- |
| 1st | +2 | Last Stand, Martial Action |
| 2nd | +2 | Action Surge |
| 3rd | +2 | Fighter Subclass |
| 4th | +2 | Improvement |
| 5th | +3 | Multiattack (2/Attack Action) |
| 6th | +3 | Improvement |
| 7th | +3 | Subclass Feature |
| 8th | +3 | Improvement |
| 9th | +4 | Multiattack (3/Attack Action) |
| 10th | +4 | Heroic Boon |
| 11th | +4 | Subclass Feature |
| 12th | +4 | Improvement |
| 13th | +5 | Action Surge (2/Rest) |
| 14th | +5 | Improvement |
| 15th | +5 | Subclass Feature |
| 16th | +5 | Improvement |
| 17th | +6 | Multiattack (4/Attack Action) |
| 18th | +6 | Action Surge (3/Rest) |
| 19th | +6 | Improvement |
| 20th | +6 | Epic Boon |
[FIGHTER PROGRESSION #css/tx/table]
```
```rpg feature.details
name: Last Stand
subtitle: "1st-Level Fighter Feature"
level: 1
text: |
  When you take damage that would reduce your hit points to less than half your hit point maximum (rounded down), you can use your reaction to spend hit dice, up to a number equal to your PB. Immediately roll those hit dice. You regain hit points equal to the sum of all dice rolled + your CON modifier.
reaction:
  text: |
    When you take damage that would reduce your hit points to less than half your hit point maximum (rounded down), you can use your reaction to spend hit dice, up to a number equal to your PB. Immediately roll those hit dice. You regain hit points equal to the sum of all dice rolled + your CON modifier. 
```
```rpg feature.details
name: Martial Action
subtitle: "1st-Level Fighter Feature"
level: 1
text: |
  Your tactical expertise allows you to act quickly on the battlefield. You can take a bonus action on each of your turns in combat to perform a [[Weapon Option]] or one of the martial actions granted by this feature.
  
  Choose one of the following martial actions that you know. 
  #### Aim 
  _Requires Wielding a Ranged or Thrown Weapon_ 

  As a bonus action, you take the time to increase the effectiveness of your next [[Ranged]] weapon attack. Select one target you can see. If you make a ranged weapon attack against that target before the end of your turn, double your PB for the first attack roll. 
  #### Guard 
  _Requires Wielding a Shield_ 

  As a bonus action, you raise your [[Shield]] to intercept incoming attacks. Select one enemy creature within 5 feet of you. That creature has [[Disadvantage]] on the first attack roll it makes against you or an ally within 5 feet of you before the start of your next turn.
  #### Quick Strike 
  _Requires Wielding Two Light Weapons_ 

  After you take the Attack action on your turn and attack with a [[013. Glossary/Weapon Property/Light|Light]] [[Melee]] weapon that you’re holding in one hand, you can use a bonus action to make two attacks with a different Light melee weapon that you’re holding in the other hand—instead of the one attack typically granted by [[Two-Weapon Fighting]]. Don’t add your ability modifier to the damage of these additional attacks unless the modifier is negative.
  #### Wind Up
  _Requires Wielding a Heavy or Versatile Melee Weapon with Both Hands_ 

  As a bonus action, you ready a powerful attack against a nearby target. Select one target you can see within 10 feet of you. If you hit that target with a [[Melee]] weapon attack before the end of your turn, the first such attack deals extra damage equal to your PB (of the same damage type as the weapon).
traits:
  Bonus Actions: 
    - [[Weapon Option]]
  Martial Actions:
    - Aim
    - Guard
    - Quick Strike
    - Wind Up
bonus:
  - [[Weapon Option]]
  - name: Aim
    text: |
      As a bonus action, you take the time to increase the effectiveness of your next [[Ranged]] weapon attack. Select one target you can see. If you make a ranged weapon attack against that target before the end of your turn, double your PB for the first attack roll.
  - name: Guard
    text: |
      As a bonus action, you raise your [[Shield]] to intercept incoming attacks. Select one enemy creature within 5 feet of you. That creature has [[Disadvantage]] on the first attack roll it makes against you or an ally within 5 feet of you before the start of your next turn.
  - name: Quick Strike
    text: |
      After you take the Attack action on your turn and attack with a [[013. Glossary/Weapon Property/Light]] [[Melee]] weapon that you’re holding in one hand, you can use a bonus action to make two attacks with a different Light melee weapon that you’re holding in the other hand—instead of the one attack typically granted by [[Two-Weapon Fighting]]. Don’t add your ability modifier to the damage of these additional attacks unless the modifier is negative.
  - name: Wind Up
    text: |
      As a bonus action, you ready a powerful attack against a nearby target. Select one target you can see within 10 feet of you. If you hit that target with a [[Melee]] weapon attack before the end of your turn, the first such attack deals extra damage equal to your PB (of the same damage type as the weapon).
```
>[!rules] FIGHTER QUICK BUILD
>To quickly create a fighter, follow these steps during character creation: 
>- For ability scores, prioritize STR and then either INT (if you plan to take Spell Blade subclass) or DEX. 
>- For lineage and heritage, choose any combination you like. 
>- For background and talent, choose Soldier and either Combat Casting (if you plan to take Spell Blade subclass) or Combat Conditioning.
```rpg feature.details
name: Action Surge
subtitle: 2nd, 13th and 18th-Level Fighter Feature
level: 2
text: |
  When the need is great, you push your body to its absolute limit. On your turn, you can activate this feature to gain another action—in addition to the action and possible bonus action you regularly get on your turn. 

  Once you use this feature, you must complete a short or long rest before you can use it again. Starting at 13th level, you can use it twice before a rest but only once on the same turn. At 18th level, you can use it three times before a rest but only once on the same turn
resource:
  max:
    2: 1
    13: 2
    18: 3
  recovery: short or long rest
  text: |
    When the need is great, you push your body to its absolute limit. On your turn, you can activate this feature to gain another action—in addition to the action and possible bonus action you regularly get on your turn. 
```
### Fighter Subclass
_3rd, 7th, 11th, and 15th-Level Fighter Feature_ 

Choose a subclass that reflects your role in battle, either Spell Blade or Weapon Master (detailed at the end of this class). Your choice grants you features at 3rd, 7th, 11th, and 15th level.
```rpg feature.details
name: Improvement
subtitle: "4th, 6th, 8th, 12th, 14th, 16th, and 19th-Level Fighter Feature"
level:
  - 4
  - 6
  - 8
  - 12
  - 14
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
  - Increase one ability score by 1 and select a talent from the martial talents list (see [[04. Backgrounds and Talents#Martial Talents|Martial Talents]]).
choose:
  - type: asi
    number: 1
    quantity: 1
  - type: talent
    number: 1
    options:
      - "@worldbuilding/traits/talents/martial"
```
```rpg feature.details
name: Multiattack
subtitle: 5th, 9th and 17th-Level Fighter Feature
level: 5
text: |
  Your physical prowess has grown. On your turn, you can make two attacks when you take the [[Attack]] action. 

  Starting at 9th level, you can make three attacks when you take the Attack action. At 17th level, you can make four.
action:
  text: |
    Your physical prowess has grown. On your turn, you can make {{ leveled { 5: two, 9: three, 17: four } }} attacks when you take the [[Attack]] action.
```
```rpg feature.details
name: Heroic Boon
subtitle: "10th-Level Fighter Feature"
level: 10
pick: 1
text: |
  Your commitment to the fighter’s path grants you a powerful new ability. Choose one of the following heroic boons:
```
```rpg feature.choice
parent: Heroic Boon
name: Defiant
text: |
  - **_Defiant._** When you fail a save, you can instead choose to succeed on the save. You can use this feature once and regain the use of it when you finish a long rest. You can use it twice before a long rest at 13th level, and three times at 17th.
active:
  text: When you fail a save, you can instead choose to succeed on the save.
  max:
    10: 1
    13: 2
    17: 3
  recharge: on long rest
```
```rpg feature.choice
parent: Heroic Boon
name: Unstoppable
text: |
  - **Unstoppable.** When you start your turn, you can choose to end one of the following conditions affecting you: [[blinded]], [[charmed]], [[frightened]], [[incapacitated]], [[paralyzed]], or [[stunned]]. You can use this feature a number of times equal to your PB, and you regain all expended uses when you finish a long rest.
active:
  text: |
    When you start your turn, you can choose to end one of the following conditions affecting you: [[blinded]], [[charmed]], [[frightened]], [[incapacitated]], [[paralyzed]], or [[stunned]].
  max: PB
  recharge: on long rest
```
```rpg feature.details
name: Epic Boon
subtitle: "20th-Level Fighter Feature"
level: 20
text: |
  Your commitment to the fighter’s path grants you a powerful new ability. You gain the following epic boon: 
```
```rpg feature.choice
parent: Epic Boon
name: Turn the Tide
text: |
  - **Turn the Tide.** Once on each of your turns, when you hit a creature or object with a weapon attack on your turn, you can cause the attack to deal additional damage (of the same damage type as the weapon) equal to your STR or DEX score (your choice). The attack’s damage ignores resistance and immunity, and it can’t be reduced or avoided by any means.
active:
  recharge: once per turn
  text: |
    When you hit a creature or object with a weapon attack on your turn, you can cause the attack to deal additional damage (of the same damage type as the weapon) equal to your STR or DEX score (your choice). The attack’s damage ignores resistance and immunity, and it can’t be reduced or avoided by any means.
```
## Fighter Subclasses
As you develop mastery, you gain new abilities that support your preferred combat tactics. The subclass you choose represents your specialized training in pursuit of ever-greater martial might.
```tx
|MARTIAL ARCHETYPE|03RD LV.|07TH LV.|11TH LV.|15TH LV.|DESCRIPTION|
|---|---|---|---|---|
|[[Spell Blade]]|[[Spell Blade#Arcane Spellcasting\|Arcane Spellcasting]], [[Spell Blade#Enchant Weapon\|Enchant Weapon]] (+1), [[Spell Blade#Expanded Talent List\|Expanded Talent List]]|[[Spell Blade#Spell Multiattack\|Spell Multiattack]]|[[Spell Blade#Enchant Weapon\|Enchant Weapon]] (+2), [[Spell Blade#Follow Through\|Follow Through]]|[[Spell Blade#Enchant Weapon\|Enchant Weapon]] (+3), [[Spell Blade#Charged Strike\|Charged Strike]]|Cast spells, wear armor and hit with enchanted weapon.|
|[[Echo Knight ᴰ]]|[[Echo Knight ᴰ#Manifest Echo\|Manifest Echo]], [[Echo Knight ᴰ#Unleash Incarnation\|Unleash Incarnation]], [[Echo Knight ᴰ#Expanded Talent List\|Expanded Talent List]]|[[Echo Knight ᴰ#Echo Avatar\|Echo Avatar]]|[[Echo Knight ᴰ#Shadow Martyr\|Shadow Martyr]]|[[Echo Knight ᴰ#Legion of One\|Legion of One]]|Perform quick teleportation using an echo of yourself|
|[[Shadow Hand ᴴ]]|[[Shadow Hand ᴴ#Shadowy Combat\|Shadowy Combat]], [[Shadow Hand ᴴ#Umbral Recall\|Umbral Recall]] (2/Rest), [[Shadow Hand ᴴ#Expanded Talent List\|Expanded Talent List]]|[[Shadow Hand ᴴ#Handy Maneuvers\|Handy Maneuvers]]|[[Shadow Hand ᴴ#Long Shadow\|Long Shadow]], [[Shadow Hand ᴴ#Umbral Recall\|Umbral Recall]] (4/Rest)|[[Shadow Hand ᴴ#Heavy Handed\|Heavy Handed]], [[Shadow Hand ᴴ#Umbral Recall\|Umbral Recall]] (6/Rest)|Manipulate strong shadowy mage hands proficient with weapons.|
|[[Weapon Master]]|[[Weapon Master#Mastery\|Mastery]], [[Weapon Master#Stunts\|Stunts]]|[[Weapon Master#Deadly Flourish\|Deadly Flourish]]|[[Weapon Master#Advanced Stunts\|Advanced Stunts]]|[[Weapon Master#Grand Finale\|Grand Finale]]|Specialize in some weapons, performing special stunts.|
[FIGHTER SUBCLASSES #css/tx/table]
```
### Spell Blade
![[Spell Blade|no-t clean hide-ll]]
### Echo Knight
![[Echo Knight ᴰ|no-t clean hide-ll]]
### Shadow Hand
![[Shadow Hand ᴴ|no-t clean hide-ll]]
### Weapon Master
![[Weapon Master|no-t clean hide-ll]]
**Source**: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.