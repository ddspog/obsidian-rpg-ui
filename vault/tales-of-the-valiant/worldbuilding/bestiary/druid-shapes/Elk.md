---
.creature: 
cr: "#CR-1/4"
type: Large [[Beast]]
habitat:
  - "[[Forest]]"
  - "[[Grassland]]"
  - "[[Hills]]"
treasure:
  - None
.stats: 
ac: "10"
hp: "15"
speed:
  - 50 ft.
pas_perception: 10
pas_stealth: 10
senses: []
languages: []
.attributes: 
str_mod: "+2"
dex_mod: "+0"
con_mod: "+1"
int_mod: "-4"
wis_mod: "+0"
cha_mod: "-2"
.effects: 
features:
  - "[[Charge (Elk)]]"
  - "[[Ram (Elk)]]"
  - "[[Kick (Elk)]]"
.item: 
reference_img: "![[elk.webp|384]]"
source: From **Tales of the Valiant** "Monster Vault" book by **Kobold Press**
.metadata: 
cssclasses:
  - note-statblock
---
```dataviewjs
const { Statblock } = await cJS();
Statblock.display(dv);
```