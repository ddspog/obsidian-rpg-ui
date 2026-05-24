---
.creature: 
cr: "#CR-2"
type: Large [[Beast]]
habitat:
  - "[[Arctic]]"
treasure:
  - None
.stats: 
ac: 12 (natural armor)
hp: "60"
speed:
  - 40 ft.
  - swim 30 ft.
pas_perception: 13
pas_stealth: 10
resistant:
  - cold
senses:
  - "__"
languages: 
.attributes: 
str_mod: "+5"
dex_mod: "+0"
con_mod: "+3"
int_mod: "-4"
wis_mod: "+1"
cha_mod: "-2"
.effects: 
features:
  - "[[Heightened Smell (Bear, Polar)]]"
  - "[[Multiattack (Bear, Polar)]]"
  - "[[Bite (Bear, Polar)]]"
  - "[[Claws (Bear, Polar)]]"
.item: 
source: From **Tales of the Valiant** "Monster Vault" book by **Kobold Press**
.metadata: 
cssclasses:
  - note-statblock
---
```dataviewjs
const { Statblock } = await cJS();
Statblock.display(dv);
```