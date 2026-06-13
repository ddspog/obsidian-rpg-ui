---
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**. 
---
```rpg stat.monster
name: Scout
type: Medium [[Humanoid]] (Any Lineage - [[Ranger]])
cr: 1/2
category: "[[Scouts]]"
habitat: "Any, [[Forest]]"
stats:
  ac: 13 ([[leather armor]])
  hp: 25
  speed: 30 ft.
  pas_perception: 13
  pas_stealth: 16
  languages: "any one language (usually [[Common]])"
abilities:
  str: 0
  dex: 2
  con: 1
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
```
```rpg rule.related
view: footer
entries:
  - `@[[Scouts]].highlight().stat()`
```