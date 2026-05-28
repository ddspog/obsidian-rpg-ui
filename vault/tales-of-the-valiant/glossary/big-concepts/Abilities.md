---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Abilities
```rpg rule.content
id: summary
---
At their core, characters are defined by six [[Abilities]]: 
- **Strength (STR)**, representing your physical might. 
- **Dexterity (DEX)**, representing your agility and reaction time. 
- **Constitution (CON)**, representing your endurance and physical fortitude. 
- **Intelligence (INT)**, representing your ability to acquire and apply knowledge. 
- **Wisdom (WIS)**, representing your intuition and mental fortitude. 
- **Charisma (CHA)**, representing your self-confidence and your ability to influence others.
```
## Ability Score
```rpg rule.content
id: scores
---
Each ability is assigned a number, called an [[Abilities#Ability Score|Ability Score]]. Ability scores represent your various physical and mental abilities. Higher numbers in a score mean your character is better with that ability. 

As you level up, you can increase these scores, but a PC can never have an ability score higher than 20. An average person has 10 in every ability score, so these numbers emphasize how powerful adventurers are!
```
## Ability Modifiers
````rpg rule.content
id: modifiers
---
Once you assign scores, use the following charts to figure out your [[Abilities#Ability Modifiers|Ability Modifiers]]. Ability modifiers are the most important part of your ability scores. As the name suggests, these modify your dice when you roll for things. You use modifiers much more than your score to calculate success or failure in the game. 

```rpg table.ability-modifiers
|ABILITY SCORE|MODIFIER|ABILITY SCORE|MODIFIER|
|---|---|---|---|
|1|−5|12–13|+1|
|2–3|−4|14–15|+2|
|4–5|−3|16–17|+3|
|6–7|−2|18–19|+4|
|8–9|−1|20|+5|
|10–11|+0| | |
[ABILITY MODIFIERS]
```
````
### Rolling with Mods
`````rpg rule.content
id: rolling-mods
---
All checks in the game are tied to one of the six ability modifiers—Strength (STR), Dexterity (DEX), Constitution (CON), Wisdom (WIS), Intelligence (INT), or Charisma (CHA). You add one of these six ability modifiers to every check. The rules typically dictate which modifier you must use for a particular check, but in cases where no ability is listed, the GM decides which one is relevant. 

For more information about applying ability modifiers to checks, see the **Which Ability Modifier?** sidebar.
````rpg rule.side
title: WHICH ABILITY MODIFIER?
kind: callout
type: rules
---
Here is a handy reference to the various ways ability modifiers are used in the game with examples of which ability is relevant to a given check.
```rpg rule.side
kind: spread
title: STRENGTH (STR)
subtitle: "Associated Skills: [[Athletics]]"
---
Strength measures bodily power, athletic aptitude, and the extent to which you can exert raw physical force. STR is used to: 
- Calculate attack rolls and damage with melee weapons 
- Determine how much weight can be lifted or carried 

Use STR for checks that involve feats of bodily force, such as: 
- Kicking down a door, breaking free of bonds, or smashing a lock 
- Pulling, pushing, or lifting heavy objects 
- Climbing a rope or swimming against the current 
- Resisting an attempt to grab, pull, or push you
```
```rpg rule.side
kind: spread
title: DEXTERITY (DEX)
subtitle: "Associated Skills: [[Acrobatics]], [[Sleight of Hand]], [[Stealth]]"
---
Dexterity measures agility, reflexes, and balance. DEX is used to: 
- Calculate attack rolls and damage with ranged weapons or melee weapons with the Finesse property 
- Calculate Armor Class 
- Determine initiative order during encounter gameplay 

Use DEX for checks that involve reflexes, precise motion, or swift response time such as: 
- Maintaining balance while on a moving vehicle or scooting along a narrow ledge 
- Picking a pocket without being noticed 
- Picking a lock or disabling a trap 
- Crafting a small or detailed object 
- Moving silently or sneaking up on prey 
- Resisting an attempt to grab, pull, or push you
```
```rpg rule.side
kind: spread
title: CONSTITUTION (CON)
subtitle: "Associated Skills: None"
---
Constitution measures health, stamina, and vital force. CON is used to: 
- Calculate hit points (HP) 

Use CON for checks that involve endurance or weathering extreme conditions, such as: 
- Holding your breath 
- Extended marching or labor without rest 
- Going without sleep 
- Surviving without food or water 
- Quaffing an entire stein of ale in one go
```
```rpg rule.side
kind: spread
title: INTELLIGENCE (INT)
subtitle: "Associated Skills: [[Arcana]], [[History]], [[Investigation]], [[Nature]], [[Religion]]"
---
Intelligence measures mental acuity, accuracy of recall, and the ability to reason. INT is used to: 
- Calculate certain class spellcasting abilities 

Use INT for checks to draw on logic, education, memory, or deductive reasoning, such as: 
- Communicating without using words 
- Estimating the value of a precious item 
- Forging a document 
- Recalling lore about a craft or trade 
- Winning a game of skill
```
```rpg rule.side
kind: spread
title: WISDOM (WIS)
subtitle: "Associated Skills: [[Animal Handling]], [[Insight]], [[Medicine]], [[Perception]], [[Survival]]"
---
Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition. WIS is used to: 
- Calculate certain class spellcasting abilities 

Use WIS for checks to intuit clues about the environment and people or treat the injured, such as: 
- Getting a gut feeling about next steps 
- Discerning if a seemingly dead creature is Undead 
- Picking up on subtle signals happening around you 
- Bandage a wound or recognize a disease
```
```rpg rule.side
kind: spread
title: CHARISMA (CHA)
subtitle: "Associated Skills: [[Deception]], [[Intimidation]], [[Performance]], [[Persuasion]]"
---
Charisma measures your ability to interact with others and can represent a charming or commanding personality. CHA is used to: 
- Calculate certain class spellcasting abilities 

Use CHA for checks to influence or entertain, make an impression, tell a convincing lie, or navigate a tricky social situation, such as: 
- Finding the best person to talk to for news, rumors, and gossip 
- Pulling together a disguise to pass as a city guard 
- Blending into a crowd to get the sense of key topics of conversation
````
`````
## Ability Checks
````rpg rule.content
id: ability-checks
---
```rpg rule.side
title: ADVANTAGE AND DISADVANTAGE
type: rules
---
`@[[Advantage]].highlight().bare()`
```
When you want to do something that isn’t covered by an attack roll or save, make an ability check. Since ability checks are so wide-ranging, they are more complex than the other two types of checks. 

To make an ability check, roll a d20 and add the appropriate ability modifier. As with other d20 rolls, apply bonuses and penalties, and compare the total to the DC. If the total equals or exceeds the DC, the ability check is a success. You overcome the challenge. Otherwise, it’s a failure. You make no progress toward the objective, or you make some progress but also suffer a setback, as determined by the GM.
````
#### Contests
```rpg rule.content
id: contests
---
Sometimes your efforts are directly opposed by someone else. This can occur when multiple creatures try to do the same thing but only one can succeed, such as snatching a magic ring falling to the floor. It can also occur when one creature tries to prevent another one from accomplishing a goal—for example, a monster might try to force open a door while an adventurer holds it closed. In situations like these, the outcome is determined by a special form of ability check, called a [[Abilities#Contests|Contests]]. 

Every participant in a contest makes an ability check. Apply appropriate bonuses and penalties, but instead of comparing the total to a DC, compare the check results to each other. The participant with the highest check result wins the contest and either succeeds at the action or prevents other participants from succeeding. 

If the contest results in a tie, the situation remains the same. Thus, one participant might win by default. If two creatures tie in a contest to snatch a ring off the floor, neither character grabs it. In a contest between a monster trying to open a door and an adventurer trying to keep it closed, a tie means that the door stays shut.
```
#### Passive Checks
```rpg rule.content
id: passive-checks
---
A [[Abilities#Passive Checks|Passive Check]] doesn’t involve any die rolls. This kind of ability check can represent an average outcome for a task done repeatedly, such as searching for secret doors over and over again. Or a GM can use it to secretly determine whether a PC succeeds at something the player doesn’t know to try to do, such as noticing a hidden monster. 

A passive check total is called a [[Abilities#Passive Checks|Score]]. Here’s how to determine a character’s passive score: 
- 10 + all modifiers that normally apply to the check. 
- If the character has advantage, add 5. For disadvantage, subtract 5. 

So, for example, if a 1st-level character has a WIS +2 ability modifier and is proficient in the [[Perception]] skill, they have a passive [[Perception]] score of 14 (10 + 2 for WIS modifier + 2 for PB).
```
#### Working Together
```rpg rule.content
id: working-together
---
Sometimes two or more creatures work together. In this case, the creature with the highest ability modifier is designated the lead for the effort. That creature can make an ability check with advantage, reflecting the help others give. In combat, a creature can only provide this kind of assistance by taking the [[Help]] action (see **Actions in Combat** in this chapter). 

A creature can only provide help if they have capacity to do the task. For example, trying to open a lock requires proficiency with thieves’ tools, so a creature who lacks that proficiency can’t provide help with a lock-picking job. Moreover, a creature can provide help only when their assistance would be productive. Threading a needle doesn’t get any easier with another pair of hands.
```
#### Group Checks
```rpg rule.content
id: group-checks
---
When several individuals try to accomplish something as a group, the GM might ask for a [[Abilities#Group Checks|Group Check]]. In this case, characters who are skilled at a task help cover for those who aren’t. 

To make a group check, each member of the group makes the ability check separately. If at least half the members succeed (round up), the whole group succeeds. Otherwise, the group fails. 

Group checks don’t come up often, and they’re most useful when all characters succeed or fail as a group. For example, when adventurers navigate a swamp, the GM might call for a WIS ([[Survival]]) group check to see if the whole party can avoid quicksand and sinkholes. If at least half the group succeeds, the successful characters guide their companions out of danger. Otherwise, the group stumbles into a hazard.
```
#### Relevant Proficiencies
```rpg rule.content
id: relevant-proficiencies
---
Two main types of [[Proficiencies]] can modify an ability check.
###### Skill Proficiencies
Every PC starts the game with skill proficiencies granted by their background, class, heritage, lineage, or talents. Proficiency in a skill means you can add your PB to ability checks that involve that skill. Without proficiency in a skill, you don’t add your PB to ability checks.

For example, if a character attempts to climb a dangerous cliff, the GM might ask for a STR ([[Athletics]]) check. If the character is proficient in [[Athletics]], the player rolls a d20, adds their character’s STR modifier and then adds PB. If the character lacks that proficiency, the player rolls a d20 and adds only their character’s STR modifier. 

The rules in a scenario usually prompt a GM to ask for an ability check using a specific skill. For example, “Make a WIS ([[Perception]]) check.” Sometimes though, more than one skill might reasonably apply. You can ask the GM if a different skill is relevant to the check. If the GM agrees, you can use that skill instead. 

See the following **Skills** section for a full list of skill proficiencies and more information about their use.
###### Tool Proficiencies
Some tasks require a particular tool to accomplish, such as repairing an item, forging a document, or picking a lock. Your background, class, heritage, lineage, or talents can give you proficiency with certain tools. Proficiency with a tool allows you to add your PB to any ability check you make using that tool. 

Tool use isn’t tied to a single ability modifier. The check depends on what you’re trying to do, at the GM’s discretion. For example, when using construction tools, the GM might ask for a DEX ([[Constructor Tools]]) check to carve out fine detail or a STR ([[Constructor Tools]]) check to make something out of particularly hard wood. 

See [[05. Equipment & Magic Items#Equipment|Tools]] for a full list of tool proficiencies and information about their use.
```
# Spellcasting Abilities
```rpg rule.content
id: spellcasting
---
Each spellcasting class has an ability score it relies on to cast spells, known as [[Abilities#Spellcasting Abilities|Spellcasting Abilities]]. Spell descriptions often refer to a caster’s spellcasting ability. 

When a target must save against a caster’s spell or when the caster makes an attack roll with a spell, add this ability modifier to your PB to determine the total (see **Spell Saves** and **Spell Attack Rolls** in [[07. Spellcasting|Chapter 7]]). 
- **Spell save DC** = 8 + your proficiency bonus (PB) + your spellcasting ability modifier 
- **Spell attack modifier** = your proficiency bonus (PB) + your spellcasting ability modifier
```