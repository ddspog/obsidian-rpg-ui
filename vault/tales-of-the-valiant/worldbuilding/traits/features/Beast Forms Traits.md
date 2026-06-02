---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Beast Forms Traits
This file list possible traits to assign to statblocks for possible Beast Forms, [[beast|beasts]] that an [[druid]] might transform into.
# Traits
## Skills
```rpg feature.details
name: Heightened Smell
type: trait
example:
  self: { name: "Beast", abilities: { wis: 1 } }
heading: p
auto: "abilities.wis"
tiers:
  1: { score: 18 }
  2: { score: 19 }
---
The {{ self.name() }}'s [[Perception]] is {{score}} when perceiving by smell.
```
```rpg feature.details
name: Heightened Sight
type: trait
example:
  self: { name: "Beast", abilities: { wis: 1 } }
heading: p
auto: "abilities.wis"
tiers:
  1: { score: 18 }
  2: { score: 19 }
---
The {{ self.name() }}'s [[Perception]] is {{score}} when perceiving by sight.
```
```rpg feature.details
name: Heightened Hearing and Sight
type: trait
example:
  self: { name: "Beast", abilities: { wis: 1 } }
heading: p
auto: "abilities.wis"
tiers:
  1: { score: 20 }
---
The {{ self.name() }}'s [[Perception]] is {{score}} when perceiving by hearing or sight.
```
```rpg feature.details
name: Quiet Wings
type: trait
example:
  self: { name: "Beast", abilities: { dex: 2 } }
heading: p
auto: "abilities.wis"
tiers:
  2: { score: 19 }
---
The {{ self.name() }}'s [[Stealth]] is {{score}} while flying.
```
## Harming
```rpg feature.details
name: Charge
type: trait
example:
  self: { name: "Beast", abilities: { str: 2 } }
heading: p
auto: "abilities.str"
tiers:
  2: { dc: 12, damage: "3 (1d6)" }
---
If the {{ self.name() }} moves at least 20 feet straight toward a target and then hits it with a Ram attack on the same turn, the target takes an extra {{ damage }} bludgeoning damage. If the target is a creature, it must succeed on a DC {{ dc }} STR save or be [[prone|knocked prone]].
```
```rpg feature.details
name: Pounce
type: trait
example:
  self: { name: "Beast", abilities: { str: 2 } }
heading: p
auto: "abilities.str"
tiers:
  2: { dc: 12, damage: "3 (1d6)" }
---
If the {{ self.name() }} moves at least 20 feet straight toward a creature and then hits it with a Claws attack on the same turn, the target must succeed on a DC {{ dc }} STR save or be [[prone|knocked prone]]. If the target is prone, the {{ self.name() }} can make one Bite attack against it as a bonus action.
```
## Useful
```rpg feature.details
name: Amphibious
type: trait
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }}'s can breathe air and water.
```
```rpg feature.details
name: Flyby
type: trait
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }}'s doesn't provoke [[opportunity attack]] when it flies out of an enemy's reach.
```
```rpg feature.details
name: Easy Gait
type: trait
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }}’s steps are smooth and steady. A creature riding the {{ self.last_name() }} has [[advantage]] on saves against [[exhaustion]] caused by a [[Travel Pace|Forced March]].
```
```rpg feature.details
name: Seabird
type: trait
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }} can [[Swimming|swim]] up to 30 feet on its turn, but it must start and end its movement either flying or on a solid surface, such as a ship or beach. If it is swimming at the end of its turn, it must succeed on a DC 10 CON save or it immediately begins to sink and [[Other forms of Harm#Suffocating|suffocate]]. A suffocating eagle must succeed on a DC 8 STR check to fly out of the substance where it is sinking.
```
# Actions
## Ruling
```rpg feature.details
id: multiattack-grappling
name: Multiattack
type: action
example:
  self: { name: "Beast, Grappling", abilities: { str: 4 } }
heading: p
auto: "abilities.str"
tiers:
  4: { dc: 14 }
  5: { dc: 15 }
---
The {{ self.name() }} makes one Bite attack and one Claws attack. If both attacks hit one creature, the target is [[grappled]] (escape DC {{ dc }}). The {{ self.last_name() }} can grapple only one creature at a time.
```
## Melee Weapon Attack
```rpg feature.details
name: Bite
type: action
example:
  self: { name: "Beast", abilities: { str: 4 } }
heading: p
auto: "abilities.str"
tiers:
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)" }
  4: { hit: 6, reach: "5 ft.", targets: "one target", damage: "8 (1d8 + 4)" }
  5: { hit: 7, reach: "5 ft.", targets: "one target", damage: "9 (1d8 + 5)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Claws
type: action
example:
  self: { name: "Beast", abilities: { str: 4 } }
heading: p
auto: "abilities.str"
tiers:
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "4 (1d4 + 2)" }
  4: { hit: 6, reach: "5 ft.", targets: "one target", damage: "9 (2d4 + 4)" }
  5: { hit: 7, reach: "5 ft.", targets: "one target", damage: "12 (2d6 + 5)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} slashing damage.
```
```rpg feature.details
name: Ram
type: action
example:
  self: { name: "Beast", abilities: { str: 2 } }
heading: p
auto: "abilities.str"
tiers:
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage.
```
```rpg feature.details
name: Hooves
type: action
example:
  self: { name: "Beast", abilities: { str: 3 } }
heading: p
auto: "abilities.str"
tiers:
  3: { hit: 5, reach: "5 ft.", targets: "one target", damage: "6 (1d6 + 3)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage.
```
```rpg feature.details
name: Kick
type: action
example:
  self: { name: "Beast", abilities: { str: 2 } }
heading: p
auto: "abilities.str"
tiers:
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "4 (1d4 + 2)", dc: 12 }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage, and the target must succeed on a DC {{ dc }} STR save or be pushed up to 10 feet away from the {{ self.name() }}.
```
```rpg feature.details
name: Talons
type: action
example:
  self: { name: "Beast", abilities: { dex: 1 } }
heading: p
auto: "abilities.dex"
tiers:
  1: { hit: 3, reach: "5 ft.", targets: "one target", damage: "3 (1d4 + 1)" }
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "6 (1d8 + 2)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} slashing damage.
```
```rpg feature.details
name: Pincer
type: action
example:
  self: { name: "Beast", abilities: { str: 2 } }
heading: p
auto: "abilities.str"
tiers:
  2: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)", dc: 12, pincers: "two" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage and the target is [[grappled]] (escape DC {{ dc }}). The {{ self.name() }} has {{ pincers }} pincers, each of which can grapple only one target.
```
# Bonus Actions
## Conditional
```rpg feature.details
name: Pincer Pinch
type: bonus
example:
  self: { name: "Beast", abilities: { str: 2 } }
heading: p
auto: "abilities.str"
tiers:
  2: { dc: 12 }
---
One breathing creatured [[grappled]] by the {{ self.name() }} must succeed on a DC {{ dc }} STR save or be unable to speak of cast spells with verbal components and begin [[Other forms of Harm#Suffocating|suffocating]], as the {{ self.name() }} squeezes the air from the target's lings. This effect lasts until the grapple ends.
```
## Actions
```rpg feature.details
name: Stealthy Hunter
type: bonus
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }} takes the [[Hide]] action.
```