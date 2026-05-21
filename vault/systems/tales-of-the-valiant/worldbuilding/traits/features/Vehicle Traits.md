---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**.
---
# Vehicle Traits
## Traits
```rpg feature.details
name: Sails
type: trait
---
While in initiative, the {{self.name}}'s speed is reduced to 15 ft. when sailing against the wind. While sailing with the wind, its speed becomes 50 feet.
```
```rpg feature.details
name: Maneuverable
type: trait
---
The {{self.name}} can move up to its speed and make one 90-degree turn.
```
```rpg feature.details
name: Lightweight
type: trait
---
If the {{self.name}} is going downstream, add the speed of the current (typically 3 miles per hour) to its speed. {{self.name}}'s speed is 0 ft. while traveling against any significant current.
```
```rpg feature.details
name: Armored Vehicle
type: trait
---
Creatures inside the {{self.name}} have three-quarters cover from attacks outside the vehicle.
```
```rpg feature.details
name: Rolling Death
type: trait
tiers:
  1: { save: "DC 13 DEX save", damage: "22 (4d10) bludgeoning damage" }
---
The {{self.name}} can move through spaces occupied by Medium or smaller creatures. Those caught in its path must make a successful {{save}} to avoid being run over or take {{damage}} and be knocked prone.
```
## Actions
```rpg feature.details
id: action-intro
type: action
tiers:
  1: { actions: "one action, choosing from the options below", reduced: "", minimum: "It can't take any actions if it has fewer than 2 crew." }
  2: { actions: "two actions, choosing from the options below (it can take the same action multiple times)", reduced: "It can take only one action if it has fewer than 40 crew.", minimum: "It can't move or take actions if it has fewer than 3 crew." }
  3: { actions: "two actions, choosing from the options below (it can take the same action multiple times)", reduced: "It can take only one action if it has fewer than 4 crew.", minimum: "It can take no actions if it has fewer than 2 crew." }
---
On its turn, the {{self.name}} can take {{actions}}. {{reduced}} {{minimum}}
```
```rpg feature.details
name: Fire Ballista
type: action
tiers:
  1: { hit: 6, range: "120/480 ft.", targets: "one target", damage: "16 (3d10 + 6) piercing damage" }
  2: { hit: 7, range: "120/480 ft.", targets: "one target", damage: "23 (3d10 + 7) piercing damage" }
---
_Ranged Weapon Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}}.
```
```rpg feature.details
name: Fire Mangonels
type: action
tiers:
  1: { hit: 7, range: "200/800 ft. (can't hit targets within 60 feet)", targets: "one target", damage: "34 (5d10 + 7) bludgeoning damage" }
---
_Ranged Weapon Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}}.
```
```rpg feature.details
name: Row
type: action
---
The {{self.name}} takes the [[Dash]] action.
```
```rpg feature.details
name: Drift
type: action
tiers:
  1: { save: "DC 13 CON save" }
---
The {{self.name}} turns 90 degrees in its current space and moves up to half its speed into a different space. Creatures within 5 feet of spaces occupied by the {{self.name}} when it turns must succeed on a {{save}} or be blinded until the start of the {{self.name}}'s next turn.
```
```rpg feature.details
name: Ram
type: action
tiers:
  1: { hit: 9, reach: "5 ft.", targets: "one target", damage: "25 (6d6 + 4) bludgeoning damage" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}}.
```
```rpg feature.details
name: Volley
type: action
tiers:
  1: { hit: 5, range: "120 ft.", targets: "one target", damage: "16 (3d10) piercing damage" }
---
_Ranged Weapon Attack:_ +{{hit}} hit, range {{range}}, {{targets}}. _Hit:_ {{damage}}.
```
```rpg feature.details
name: Power Surge
type: action
---
The {{self.name}} immediately moves up to its speed in a straight line. This action can be taken only once per turn.
```