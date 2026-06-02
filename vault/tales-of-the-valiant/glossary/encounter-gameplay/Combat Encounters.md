---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
tab-icon: swords
tab-color: var(--color-red)
tab-order: 4
tab-name: Combat
---
## Combat Encounters
`@[[combat.webp]].banner(tall)`
A typical combat encounter is a clash between two sides, a flurry of weapon swings, feints, parries, footwork, and spellcasting. The game organizes this chaos into a cycle of rounds and turns. 

A round represents about 6 seconds in the game world. During a round, each participant takes a turn. The order of turns is determined at the beginning of a combat encounter, when all participants—PCs and monsters alike—roll [[initiative]]. Once everyone has taken a turn, if neither side has won, a new round begins. 

GM-facing information regarding building and running combat encounters is available in the _Monster Vault_.
````rpg rule.tab
name: Steps
icon: footprints
color: var(--color-blue)
---
### Combat Steps
```rpg rule.side
title: COMBAT STEP-BY-STEP
type: rules
---
Every combat follows the same basic steps. Use this checklist to quickly get your fights up and running! 
1. **Determine surprise.** The GM determines whether anyone involved in the combat encounter is surprised.
2. **Establish positions.** The GM decides where all the PCs and adversaries are located on the battlefield or map, based on stated descriptions and what best reflects what is happening in the story.
3. **Roll initiative.** The GM calls for initiative, and everything involved in the combat rolls to determine their place in initiative order (see [[Initiative]]).
4. **Take turns.** Each participant in the battle takes a turn in initiative order.
5. **Begin the next round.** After everyone involved in the combat has taken a turn, the round ends and a new round begins. Repeat step 4 until the fighting stops.
```
The basic steps of combat are detailed here. 
#### 1. Determine Surprise
When a combat encounter begins, but before initiative is rolled, the GM determines whether any participants might be surprised and get the surprised condition (see [[Appendix A, Conditions]]). If no participants are trying to be stealthy, everyone notices each other and no one is surprised. 

Otherwise, the GM compares the DEX ([[Stealth]]) checks of any creatures actively hiding at the start of combat with the [[Perception|passive perception]] score (for PCs) or Perception score (for NPCs or monsters) of creatures on the opposing side. Individual members of a group can be surprised even if other members aren’t. 

Some hazards, traps, and other environmental effects can also cause surprise when triggered. If an effect has this ability, its relevant DCs are listed in the description.
#### 2. Establish Positions
The GM decides where all the PCs and adversaries are located at the start of the combat encounter based on player descriptions and story events. 

Typically, a GM places all creatures involved in combat on a physical or virtual map, to give players an idea of where they can move during their turns. Even during theater of the mind combat with no map, participants take up the same amount of space and move as they would on a map divided into squares where each square represents a 5-by-5-foot space. 
###### Space 
```rpg rule.side
title: SQEEZING INTO A SMALLER SPACE
type: rules
---
A creature can squeeze through a space that is large enough for a creature one size smaller than it. Thus, a Large creature can squeeze through a passage that’s only 5 feet wide. While squeezing through a space, a creature must spend 1 extra foot for every foot it moves there, and it has disadvantage on attack rolls and DEX saves. Attack rolls against a squeezing creature have advantage.
```
A standard space covers a 5-by-5-foot square. A space is the area in feet that a creature effectively controls in combat, not just an expression of its physical dimensions. A typical Medium creature isn’t 5 feet wide, for example, but in a fight, it controls that amount of space. If a Medium hobgoblin stands in a 5-foot-wide doorway, other creatures can’t get through unless the hobgoblin lets them. 

A creature’s space also reflects the area it needs to fight effectively, which limits the number of creatures that can surround one target in combat. Assuming Medium combatants, eight creatures can fit around one target. 

Because larger creatures take up more space, fewer of them can surround a target. If five Large creatures crowd around a Medium or smaller creature, there’s little room for anyone else. In contrast, as many as twenty Medium creatures can surround a Gargantuan one.
###### Creature Size
Each creature takes up a different amount of space. The **Size Categories** table shows how much space a creature of a particular size can control in combat. 
```rpg table.size-categories
| SIZE   | SPACE                             |
| ---------- | ------------------------------------- |
| Tiny       | 2½ by 2½ ft. (one-quarter of a space) |
| Small      | 5 by 5 ft. (one space)                |
| Medium     | 5 by 5 ft. (one space)                |
| Large      | 10 by 10 ft. (4 spaces)               |
| Huge       | 15 by 15 ft. (9 spaces)               |
| Gargantuan | 20 by 20 ft. or larger (16 spaces)    |
[SIZE CATEGORIES] 
```
![[creature-size-on-grid.webp]]
![[creature-size-portrait-a.webp|left|384]]![[creature-size-portrait-b.webp|left|384]]
#### 3. Roll Initiative
Combat encounters use the initiative system described in the [[Initiative#Determining Initiative order|Determining Initiative Order]] section in this chapter. 
#### 4. Take your Turn
On your turn in combat, you can **move** a distance up to your speed and take one action. You decide whether to move first or take your action first. 

The **Movement in Combat** section in this chapter gives more detailed rules for your move. 

The most common actions you can take are described in the **Actions in Combat** section in this chapter. Many class features and other abilities provide additional options for your action. 

You don’t have to move, take an action, or do anything at all on your turn. If you can’t decide what to do on your turn, consider taking the [[Dodge]] or [[Ready]] action (see **Actions in Combat** in this chapter). 
###### Bonus Actions
`@[[Bonus Action]].highlight().bare()`
###### Reactions 
`@[[Reaction]].highlight().bare()`
###### Other Activity on Your Turn 
You can accomplish a variety of minor things during your turn that don’t interfere with your normal action and movement. Here are the kinds of things you might be able to accomplish in this way:
- You can communicate at any time (even on someone else’s turn) through brief talking and gestures. 
- You can interact with one object or aspect of the environment for free, during your move or your action. For example, you could open a door during your move, draw your weapon as part of your [[Attack]] action, or stow a shield as part of a [[Ready]] action. 
- If you want to interact with a second object, you must commit your action to it with the [[Use an Object]] action. 
- Some magic items and other special objects always require an action to use, as stated in their descriptions. 

The GM might require you to use an action for any activity that needs special care or presents an unusual obstacle. For instance, the GM could reasonably expect you to use an action to open a stuck door or turn a crank to lower a drawbridge.
````
````rpg rule.tab
name: Movement
icon: zap
color: var(--color-yellow)
---
### Movement in Combat
`@[[movement-and-position.webp]].banner(hero)`
In combat, characters and monsters are in constant motion, often using movement and position to gain the upper hand. 

On your turn, you can move a distance up to your speed. You can use as much or as little of your speed as you like on your turn. 

Your movement can include [[jumping]], [[climbing]], and [[swimming]]. These different modes of movement can be combined with walking, or they can be your entire move. However you move, deduct the distance of each part of your move from your speed until it is used up or until you are done moving.  
#### Breaking up your Move
You can break up your movement on your turn, using some speed before and then the remainder after your action. For example, if you have a speed of 30 feet, you can move 10 feet, take your action, and then move 20 feet. 
#### Moving between Attacks
If your action includes more than one weapon attack, you can break up your movement by moving between attacks. For example, a fighter who can make two attacks with the Multiattack feature and has a speed of 30 feet could move 10 feet, make an attack, move 20 feet, and then attack a different target. 
#### Using different Speeds
If you have more than one speed, such as a [[walking|walking speed]] and a [[flying|flying speed]], you can switch between them during your move. Whenever you switch, subtract the distance you’ve already moved from the new speed. The result determines how much farther you can move. If the result is 0 or less, you can’t use the new speed during the current move. 

For example, if you have a speed of 30 and a flying speed of 60 because a wizard cast the [[fly]] spell on you, you could fly 20 feet, then walk 10 feet. If you wanted to walk any farther, you’d be done for your move, but you could still leap into the air to fly 30 feet more. 
#### Difficult Terrain
`@[[Difficult Terrain]].highlight().bare(combat)`
#### Falling prone and Standing up
Combatants often get knocked down or throw themselves down. This condition is called [[prone]], described in [[Appendix A, Conditions]]. 

You can choose to **fall prone on your turn freely,** without using any speed. **Standing up** from prone costs half your speed for the turn. For example, if your speed is 30 feet, you must spend 15 feet of movement to stand up. You can’t stand up if you don’t have enough movement left or if your speed is 0. 

To move while [[prone]], you must [[crawling|crawl]] (see [[Movement|Special Movement Rules]]) or use magic such as teleportation. 
#### Moving around other creatures
You can move through a nonhostile creature’s space. You can only move through a hostile creature’s space if the creature is at least two sizes larger or smaller than you. Another creature’s space is [[difficult terrain]] for you. 

Regardless of attitude, you can’t willingly end your move in another creature’s space. 

If you leave a hostile creature’s reach during your move, you provoke an [[opportunity attack]].
#### Opportunity Attacks
`@[[Opportunity Attack]].highlight().bare()`
````
````rpg rule.tab
name: Actions
icon: hand
color: var(--color-green)
---
### Actions in Combat
```rpg rule.side
title: ATTACKS STEP-BY-STEP
type: rules
---
Whether you’re striking with a melee weapon, firing a weapon at range, or making an attack roll as part of a spell, an attack has a simple structure.
1. **Declare attack type and target.** Declare what kind of attack you are making: melee or ranged. Then choose a suitable target within reach of your melee attack or within range of your ranged attack. 
2. **Determine modifiers.** The GM determines whether the target has cover and whether you have advantage or disadvantage on an attack against your chosen target. In addition, spells, special abilities, and other effects can apply penalties or bonuses to your attack roll.
3. **Make an attack roll.** You make your attack roll to determine whether you successfully hit your target, factoring in any modifiers determined in step 2. Note that some spells or special attacks skip this step and have a target make a save instead of requiring you to make an attack roll. In these instances, skip to step 4.
4. **Resolve the attack.** If your attack roll failed to hit the target, the attack is over and you resolve the rest of your turn (or make your next attack if you have a class feature like Multiattack). If your attack roll was a success, you hit! Roll the damage listed in the attack unless the particular attack has rules that specify otherwise. Some attacks cause special effects in addition to or instead of damage.
```
When you take your action on your turn, you can take one of the actions presented here or an action gained from your class or some other feature. Monsters have distinct actions listed in their stat blocks. 

When you describe an action not detailed elsewhere in the rules, the GM tells you whether that action is possible and what kind of roll you need to make, if any, to determine success. 
`@[[concepts/actions/]].highlight().h4(0)`
````
````rpg rule.tab
name: Attacking
icon: sword
color: var(--color-red)
---
### Making an Attack
`@[[Attack#Attack Roll]].highlight().bare()`
````
````rpg rule.tab
name: Melee
icon: biceps-flexed
color: var(--color-cyan)
---
### Melee Attacks
`@[[melee-attacks.webp]].banner(hero)`

This section describes the rules and types of melee attacks. 
#### Reach
`@[[Reach]].highlight().bare(clarifying)`
#### Melee Weapon Attacks
`@[[Melee Attack]].highlight().bare(weapon)`
#### Melee Spell Attacks
`@[[Melee Attack]].highlight().bare(spell)`
#### Special Melee Attacks
`@[[Melee Attack]].highlight().bare(special)`
````
````rpg rule.tab
name: Ranged
icon: move-up-right
color: var(--color-purple)
---
### Ranged Attacks
This section describes the rules and types of ranged attacks. 
#### Range
`@[[Range]].highlight().bare(clarifying)`
#### Ranged Weapon Attacks
`@[[Ranged Attack]].highlight().bare(weapon)`
#### Ranged Spell Attacks
`@[[Ranged Attack]].highlight().bare(spell)`
#### Weapon Options
`@[[Weapon Option]].highlight().bare(special-ranged)`
````
````rpg rule.tab
name: Special
icon: star
color: var(--color-pink)
---
### Death and Dying
If a PC is reduced to 0 HP in combat, follow the rules in the [[Dropping to 0 Hit Points]] section.
### Special Combat Rules
This section covers rules for unusual combat situations. 
#### Mounted Combat
`@[[Mounted Combat]].highlight().bare()`
#### Underwater Combat
`@[[Underwater Combat]].highlight().bare()`
````