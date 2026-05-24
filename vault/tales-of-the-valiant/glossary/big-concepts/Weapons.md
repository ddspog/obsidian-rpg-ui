---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
---
# Weapons
````rpg rule.content
id: summary
---
The Weapons table lists the cost, damage dice and type, weight, weapon options, and special properties for common weapons. The table is also split by the proficiencies required (simple or martial) to wield the various weapons most effectively.
```rpg table.weapons
@wide
| WEAPON | COST | DAMAGE | WEIGHT | WEAPON OPTION | PROPERTIES |
| --- | --- | --- | --- | --- | --- |
| Simple Melee Weapons ||||||
| `@[[items/weapons/simple-melee/]].row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
| Simple Ranged Weapons ||||||
| `@[[items/weapons/simple-ranged/]].row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
| Martial Melee Weapons ||||||
| `@[[items/weapons/martial-melee/]].row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
| Martial Ranged Weapons ||||||
| `@[[items/weapons/martial-ranged/]].row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
[Weapons]
```
````
## Types & Proficiencies
```rpg rule.content
id: types
---
Each weapon is categorized into a type associated with a proficiency. For instance, a character with proficiency in martial weapons gets to add their PB to attack rolls made with any weapon listed in the martial weapons section of the **Weapons** table.

Any character can wield any weapon, but only a character with proficiency can add their PB to attack rolls with those weapons.
```
### Melee Weapons
```rpg rule.content
id: melee
---
Melee weapons are used to attack nearby targets within reach. Unless the weapon has the [[Reach]] property, melee weapons have a reach of 5 feet.
```
### Ranged Weapons
```rpg rule.content
id: ranged
---
Ranged weapons are used to attack targets at a distance.
```
### Simple Weapons
```rpg rule.content
id: simple
---
Simple weapons require little experience to use effectively.

  ![[simple-melee-weapons.webp|left|256]]![[simple-ranged-weapons.webp|right|312]]
```
### Martial Weapons
```rpg rule.content
id: martial
---
Martial weapons, including swords, axes, and polearms, require training to use effectively.

![[martial-ranged-weapons.webp|left|312]]![[martial-melee-weapons.webp|left|256]]
```
## Improvised Weapons
```rpg rule.content
id: improvised
---
When your favorite weapon is across the room, you can attack with whatever's handy. An [[Improvised Weapon]] includes any object you can wield in one or two hands, such as broken glass, a table leg, a frying pan, a wagon wheel, or a dead goblin.

When in doubt about how much damage an object should deal, find a weapon on the **Weapons** table most like the object and use its damage die. For example, a table leg is a lot like a club. At the GM's discretion, a character proficient with a weapon can use a similar object as if it were that weapon and add their PB as normal.

If a character uses a ranged weapon to make a melee attack or throws a melee weapon that doesn't have the [[Thrown]] property, those are improvised weapons, and typically deal 1d4 damage of an appropriate damage type. An improvised thrown weapon typically has range of 20 feet and a long range of 60 feet.
```
## Weapon Options
```rpg rule.content
id: options
---
A character can use a [[Weapon Option]] only if the character is wielding and is proficient with an appropriate weapon.

**_Weapon Option Saves._** If an option requires a creature to make an ability check or save, the DC equals 8 + the attacker's PB + the attacker's STR or DEX modifier (attacker's choice).

Unless specified otherwise, a weapon attack used to perform a weapon option has only the option's listed effect and doesn't deal normal weapon damage. Weapon options can be used only when a wielder takes the [[Attack]] action on their turn, unless a feature like the fighter's Martial Action allows a weapon option attack to be performed as a bonus action. Characters with the Multiattack feature can perform a weapon option in place of one of the attacks granted by Multiattack.

At the GM's discretion, some weapon options might not work against certain creatures. For example, the trip weapon option might not work against a creature without discernable legs, such as an ooze, or that is anchored or attached to the ground in some way, such as a tree with animated limbs.
```
### Weapon Options Descriptions
`@[[concepts/weapon-options/]].h6(0)`
## Weapon Materials
```rpg rule.content
id: materials
---
A weapon can be made from a special material that gives it additional properties. These properties aren't considered magical.

Weapons made from special materials typically cost (and can be sold for) more than the same weapon made with standard materials. Some well-known special weapon materials are described here. Your GM decides whether weapons made from special materials are available for purchase.

**_Adamantine._** Adamantine is an exceptionally hard metal that is difficult to find and costly to mine. On a successful hit, a weapon made of adamantine deals an extra 1d6 damage of the weapon's type to objects and to creatures with the Golem tag. An adamantine weapon or 10 pieces of ammunition can be purchased for an amount equal to the item's base cost + 500 gp.

**_Silvered._** Silvered weapons are standard weapons plated with silver. On a successful hit, a silvered weapon deals an extra 1d6 damage of the weapon's type to creatures with the Shapechanger tag. Silvering weapons is a specialty service that skilled blacksmiths with the appropriate resources can provide. Silvering a weapon or 10 pieces of ammunition costs 100 gp, and a pre-silvered weapon or ammunition can be purchased for an amount equal to the item's base cost + 100 gp. Note that any magical or nonmagical weapon or ammunition can be silvered, even those made from other special materials.
```
## Weapon Properties
```rpg rule.content
id: properties
---
Many weapons have special properties that affect their use, as shown in the Properties column of the **Weapons** table.
`@[[concepts/weapon-property/]].p(0)`
```
