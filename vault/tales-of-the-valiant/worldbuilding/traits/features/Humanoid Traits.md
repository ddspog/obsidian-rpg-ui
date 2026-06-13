---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**.
---
# Humanoid Traits
This file list possible traits to assign to [[Humanoid]] statblocks.
# Traits
## Skills
```rpg feature.details
name: Heightened Hearing and Sight
type: trait
example:
  self: { name: "Humanoid", cr: 1 }
heading: p
auto: "cr"
tiers:
  1/2: { score: 18 }
  1: { score: 18 }
---
The {{ self.name() }}'s [[Perception]] is {{score}} when perceiving by hearing or sight.
```
## Special
```rpg feature.details
name: Brutal
type: trait
example:
  self: { name: "Humanoid" }
heading: p
---
A melee weapon deals one extra die of its damage when the {{ self.name() }} hits with it (included in the attack).
```
```rpg feature.details
name: Pack Tactics
type: trait
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} has [[advantage]] on attack rolls against a creature if at least one of the {{ self.last_name() }}’s allies is within 5 feet of the creature and the ally isn’t [[incapacitated]].
```
```rpg feature.details
name: Sunlight Sensitivity
type: trait
example:
  self: { name: "Humanoid", cr: 1/8 }
heading: p
auto: "cr"
tiers:
  1/8: { score: 3 }
  1/2: { score: 5 }
  1: { score: 9 }
---
While in sunlight, the {{ self.name() }} has [[Advantage|disadvantage]] on attack rolls, and its [[Perception]] is {{ score }} when perceiving by sight.
```
```rpg feature.details
name: Impenetrable Ego
type: trait
example:
  self: { name: "Humanoid" }
heading: p
---
While the {{ self.name() }} is conscious and wearing no armor and wielding no shield, it adds its CHA modifier to its AC (included above). In addition, it is resistant to the [[charmed]] and [[frightened]] conditions.
```
```rpg feature.details
name: Divine Providence
type: trait
example:
  self: { name: "Humanoid" }
heading: p
---
Each friendly creature within 20 feet of the {{ self.name() }} that isn’t a [[Construct]] or [[Undead]] has [[advantage]] on death saves.
```
```rpg feature.details
name: Divine Blessing
type: trait
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} is resistant to necrotic damage or radiant damage, as appropriate for the {{ self.name() }}’s deity.
```
```rpg feature.details
name: Divine Weapons
type: trait
example:
  self: { name: "Humanoid", cr: 2 }
heading: p
auto: "cr"
tiers:
  2: { extra: 2d6 }
---
The {{ self.name() }}’s weapons are shrouded in dark or golden flames, as appropriate for the {{ self.name() }}’s deity. When the {{ self.name() }} hits with any weapon, the weapon deals an extra {{ extra }} necrotic damage or radiant damage (included in the attack), the {{ self.name() }}’s choice.
```
## Joining Forces
```rpg feature.details
name: Combat Tunneler
type: trait
example:
  self: { name: "Humanoid" }
heading: p
---
If two {{ self.name() }}s wielding any combination of picks and shovels combine their efforts, they gain a [[Burrowing|burrow speed]] of 15 feet through non-rocky soil.
```
# Actions
## Ruling
```rpg feature.details
name: Multiattack
type: action
example:
  self: { name: "Humanoid" }
heading: p
tiers:
  druid: { attacks: "two Flowering Quarterstaff or Poison Bolt" }
  peer: { attacks: "two Rapier" }
  scout: { attacks: "two Shortsword or Shortbow" }
  priest: { attacks: "two Mace or Divine Bolt" }
  kobold_tinkerer: { attacks: "two Tinkerer's Hammer or Parts-Filled Sling" }
---
The {{ self.name() }} makes {{ attacks }} attacks.
```
```rpg feature.details
name: Spellcasting
type: action
example:
  self: { name: "Humanoid" }
heading: p
tiers:
  druid: { attr: "WIS", dc: 13, at_will: "[[druidcraft]], [[speak with animals]]", 3_day: "[[entangle]], [[cure wounds]], [[thunderwave]]", 2_day: "[[barkskin]], [[spike growth]]" }
  acolyte: { attr: "WIS", dc: 13, at_will: "[[lux]], [[thaumaturgy]]", 3_day: "[[bless]], [[cure wounds]], [[sanctuary]]" }
  priest: { attr: "WIS", dc: 13, at_will: "[[guidance]], [[lux]], [[thaumaturgy]]", 2_day: "[[bane]], [[bless]], [[cure wounds]]", 1_day: "[[dispel magic]], [[restoration]]" }
---
The {{ self.name() }} cast one of the following spells, using {{ attr }} as the spellcasting ability (spell save DC {{ dc }}).{{ at_will ? '
- At will: ' + at_will }}{{ 3_day ? '
- 3/day each: ' + 3_day }}{{ 2_day ? '
- 2/day each: ' + 2_day }}{{ 1_day ? '
- 1/day each: ' + 1_day }}
```
## Weapons
```rpg feature.details
name: Dagger
type: action
example:
  self: { name: "Humanoid", abilities: { dex: 4 } }
heading: p
auto: "abilities.dex"
tiers:
  4: { hit: 4, reach: "5 ft.", range: "20/60 ft.", targets: "one target", damage: "4 (1d4 + 2)" }
---
_Melee or Ranged Weapon Attack:_ +{{hit}} to hit, reach {{reach}} or range {{range}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Shortsword
type: action
example:
  self: { name: "Humanoid", cr: 1 }
heading: p
auto: "cr"
tiers:
  1/2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)" }
  1: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Rapier
type: action
example:
  self: { name: "Humanoid", cr: 1/8 }
heading: p
auto: "cr"
tiers:
  1/8: { hit: 3, reach: "5 ft.", targets: "one target", damage: "5 (1d8 + 1)" }
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "7 (1d8 + 2)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Club
type: action
example:
  self: { name: "Humanoid", cr: 1/2 }
heading: p
auto: "cr"
tiers:
  1/2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "7 (2d4 + 2)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage.
```
```rpg feature.details
id: mace-priests
name: Mace
type: action
example:
  self: { name: "Humanoid", cr: 1/4 }
heading: p
auto: "cr"
tiers:
  1/4: { hit: 2, reach: "5 ft.", targets: "one target", damage: "3 (1d6)", extra: "3 (1d6)" }
  2: { hit: 3, reach: "5 ft.", targets: "one target", damage: "4 (1d6 + 1)", extra: "7 (2d6)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage plus {{extra}} necrotic or radiant damage (the {{self.last_name()}}'s choice).
```
```rpg feature.details
name: Shortbow
type: action
example:
  self: { name: "Humanoid", cr: 1 }
heading: p
auto: "cr"
tiers:
  1/2: { hit: 4, range: "80/320 ft.", targets: "one target", damage: "5 (1d6 + 2)" }
  1: { hit: 4, range: "80/320 ft.", targets: "one target", damage: "5 (1d6 + 2)" }
---
_Ranged Weapon Attack:_ +{{hit}} to hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Sling
type: action
example:
  self: { name: "Humanoid", cr: 1/8 }
heading: p
auto: "cr"
tiers:
  1/8: { hit: 4, range: "30/120 ft.", targets: "one target", damage: "4 (1d4 + 2)" }
  1: { hit: 5, range: "30/120 ft.", targets: "one target", damage: "5 (1d4 + 3)" }
---
_Ranged Weapon Attack:_ +{{hit}} to hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage.
```
```rpg feature.details
name: Hand Crossbow
type: action
example:
  self: { name: "Humanoid", cr: 2 }
heading: p
auto: "cr"
tiers:
  2: { hit: 5, range: "30/120 ft.", targets: "one target", damage: "6 (1d6 + 3)" }
---
_Ranged Weapon Attack:_ +{{hit}} to hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Heavy Crossbow
type: action
example:
  self: { name: "Humanoid", cr: 1/2 }
heading: p
auto: "cr"
tiers:
  1/2: { hit: 2, range: "120/400 ft.", targets: "one target", damage: "5 (1d10)" }
---
_Ranged Weapon Attack:_ +{{hit}} to hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Mining Pick
type: action
example:
  self: { name: "Humanoid", abilities: { str: 0 } }
heading: p
auto: "abilities.str"
tiers:
  0: { hit: 5, reach: "5 ft.", targets: "one target", damage: "6 (1d6 + 3)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Tinkerer's Hammer
type: action
example:
  self: { name: "Humanoid", abilities: { dex: 2 } }
heading: p
auto: "abilities.dex"
tiers:
  2: { hit: 4, reach: "5 ft.", range: "20/60 ft.", targets: "one target", damage: "4 (1d4 + 2)" }
---
_Melee or Ranged Weapon Attack:_ +{{hit}} to hit, reach {{reach}} or range {{range}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage. If the {{ self.last_name() }} makes this attack against a friendly [[Construct]], the tinker has [[advantage]] on the attack roll, and the target regains HP instead of taking damage.
```
```rpg feature.details
name: Parts-Filled Sling
type: action
example:
  self: { name: "Humanoid", cr: 1/2 }
heading: p
auto: "cr"
tiers:
  1/2: { hit: 4, range: "30/120 ft.", targets: "one target", damage: "4 (1d4 + 2)" }
---
_Ranged Weapon Attack:_ +{{hit}} to hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} bludgeoning, piercing or slashing damage (the {{ self.last_name() }}'s choice).
```
```rpg feature.details
name: Flowering Quarterstaff
type: action
example:
  self: { name: "Humanoid", abilities: { str: 0 } }
heading: p
auto: "abilities.str"
tiers:
  0: { hit: 5, reach: "5 ft.", targets: "one target", damage: "7 (1d8 + 3)", extra: "5 (2d4)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage plus {{extra}} poison damage.
```
## Spells
```rpg feature.details
name: Poison Bolt
type: action
example:
  self: { name: "Humanoid", abilities: { wis: 3 } }
heading: p
auto: "abilities.wis"
tiers:
  3: { hit: 5, range: "60 ft.", targets: "one target", damage: "10 (3d4 + 3)" }
---
_Ranged Spell Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} poison damage.
```
```rpg feature.details
name: Radiant Bolt
type: action
example:
  self: { name: "Humanoid", cr: 1/4 }
heading: p
auto: "cr"
tiers:
  1/4: { hit: 6, range: "60 ft.", targets: "one target", damage: "6 (1d4 + 4)" }
---
_Ranged Spell Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} radiant damage.
```
```rpg feature.details
name: Divine Bolt
type: action
example:
  self: { name: "Humanoid", cr: 2 }
heading: p
auto: "cr"
tiers:
  2: { hit: 5, range: "60 ft.", targets: "one target", damage: "10 (2d6 + 3)" }
---
_Ranged Spell Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} necrotic damage or radiant damage (the {{ self.last_name() }}'s choice).
```
## Equipments
```rpg feature.details
name: Lantern Splash (Recharge 5-6)
type: action
example:
  self: { name: "Humanoid", abilities: { dex: 5 } }
heading: p
auto: "abilities.dex"
tiers:
  5: { dc: 13, damage: "14 (4d6)" }
---
The {{ self.name() }} opens its miner’s lantern and splashes [[Oil (flask)|burning oil]] in a 15-foot cone. Each creature in that area must make a DC {{ dc }} Dexterity saving throw, taking {{ damage }} fire damage on a failed save, or half as much damage on a successful one.
```
## Joining Forces
```rpg feature.details
name: Small but Fierce
type: action
example:
  self: { name: "Humanoid", abilities: { dex: 5 } }
heading: p
auto: "abilities.dex"
tiers:
  5: { dc: 13, damage: "7 (2d6)" }
---
Two {{ self.name() }}s within 5 feet of each other can combine their actions to slam their mining picks into the ground and split the earth in a 20-foot line that is 5 feet wide, extending from one of the pair. Each creature in that line must make a DC {{ dc }} Dexterity saving throw. On a failure, a creature takes {{ damage }} bludgeoning damage and is [[prone|knocked prone]]. On a success, a creature takes half the damage and isn’t knocked prone.
```
## Crafting
```rpg feature.details
name: Makeshift Ally (1/Day)
type: action
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} cobbles together spare parts from its pockets and pouches, creating a [[Construct|Tiny Construct]]. The Construct can appear however the {{ self.last_name() }} wants, it obeys the {{ self.last_name() }}'s spoke commands, and it uses the statistics of a [[Mechadron, Solodron]]. The Construct remains for 1 hour, until the {{ self.last_name() }} dies, or until the {{ self.last_name() }} dismisses it as a bonus action. When the Construct dies or is dismissed, it falls into its component parts.
```
# Bonus Actions
## Ruling
```rpg feature.details
id: change-shape-druid
name: Change Shape
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} magically transforms into a Medium or smaller [[Beast]] that has a challenge rating no higher than its own, or back into its true form, which is [[Humanoid]]. Any equipment it is wearing or carrying transforms with it. It reverts to its true form if it dies. In a new form, the {{ self.name() }} retains its HP, ability to speak, proficiencies, and INT, WIS, and CHA modifiers, as well as this bonus action. Its statistics and capabilities are otherwise replaced by those of the new form, except any class features or legendary actions of that form.
```
```rpg feature.details
id: change-shape-lycanthrope
name: Change Shape
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} transforms into a Medium or Large bear, a Large bear-humanoid hybrid, or back into its true form, which is [[Humanoid]]. Its statistics, other than its size, speed, and AC, are the same in each form. Any equipment it is wearing or carrying isn’t transformed. It reverts to its true form if it dies.
```
## Special
```rpg feature.details
name: Scurry
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} moves up to 15 feet without provoking [[Opportunity Attack]]. If the {{ self.last_name() }} is aware of traps in the area, the {{ self.last_name() }} can choose if this movement triggers any of them.
```
```rpg feature.details
name: Sucker Punch
type: bonus
example:
  self: { name: "Humanoid", cr: 1/2 }
heading: p
auto: "cr"
tiers:
  1/2: { dc: 12, damage: "2 (1d4)" }
---
The {{ self.name() }} employs unscrupulous tactics to hit its opponent in a vulnerable spot. One creature the {{ self.name() }} can see within 5 feet of it must make a DC {{ dc }} DEX save. On a failure, the target takes {{ damage }} bludgeoning damage.
```
## Actions
```rpg feature.details
name: Escape to Report
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} takes the [[Dash]] or [[Disengage]] action.
```
# Reactions
## Special
```rpg feature.details
name: Parry
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
The {{ self.name() }} adds 2 to its AC against one melee attack that would hit it. To do so, the {{ self.name() }} must see the attacker and be wielding a melee weapon.
```
```rpg feature.details
name: Counterstrike
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
When a creature the {{ self.name() }} can see targets it with a melee weapon attack, the {{ self.name() }} makes a melee weapon attack against the targeting creature. If the targeting creature misses with its attack, the {{ self.name() }} has [[advantage]] on its attack.
```
```rpg feature.details
name: Redirect Attack
type: bonus
example:
  self: { name: "Humanoid" }
heading: p
---
When a creature the {{ self.name() }} can see targets it with an attack, the {{ self.name() }} chooses an ally within 5 feet of it. The {{ self.name() }} and ally swap places, and the ally becomes the target instead.
```