---
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**. 
---
```rpg stat.monster
name: "Druid, A"
type: Medium [[Humanoid]] (Any Lineage)
cr: 2
category: "[[Druids]]"
habitat: "Any, [[Urban]]"
stats:
  ac: 11 (16 with [[barkskin]])
  hp: 66
  speed: 30 ft.
  pas_perception: 13
  pas_stealth: 11
  languages: "[[Druidic]], plus any two languages"
abilities:
  str: 0
  dex: 1
  con: 1
  int: 1
  wis: 3
  cha: 0
features:
  - ref: "@[[Humanoid Traits]]#Multiattack"
    tier: druid
  - ref: "@[[Humanoid Traits]]#Flowering Quarterstaff"
  - ref: "@[[Humanoid Traits]]#Poison Bolt"
  - ref: "@[[Humanoid Traits]]#Spellcasting"
  - ref: "@[[Humanoid Traits]]#change-shape-druid"
```
```rpg rule.related
view: footer
entries:
  - `@[[Druids]].highlight().stat()`
```