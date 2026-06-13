---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Shifter Forms Traits
This file list possible traits to assign to statblocks for possible Beast Forms, [[beast|beasts]] that an [[shifter]] might transform into.
# Traits
## Skills
```rpg feature.details
name: Grassland Camouflage
type: trait
example:
  self: { name: "Beast", cr: 5 }
heading: p
auto: "cr"
tiers:
  5: { score: 22 }
---
The {{ self.name() }}'s [[Stealth]] is {{score}} while in grassland terrain.
```
## Useful
```rpg feature.details
name: Evasion
type: trait
example:
  self: { name: "Beast" }
heading: p
---
If the {{ self.name() }} is subjected to an effect that allows it to make a DEX save to take only half damage, the {{ self.name() }} instead takes no damage if it succeeds on the save, and only half damage if it fails.
```
```rpg feature.details
name: Standing Leap
type: trait
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }}’s long jump is up to 30 feet and its high jump is up to 15 feet, with or without a running start.
```
# Actions
## Ruling
```rpg feature.details
name: Multiattack
type: action
example:
  self: { name: "Beast" }
heading: p
tiers:
  tress_lizard: { attacks: "two Bite attacks and one Tail attack" }
---
The {{ self.name() }} makes {{ attacks }}.
```
## Melee Weapon Attack
```rpg feature.details
name: Bite
type: action
example:
  self: { name: "Beast", cr: 5 }
heading: p
auto: "cr"
tiers:
  5: { hit: 7, reach: "5 ft.", targets: "one target", damage: "13 (2d8 + 4)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```
```rpg feature.details
name: Tail
type: action
example:
  self: { name: "Beast", cr: 5 }
heading: p
auto: "cr"
tiers:
  5: { hit: 7, reach: "10 ft.", targets: "one target", damage: "15 (2d10 + 4)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage.
```
# Bonus Actions
## Actions
```rpg feature.details
name: Shoving Rush
type: bonus
example:
  self: { name: "Beast", cr: 5 }
heading: p
tier:
  5: { dc: 15 }
---
The {{ self.name() }} takes the [[Dash]] action. If it moves, it can propel itself into one creature it can see along its path. The target must succeed on a DC {{ dc }} STR save or be [[prone|knocked prone]]. This movement doesn’t provoke [[opportunity attack|opportunity attacks]] from a target that fails this save.
```