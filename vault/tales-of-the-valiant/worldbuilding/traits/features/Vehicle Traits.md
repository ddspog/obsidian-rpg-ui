---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Vehicle Traits
This file list possible traits to assign to Vehicle statblocks.
# Traits
## Speed
```rpg feature.details
name: Sails
type: trait
example:
  self: { name: "Vehicle" }
heading: p
---
While in initiative, the {{self.name}}'s speed is reduced to 15 ft. when sailing against the wind. While sailing with the wind, its speed becomes 50 feet.
```
```rpg feature.details
name: Maneuverable
type: trait
example:
  self: { name: "Vehicle" }
heading: p
---
The {{self.name}} can move up to its speed and make one 90-degree turn.
```
```rpg feature.details
name: Lightweight
type: trait
example:
  self: { name: "Vehicle" }
heading: p
---
If the {{self.name}} is going downstream, add the speed of the current (typically 3 miles per hour) to its speed. {{self.name}}'s speed is 0 ft. while traveling against any significant current.
```
## Harming
```rpg feature.details
name: Rolling Death
type: trait
example:
  self: { name: "Vehicle", abilities: { str: 4 } }
heading: p
auto: "abilities.str"
tiers:
  4: { dc: 13, damage: "22 (4d10)" }
---
The {{self.name}} can move through spaces occupied by Medium or smaller creatures. Those caught in its path must make a successful DC {{dc}} DEX save to avoid being run over or take {{damage}} bludgeoning damage and be [[prone|knocked prone]].
```
## Useful
```rpg feature.details
name: Armored Vehicle
type: trait
example:
  self: { name: "Vehicle" }
heading: p
---
Creatures inside the {{self.name}} have [[cover|three-quarters cover]] from attacks outside the vehicle.
```
# Actions
## Ruling
```rpg feature.details
id: action-intro
type: action
example:
  self: { name: "Vehicle", stats: { crew: 40 } }
  tier: 2
heading: p
tiers:
  1: { actions: "one action, choosing from the options below" }
  2: { actions: "two actions, choosing from the options below (it can take the same action multiple times)" }
---
On its turn, the {{self.name}} can take {{actions}}. {{ self.stats.crew > 3 ? "It can take only one action if it has fewer than {{ self.stats.crew / 2 }}." }} {{ self.stats.crew > 20 ? "It can't move or take actions if it has fewer than 3 crew." : "It can't take any actions if it has fewer than 2 crew." }}
```
## Special Actions
```rpg feature.details
name: Row
type: action
example:
  self: { name: "Vehicle" }
heading: p
---
The {{self.name}} takes the [[Dash]] action.
```
```rpg feature.details
name: Drift
type: action
example:
  self: { name: "Vehicle", abilities: { dex: 1 } }
heading: p
auto: "abilities.dex"
tiers:
  1: { dc: 13 }
---
The {{self.name}} turns 90 degrees in its current space and moves up to half its speed into a different space. Creatures within 5 feet of spaces occupied by the {{self.name}} when it turns must succeed on a DC {{dc}} CON save or be [[blinded]] until the start of the {{self.name}}'s next turn.
```
```rpg feature.details
name: Power Surge
type: action
example:
  self: { name: "Vehicle" }
heading: p
---
The {{self.name}} immediately moves up to its speed in a straight line. This action can be taken only once per turn.
```
## Melee Weapon Attack
```rpg feature.details
name: Ram
type: action
example:
  self: { name: "Vehicle", abilities: { dex: 0 } }
heading: p
auto: "abilities.dex"
tiers:
  0: { hit: 9, reach: "5 ft.", targets: "one target", damage: "25 (6d6 + 4)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage.
```
## Ranged Weapon Attack
```rpg feature.details
name: Fire Ballista
type: action
example:
  self: { name: "Vehicle", abilities: { str: 7 } }
heading: p
auto: "abilities.str"
tiers:
  3: { hit: 6, range: "120/480 ft.", targets: "one target", damage: "16 (3d10 + 6) piercing damage" }
  7: { hit: 7, range: "120/480 ft.", targets: "one target", damage: "23 (3d10 + 7) piercing damage" }
---
_Ranged Weapon Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}}.
```
```rpg feature.details
name: Fire Mangonels
type: action
example:
  self: { name: "Vehicle", abilities: { str: 7 } }
heading: p
auto: "abilities.str"
tiers:
  7: { hit: 7, range: "200/800 ft. (can't hit targets within 60 feet)", targets: "one target", damage: "34 (5d10 + 7) bludgeoning damage" }
---
_Ranged Weapon Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}}.
```
```rpg feature.details
name: Volley
type: action
example:
  self: { name: "Vehicle", abilities: { dex: 0 } }
heading: p
auto: "abilities.dex"
tiers:
  0: { hit: 5, range: "120 ft.", targets: "one target", damage: "16 (3d10)" }
---
_Ranged Weapon Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}} piercing damage.
```