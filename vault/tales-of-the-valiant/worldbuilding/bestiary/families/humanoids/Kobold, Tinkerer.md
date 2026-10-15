---
token: "⚙️"
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**.
---
```rpg stat.monster
name: "Kobold, Tinkerer"
image: "![[kobold-tinkerer.webp|384]]"
type: Small [[Humanoid]]
cr: 1/2
category: "[[Kobolds]]"
habitat: "[[Underground]]"
stats:
  ac: 13 ([[Leather|leather armor]])
  hp: 25
  speed: 30 ft.
  pas_perception: 10
  pas_stealth: 12
  senses: "[[darkvision]] 60 ft."
  languages: "[[Common]], [[Draconic]]"
abilities:
  str: -1
  dex: 2
  con: -1
  int: 4
  wis: 0
  cha: 0
features:
  - ref: "@[[Humanoid Traits]]#Pack Tactics"
  - ref: "@[[Humanoid Traits]]#Sunlight Sensitivity"
  - ref: "@[[Humanoid Traits]]#Multiattack"
    tier: kobold_tinkerer
  - ref: "@[[Humanoid Traits]]#Tinkerer's Hammer"
  - ref: "@[[Humanoid Traits]]#Parts-Filled Sling"
  - ref: "@[[Humanoid Traits]]#Makeshift Ally (1/Day)"
  - ref: "@[[Humanoid Traits]]#Scurry"
```
```rpg rule.related
view: footer
entries:
  - `@[[Kobolds]].highlight().stat()`
```
