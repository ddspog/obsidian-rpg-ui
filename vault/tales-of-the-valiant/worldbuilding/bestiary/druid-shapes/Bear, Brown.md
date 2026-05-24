---
.creature: 
cr: "#CR-1"
type: Large [[Beast]]
habitat:
  - "[[Arctic]]"
  - "[[Forest]]"
treasure:
  - None
.stats: 
ac: 11 (natural armor)
hp: "44"
speed:
  - 40 ft.
  - climb 30 ft.
pas_perception: 13
pas_stealth: 10
senses:
  - "__"
languages: 
.attributes: 
str_mod: "+4"
dex_mod: "+0"
con_mod: "+3"
int_mod: "-4"
wis_mod: "+1"
cha_mod: "-2"
.effects: 
features:
  - "[[Heightened Smell (Bear, Polar)]]"
  - "[[Multiattack (Bear, Brown)]]"
  - "[[Bite (Bear, Brown)]]"
  - "[[Claws (Bear, Brown)]]"
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