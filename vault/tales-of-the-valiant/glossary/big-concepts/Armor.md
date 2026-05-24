---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
---
# Armor
````rpg rule.content
id: summary
---
This section lists the types of armor available to PCs and covers special rules regarding their use. The **Armor** table lists the cost, AC bonus, weight, special properties, and proficiencies required for every kind of armor.
```rpg table.armor
| ARMOR | COST | ARMOR CLASS (AC) | WEIGHT | PROPERTIES |
| --- | --- | --- | --- | --- |
| Light Armor ||||||
| `@[[items/armor/light/]].row(link, cost, armor.ac, weight, armor.properties)` |
| Medium Armor ||||||
| `@[[items/armor/medium/]].row(link, cost, armor.ac, weight, armor.properties)` |
| Heavy Armor ||||||
| `@[[items/armor/heavy/]].row(link, cost, armor.ac, weight, armor.properties)` |
| Shield ||||||
| `@[[items/armor/shields/]].row(link, cost, armor.ac, weight, armor.properties)` |
[ARMOR]
```

\*At the GM’s discretion, this armor can have the Natural Materials property. Make this decision when you acquire it and note it on your character sheet.
````
## Calculating Armor Class
```rpg rule.content
id: ac
---
Wearing armor increases your armor class (AC), which in turn increases your chance of avoiding enemy attacks. An enemy’s attack roll total must meet or beat your AC to deal damage. So, the higher your AC, the greater your chance of avoiding damage! 

A typical PC who isn’t wearing armor has an AC of 10 + their DEX modifier.

When you wear armor, use the AC equation listed with the type of armor you are wearing instead of the typical 10 + DEX modifier equation. See the **Armor** table for an armor type’s AC equation as well as specific bonuses or limitations it imposes when calculating AC.
```
## Armor Types & Proficiencies
```rpg rule.content
id: types
---
Armor types are categorized into three weights: light, medium, or heavy. You need proficiency in a weight of armor to use it well. For instance, a character with proficiency in light armor can wear any type of armor listed as light armor without penalty. 

Your character can wear any kind of armor, regardless of proficiency. However, if you don’t have proficiency, you have disadvantage on all STR and DEX ability checks made while wearing it. You also can’t cast spells while wearing armor you aren’t proficient with.
```
### Light Armor
```rpg rule.content
id: light
---
Light armor provides minimal protection while still allowing its wearer to move with relative ease.
`@[[items/armor/light/]].p(0)`
```
### Medium Armor
```rpg rule.content
id: medium
---
Medium armor provides more protection than light armor, but it uses bulkier materials that interfere with range of motion.
`@[[items/armor/medium/]].p(0)`
```
### Heavy Armor
```rpg rule.content
id: heavy
---
Heavy armor provides the most protection of any armor type, but wearing it demands great physical prowess.
`@[[items/armor/heavy/]].p(0)`
```
### Shields
```rpg rule.content
id: shields
---
A shield is handheld armor that is wielded instead of worn. This means their AC bonus can be lost if the shield is destroyed or becomes disarmed. Wielding a shield requires the use of one hand, which means a PC can’t use two-handed weapons while holding a shield. You can only benefit from one shield AC bonus at a time, even if you wield multiple shields.
`@[[items/armor/shields/]].p(0)`
```
## Getting in and out of Armor
````rpg rule.content
id: removing
---
The time it takes to don (put on) or doff (take off) armor depends on the armor’s weight. 

**_Don._** This is the time it takes to put on armor. You benefit from the armor’s AC only if you take the full time to don the suit of armor. 
**_Doff._** This is the time it takes to remove armor. If you have help, halve this time, except for shields, which take 1 action regardless of help.

```rpg table.donning-and-doffing-armor
| CATEGORY | DON | DOFF |
| --- | --- | --- |
| Light Armor | 1 minute | 1 minute |
| Medium Armor | 5 minute | 1 minute |
| Heavy Armor | 10 minute | 5 minute |
| Shield | 1 action | 1 action |
[Donning and Doffing Armor]
```
````
# Additional Traits
## Materials
```rpg rule.content
id: materials
---
Armor can be made from a special material that gives it additional properties. Note that these properties aren't considered magical. 

Armor made from special materials typically costs (and can be sold for) more than the same armor made with standard materials. Some well-known special armor materials are described here. Your GM decides whether armor made from special materials is available for purchase.

**_Adamantine._** Adamantine is an exceptionally hard metal that is difficult to find and costly to mine. While wearing adamantine armor, any critical hit against you becomes a normal hit. Adamantine armor can be purchased for an amount equal to the item’s base cost + 1,000 gp. Only medium or heavy armor without the Natural Materials property can be made from adamantine.

**_Mithral._** Mithral is a light yet durable metal that is difficult to find and requires master-level skill to work. Armor made from mithral doesn’t impose disadvantage on DEX ([[Stealth]]) checks or have a STR requirement, even if the standard version of the armor has the [[Cumbersome]] or [[Noisy]] properties. Mithral armor can be purchased for an amount equal to the item’s base cost + 1,000 gp. Only medium or heavy armor without the Natural Materials property can be made from mithral.
```
## Properties
```rpg rule.content
id: properties
---
Many sets of armor have properties that affect their use, as shown in the Properties column of the **Armor** table.
`@[[concepts/armor-property/]].p(0)`
```