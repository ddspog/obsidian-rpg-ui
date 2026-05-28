---
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
tab-name: Items
tab-icon: box
tab-color: var(--color-orange)
tab-order: 4
---
## Interacting with Items
![[interacting-with-items.webp|banner+tall]]

A character’s interaction with items in an environment is often simple to resolve in the game. The player tells the GM that their character is doing something, such as moving a lever, and the GM describes what happens. 

For example, a character pulls a lever. The GM might say that this opens a chute causing a room to flood with water. Or it might open a secret door in a nearby wall.

If the lever is rusted in position though, a character might need to force it. In such a situation, the GM might call for a STR check to see whether the character can wrench the lever into place. The GM sets the DC based on the difficulty of the task (see [[Difficulty Class#Determining DC|Determining DC]]). 

Characters can also damage objects. Objects are immune to poison and psychic damage, but otherwise they can be affected by physical and magical attacks. The GM determines an object’s AC and HP and might decide that certain objects have resistance or immunity to certain kinds of attacks (it’s hard to cut a rope with a club, for example). Objects always fail STR and DEX saves, and they are immune to effects that require other saves. When an object drops to 0 HP, it breaks. For more information, see [[05. Equipment & Magic Items#Object & Structure Stats|Object and Structure Statistics]]. 

A character can also attempt a STR check to break an object. The GM sets the DC for any such check.
```rpg rule.tab
name: Types of Items
icon: box
color: var(--color-purple)
---
### Types of Items
Certain rules, spells, and abilities affect items in different ways. In such scenarios, it’s often important to further define the item’s type. This section breaks down the various categories of items and provides examples of what kinds of items belong to each.
#### Items
Items is the highest-level category. It includes almost everything that isn’t a creature or natural terrain. Items include equipment, objects, structures, and vehicles, and it’s a catchall for things that don’t fit neatly into another category. 
#### Equipment
The equipment category includes all items that can be [[Interacting with Items#Types of Items|Carried]] or [[Interacting with Items#Types of Items|Wielded]] by characters. Most weapons, armor, adventuring gear, tools, and magic items (see [[05. Equipment & Magic Items]]) fall into this category. Typically, equipment doesn’t have AC or hit points, and it can’t be broken or damaged like other kinds of items. 
#### Objects
The object category includes all items that can’t be carried or wielded or items. Objects generally have an AC and hit points. Typically, objects can be broken (see [[05. Equipment & Magic Items#Object & Structure Stats|Object and Structure Statistics]]). In many cases, it makes more sense to treat Huge or Gargantuan objects as structures.
#### Structures
The structure category contains items that are massive in scale or composed of many smaller objects. For example, a single wall might be an object, but an entire castle would be a structure. Like objects, most structures can be broken. However, due to their scale, they often possess unique rules around breaking (see [[05. Equipment & Magic Items#Object & Structure Stats|Object and Structure Statistics]]). 
#### Vehicles
The vehicle category includes items that are similar in size to structures and composed of many smaller objects. Vehicles specifically have their own vehicle stat block. Vehicles work differently from other items and are governed by their own rules (see [[05. Equipment & Magic Items#Vehicles|Vehicles]]).
```
````rpg rule.tab
name: Lifting and Carrying
icon: biceps-flexed
color: var(--color-red)
---
### Lifting and Carrying
Your Strength score determines the amount of weight you can bear. The following terms define what you can lift or carry. 

```rpg rule.content
name: Carrying Capacity
view: p
---
Your [[Interacting with Items#Lifting and Carrying|Carrying Capacity]] is your Strength score multiplied by 15. This is the weight (in pounds) that you can carry, which is high enough that most characters don't usually have to worry about it. 
```
```rpg rule.content
name: Push, Drag, or Lift
view: p
---
You can push, drag, or lift a weight in pounds up to twice your carrying capacity (or 30 times your Strength score). While pushing or dragging weight in excess of your carrying capacity, your speed drops to 5 feet. 
```
```rpg rule.content
name: Size and Strength
view: p
---
Larger creatures can bear more weight, whereas Tiny creatures can carry less. For each size category above Medium, double the creature's carrying capacity and the amount it can push, drag, or lift. For a Tiny creature, halve these weights.
```
#### Variant: Encumbrance
The rules for lifting and carrying are intentionally simple. For more detailed rules to determine how a character is hindered by carried weight, try this variant. When you use this, ignore the [[Cumbersome]] property of armor sets on the **Armor** table in **Chapter 5**. 

If you carry weight in excess of 5 times your Strength score, you are [[Interacting with Items#Variant Encumbrance|Encumbered]], which means your speed drops by 10 feet. 

If you carry weight in excess of 10 times your Strength score, up to your maximum carrying capacity, you are instead [[Interacting with Items#Variant Encumbrance|Heavily Encumbered]], which means your speed drops by 20 feet and you have disadvantage on ability checks, attack rolls, and saving throws that use Strength, Dexterity, or Constitution.
````