---
token: 🦎
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**.
token_image: "![[Kobold, A token.webp]]"
---
```rpg stat.monster
name: "Kobold, A"
image: "![[kobold.webp|384]]"
type: Small [[Humanoid]]
cr: 1/8
category: "[[Kobolds]]"
habitat: Any, [[Underground]], [[Urban]]
stats:
  ac: 12
  hp: 9
  speed: 30 ft.
  pas_perception: 8
  pas_stealth: 14
  senses: "[[darkvision]] 60 ft."
  languages: "[[Common]], [[Draconic]]"
abilities:
  str: -2
  dex: 4
  con: -1
  int: -1
  wis: -2
  cha: -1
features:
  - ref: "@[[Humanoid Traits]]#Pack Tactics"
  - ref: "@[[Humanoid Traits]]#Sunlight Sensitivity"
  - ref: "@[[Humanoid Traits]]#Dagger"
  - ref: "@[[Humanoid Traits]]#Sling"
  - ref: "@[[Humanoid Traits]]#Scurry"
```
```rpg rule.related
view: footer
entries:
  - `@[[Kobolds]].highlight().stat()`
```