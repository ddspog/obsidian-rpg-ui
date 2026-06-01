---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Attack
```rpg feature.details
type: action
---
The most common action in combat is the [[Attack]] action, whether you swing a sword, fire an arrow from a bow, or brawl with your fists. With this action, you make one [[Melee Attack|melee]] or ranged attack. Certain features, such as the fighter’s Multiattack, allow you to make more than one attack with this action. 

See the **[[06. Playing the Game#Making an Attack|Making an Attack]]** section in this chapter for a detailed breakdown of how this action works.
```
## Melee
```rpg rule.content
id: melee
---
Used in hand-to-hand combat, a melee attack typically uses a handheld weapon such as a sword, warhammer, or axe. A typical monster makes a melee attack when it strikes with its claws, horns, or teeth. 

**_Reach._** You can make melee attacks only against targets within a specified reach. Most creatures have a 5-foot reach and can thus attack targets within 5 feet of them when making a melee attack. Certain creatures (typically those larger than Medium) have melee attacks with a greater reach than 5 feet, as noted in their descriptions.
```
## Ranged
```rpg rule.content
id: ranged
---
When you make a ranged attack, you might fire a bow, hurl a handaxe, or send projectiles to strike at a distance. A monster might shoot spines from its tail. Many spells also involve making a ranged attack. 

**_Range._** You can make ranged attacks only against targets within a specified range. If a ranged attack, such as one made with a spell, has a single range, you can’t attack a target beyond this range. 

**_Long Range._** Some ranged attacks, such as those made with a longbow or a shortbow, have two ranges. The smaller number is the normal range, and the larger number is the long range. Your attack roll has disadvantage when your target is at long range, and you can’t attack a target beyond long range. 

**_Close Range._** Making a ranged attack is more difficult when a foe is next to you. When you make a ranged attack, you have disadvantage on the attack roll if you are within 5 feet of a hostile creature who can see you and who isn’t incapacitated.
```
# Attack Roll
`@[[making-an-attack.webp]].banner(hero)`
```rpg rule.side
title: PLAYER ADVICE
type: rules
---
You make attack rolls only during encounter gameplay. If you aren’t acting in initiative order, you should likely be making an ability check instead of an attack roll. However, if you do something that the GM believes is an attack, the GM can call for initiative and determine your place in initiative order before you make an attack roll or resolve any damage or other effects of your attack.
```
When you use the [[Attack]] action in combat to make an attack, you typically make an [[Attack#Attack Roll|attack roll]] to hit your target. Your attack roll determines whether the attack hits or misses. To make an attack roll, roll a d20 and add the appropriate modifiers. If the check result equals or exceeds the target’s Armor Class (AC), the attack hits. If your attack roll is successful, you deal damage or achieve the goal of your attack. 

Various rules factor into determining the success or failure of attack rolls and the effectiveness of damage. These rules are described in this section. 
#### 1. Declare Attack type & Target
To make an attack, first choose the type of attack you intend to make: a melee attack or a ranged attack. You then choose a target (or targets) within reach or range of the kind of attack you want to make. See the [[Melee Attack|Melee Attacks]] and [[Ranged Attack|Ranged Attacks]] sections in this chapter for more details about the specific types of melee and ranged attacks. 

If you are using the [[Cast a Spell]] action, the spell’s description states if the spell is a melee or ranged attack. 
###### Melee Attack 
`@[[Melee Attack]].highlight().bare(summary)`
###### Ranged Attack 
`@[[Ranged Attack]].highlight().bare(summary)`
#### 2. Determine Modifiers
When a PC makes an attack roll, the two most common modifiers to the roll are an [[Abilities#Ability Modifiers|ability modifier]] and the character’s [[Proficiencies#Proficiency Bonus (PB)|proficiency bonus]] (PB). When a monster makes an attack roll, it uses the modifier provided for the action in its stat block. 

Other factors can help an attack roll succeed, such as those granted by various class features. Environmental factors, cover, or attempting to attack an [[invisible]] target make attack rolls more difficult.
###### Ability Modifier 
`@[[Abilities#When Attacking]].highlight().bare()`
###### Proficiency Bonus 
`@[[Proficiencies#When Attacking]].highlight().bare()`
###### Cover 
`@[[Cover]].highlight().bare()`
###### Unseen Attackers and Targets 
`@[[Hiding]].highlight().bare(unseen)`
#### 3. Make an Attack Roll
When you make an attack, your attack roll determines whether the attack hits or misses. To make an attack roll, roll a d20 and add the appropriate modifiers. If the check result equals or exceeds the target’s Armor Class (AC), the attack hits.
###### Critical Miss or Critical Hit 
`@[[Critical]].highlight().bare(summary)`
#### 4. Resolve the Attack
```rpg rule.side
title: KNOCKING A CREATURE OUT
type: rules
---
By default, all damage you deal to a creature is potentially lethal, causing death if the target is reduced to 0 HP. But sometimes you want to incapacitate a foe rather than kill. When an attacker reduces a creature to 0 HP with a melee attack (not a ranged or spell attack), the attacker can choose to knock the creature out instead of killing it (sometimes referred to as a nonlethal attack). The attacker can make this choice the instant the damage is dealt. The creature falls [[unconscious]] and is stable.
```
If your attack roll failed to hit the target, the attack is over and you play out the rest of your turn (or make your next attack if you have a class feature like Multiattack). If your attack roll was a success, you hit! Roll the damage listed in the attack unless the particular attack has rules that specify otherwise. Some attacks cause special effects in addition to or instead of damage. 
###### Damage Rolls and Modifiers 
If you successfully hit with an attack roll, you deal the attack’s damage. Each weapon, spell, and harmful monster ability specifies the damage it deals. You roll the damage die or dice, add any modifiers, and apply the damage to your target. Magic weapons, special abilities, and other factors can grant a bonus to damage. A penalty might cause you to deal 0 damage, but you never deal negative damage. 

When attacking with a weapon, add your ability modifier (the same one used for the attack roll) to the damage. A spell tells you which dice to roll for damage and whether to add any modifiers. 

If a spell or other effect deals damage to more than one target at the same time, roll damage once for all of them. For example, when a wizard casts [[fireball]], the player rolls damage once for all creatures caught in the blast. 
###### Critical Hits 
`@[[Critical]].highlight().bare(damage)`