---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**.
---
# Construct Traits
This file list possible traits to assign to [[Construct]] statblocks.
# Traits
## Special
```rpg feature.details
name: Construct Resilience
type: trait
example:
  self: { name: "Construct" }
heading: p
---
The {{ self.name() }} is immune to poison and psychic damage, and it is immune to [[exhaustion]] and the [[charmed]], [[frightened]], [[paralyzed]], [[petrified]], and [[poisoned]] conditions.
```
## Useful
```rpg feature.details
name: Construct Nature
type: trait
example:
  self: { name: "Construct" }
heading: p
---
The {{ self.name() }} doesn't require air, food, drink or sleep.
```
```rpg feature.details
name: Unerring Mind
type: trait
example:
  self: { name: "Construct" }
heading: p
---
The {{ self.name() }} can perfectly recall information it has seen or heard in the past 90 days.
```
# Actions
## Melee Weapon Attack
```rpg feature.details
name: Melee Armament
type: action
example:
  self: { name: "Construct", cr: 1/8 }
heading: p
auto: "cr"
tiers:
  1/8: { hit: 3, reach: "5 ft.", targets: "one target", damage: "3 (1d4 + 1)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning, piercing, or slashing damage (the {{ self.last_name() }}'s choice).
```
## Spells
```rpg feature.details
name: Eye Beam
type: action
example:
  self: { name: "Construct", cr: 1/8 }
heading: p
auto: "cr"
tiers:
  1/8: { hit: 4, range: "120 ft.", targets: "one target", damage: "4 (1d4 + 2)" }
---
_Ranged Spell Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} force damage.
```
# Bonus Actions
## Ruling
```rpg feature.details
name: Machine Vigor
type: bonus
example:
  self: { name: "Construct" }
heading: p
---
The {{ self.name() }} ends one spell, magical effect, or condition affecting it.
```