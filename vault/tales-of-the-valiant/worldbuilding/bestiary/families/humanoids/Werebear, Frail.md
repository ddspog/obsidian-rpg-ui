---
source: Homebrew from using NPC Scout statblock and adapting into a Werebear.
aliases:
  - frail werebear
  - Frail Werebear
  - Frail werebear
---
```rpg stat.monster
name: "Werebear, Frail"
type: Medium [[Humanoid]] ([[Shapechanger|Lycanthrope]])
cr: 1
category: "[[Lycanthropes]]"
stats:
  ac: 13 ([[leather|leather armor]]) in humanoid form, 12 (natural armor) in bear of hybrid form
  hp: 36
  speed: 30 ft.
  pas_perception: 13
  pas_stealth: 14
  resistant: bludgeoning, piercing, and slashing damage from nonmagical attacks.
  languages: "any one language (usually [[Common]])"
abilities:
  str: 4
  dex: 0
  con: 3
  int: 0
  wis: 3
  cha: 0
features:
  - ref: "@[[Humanoid Traits]]#Heightened Hearing and Sight"
  - ref: "@[[Humanoid Traits]]#Multiattack"
    tier: scout
  - ref: "@[[Humanoid Traits]]#Shortsword"
  - ref: "@[[Humanoid Traits]]#Shortbow"
  - ref: "@[[Humanoid Traits]]#Escape to Report"
  - ref: "@[[Humanoid Traits]]#change-shape-lycanthrope"
```
```rpg rule.related
view: footer
entries:
  - `@[[Lycanthropes]].highlight().stat()`
```