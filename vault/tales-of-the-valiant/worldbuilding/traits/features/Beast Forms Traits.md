---
cssclasses:
  - note-feature
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Beast Forms Traits
This file list possible traits to assign to statblocks for possible Beast Forms, [[beast|beasts]] that an [[druid]] might transform into.
# Traits
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
name: Amphibious
type: trait
example:
  self: { name: "Beast" }
heading: p
---
The {{ self.name() }}'s can breathe air and water.
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
  4: { hit: 6, reach: "5 ft.", targets: "one target", damage: "9 (2d4 + 4)" }
  5: { hit: 7, reach: "5 ft.", targets: "one target", damage: "12 (2d6 + 5)" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} slashing damage.
```
```rpg feature.details
name: Pincer
type: action
example:
  self: { name: "Beast" }
heading: p
tiers:
  1: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)", dc: 12, pincers: "two" }
---
_Melee Weapon Attack:_ +{{hit}} to hit, reach {{reach}}, {{targets}}. _Hit:_ {{damage}} bludgeoning damage and the target is [[grappled]] (escape DC {{ dc }}. The {{ self.name() }} has {{ pincers }} pincers, each of which can grapple only one target.
```
# Bonus Actions
```rpg feature.details
name: Pincer Pinch
type: bonus
example:
  self: { name: "Beast" }
heading: p
tiers:
  1: { hit: 4, reach: "5 ft.", targets: "one target", damage: "5 (1d6 + 2)", dc: 12, pincers: "two" }
---
One breathing creatured [[grappled]] by the {{ self.name() }} must succeed on a DC {{ dc }} STR save or be unable to speak of cast spells with verbal components and begin [[Other forms of Harm#Suffocating|suffocating]], as the {{ self.name() }} squeezes the air from the target's lings. This effect lasts until the grapple ends.
```