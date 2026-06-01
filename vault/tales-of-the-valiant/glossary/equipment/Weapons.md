---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
tab-icon: swords
tab-color: var(--color-red)
tab-order: 2
---
## Weapons
````rpg rule.content
id: summary
---
The Weapons table lists the cost, damage dice and type, weight, weapon options, and special properties for common weapons. The table is also split by the proficiencies required (simple or martial) to wield the various weapons most effectively.
```rpg table.weapons
@wide
| WEAPON | COST | DAMAGE | WEIGHT | WEAPON OPTION | PROPERTIES |
| --- | --- | --- | --- | --- | --- |
| Simple Melee Weapons ||||||
| `@[[items/weapons/simple-melee/]].highlight().row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
| Simple Ranged Weapons ||||||
| `@[[items/weapons/simple-ranged/]].highlight().row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
| Martial Melee Weapons ||||||
| `@[[items/weapons/martial-melee/]].highlight().row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
| Martial Ranged Weapons ||||||
| `@[[items/weapons/martial-ranged/]].highlight().row(link, cost, weapon.damage, weight, weapon.options, weapon.properties)` |
[Weapons]
```
````
````rpg rule.tab
name: Types
icon: type
color: var(--color-orange)
---
### Weapon Types & Proficiencies
```rpg rule.content
id: types
---
Each weapon is categorized into a type associated with a proficiency. For instance, a character with proficiency in martial weapons gets to add their PB to attack rolls made with any weapon listed in the martial weapons section of the **Weapons** table.

Any character can wield any weapon, but only a character with proficiency can add their PB to attack rolls with those weapons.
```
#### Melee Weapons
```rpg rule.content
id: melee
---
Melee weapons are used to attack nearby targets within reach. Unless the weapon has the [[Reach]] property, melee weapons have a reach of 5 feet.
```
#### Ranged Weapons
```rpg rule.content
id: ranged
---
Ranged weapons are used to attack targets at a distance.
```
#### Simple Weapons
```rpg rule.content
id: simple
---
Simple weapons require little experience to use effectively.

  ![[simple-melee-weapons.webp|left|256]]![[simple-ranged-weapons.webp|right|312]]
```
#### Martial Weapons
```rpg rule.content
id: martial
---
Martial weapons, including swords, axes, and polearms, require training to use effectively.

![[martial-ranged-weapons.webp|left|312]]![[martial-melee-weapons.webp|left|256]]
```
### Improvised Weapons
`@[[Improvised Weapon]].highlight().bare()`
````
````rpg rule.tab
name: Options
icon: hand
color: var(--color-yellow)
---
### Weapon Options
`@[[Weapon Option]].highlight().bare(summary)`
#### Weapon Options Descriptions
`@[[Weapon Option]].highlight().bare(options)`
````
````rpg rule.tab
name: Materials & Properties
icon: table-properties
color: var(--color-cyan)
---
### Weapon Materials
```rpg rule.content
id: materials
---
A weapon can be made from a special material that gives it additional properties. These properties aren't considered magical.

Weapons made from special materials typically cost (and can be sold for) more than the same weapon made with standard materials. Some well-known special weapon materials are described here. Your GM decides whether weapons made from special materials are available for purchase.

**_Adamantine._** Adamantine is an exceptionally hard metal that is difficult to find and costly to mine. On a successful hit, a weapon made of adamantine deals an extra 1d6 damage of the weapon's type to objects and to creatures with the Golem tag. An adamantine weapon or 10 pieces of ammunition can be purchased for an amount equal to the item's base cost + 500 gp.

**_Silvered._** Silvered weapons are standard weapons plated with silver. On a successful hit, a silvered weapon deals an extra 1d6 damage of the weapon's type to creatures with the Shapechanger tag. Silvering weapons is a specialty service that skilled blacksmiths with the appropriate resources can provide. Silvering a weapon or 10 pieces of ammunition costs 100 gp, and a pre-silvered weapon or ammunition can be purchased for an amount equal to the item's base cost + 100 gp. Note that any magical or nonmagical weapon or ammunition can be silvered, even those made from other special materials.
```
### Weapon Properties
```rpg rule.content
id: properties
---
Many weapons have special properties that affect their use, as shown in the Properties column of the **Weapons** table.
`@[[concepts/weapon-property/]].highlight().p(0)`
```
````
