---
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**. 
---
```rpg stat.monster
name: Priest
type: Medium or Small [[Humanoid]] (Any Lineage - [[Cleric]])
cr: 2
category: "[[Priests]]"
habitat: "Any, [[Urban]]"
stats:
  ac: 13 ([[chain shirt]])
  hp: 57
  speed: 30 ft.
  pas_perception: 15
  pas_stealth: 10
  languages: "any two language"
abilities:
  str: 1
  dex: 0
  con: 1
  int: 1
  wis: 5
  cha: 1
features:
  - ref: "@[[Humanoid Traits]]#Divine Blessing"
  - ref: "@[[Humanoid Traits]]#Divine Weapons"
  - ref: "@[[Humanoid Traits]]#Multiattack"
    tier: priest
  - ref: "@[[Humanoid Traits]]#mace-priests"
  - ref: "@[[Humanoid Traits]]#Divine Bolt"
  - ref: "@[[Humanoid Traits]]#Spellcasting"
    tier: priest
---
Priests draw on their beliefs to heal the needful and smite their foes. They can channel their faith as spells and empower their weapons with divine might.
```
```rpg rule.related
view: footer
entries:
  - `@[[Priests]].highlight().stat()`
```