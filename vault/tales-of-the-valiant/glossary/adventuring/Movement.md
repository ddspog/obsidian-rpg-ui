---
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
````rpg rule.content
id: adventuring
icon: footprints
color: var(--color-green)
order: 2
---
## Movement
```rpg rule.content
name: summary
---
Swimming across a rushing river, sneaking down a dungeon corridor, scaling a treacherous mountain slope— all sorts of movement play into fantasy adventures. 

The GM can summarize movement without calculating exact distances or travel times: “You travel through the forest and find the dungeon entrance late in the evening of the third day.” Even in a large dungeon, the GM might summarize movement between encounters: “After killing the guardian at the entrance to the ancient dwarven stronghold, you consult your map, which leads you through miles of echoing corridors to a chasm bridged by a narrow stone arch.” 

Sometimes though, it’s important to know more precisely how long it takes to get somewhere. Rules for this depend on a few factors: the speed and travel pace of the creatures moving and the terrain they’re moving over.
```
```rpg rule.tab
name: Speed
color: var(--color-yellow)
icon: zap
---
### Speed
`@[[Walking]].highlight().bare()`
`@[[glossary/speed/]].highlight().h4(summary)`
```
```rpg rule.tab
name: Special
color: var(--color-orange)
icon: star
---
### Special Movement Rules
Adventurers often find themselves traversing dangerous environments or navigating perilous situations that require special kinds of movement. PCs might have to climb, crawl, swim, or jump to get where they need to go. In such circumstances, the following special movement rules apply. 
`@[[glossary/speed/]].highlight().h4(special)`
```
```rpg rule.tab
name: Terrain
icon: chart-no-axes-gantt
color: var(--color-purple)
---
### Difficult Terrain
`@[[Difficult Terrain]].highlight().bare(summary)`
```
```rpg rule.tab
name: Forced
icon: biceps-flexed
color: var(--color-red)
---
### Forced Movement
Some effects or consequences move you against your will. Forced movement never provokes opportunity attacks from hostile creatures. 
`@[[glossary/speed/]].highlight().h4(forced)`
```
```rpg rule.tab
name: Traveling
icon: footprints
color: var(--color-blue)
---
### Traveling
`@[[Travel Pace]].highlight().bare()`
```
````
### Movement in Combat
````rpg rule.content
id: combat
---
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
## On Statblocks
```rpg rule.content
id: statblock
---
A creature’s speed defines how far it can move during a single round of combat. If the creature has multiple ways to move (such as [[swimming]] or [[flying]]), those are also listed in this section. 

All creatures have a [[walking]] speed, simply called speed. Creatures with no ground-based movement have a walking speed of 0 feet. Some creatures have one or more of the following additional ways to move. 
`@[[glossary/speed/]].highlight().h3(statblock)`
### Using Different Speeds
If a creature has more than one speed, such as a [[walking]] and [[flying]] speed, it can switch back and forth between its speeds during its move. Whenever the creature switches, subtract the distance the creature has already moved from the new speed. The result determines how much farther the creature can move. If the result is 0 or less, the creature can’t use the new speed during the current move. 

For example, if a creature has a speed of 30 and a [[flying]] speed of 60, the creature could fly 20 feet, then walk 10 feet, and then leap into the air to fly 30 feet more. 
```