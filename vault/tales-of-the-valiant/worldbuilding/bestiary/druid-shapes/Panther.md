---
.creature: 
cr: "#CR-1/4"
type: Medium [[Beast]]
habitat:
  - "[[Forest]]"
  - "[[Grassland]]"
  - "[[Hills]]"
treasure:
  - None
.stats: 
ac: "12"
hp: "15"
speed:
  - 50 ft.
  - climb 40 ft.
pas_perception: 14
pas_stealth: 16
senses:
  - "[[Darkvision]] 60 ft."
languages: []
.attributes: 
str_mod: "+2"
dex_mod: "+2"
con_mod: "+0"
int_mod: "-4"
wis_mod: "+2"
cha_mod: "-2"
.effects: 
features:
  - "[[Heightened Smell (Panther)]]"
  - "[[Pounce (Panther)]]"
  - "[[Bite (Panther)]]"
  - "[[Claw (Panther)]]"
  - "[[Stealthy Hunter (Panther)]]"
.item: 
reference_img: "![[panther.webp|384]]"
source: From **Tales of the Valiant** "Monster Vault" book by **Kobold Press**
.metadata: 
cssclasses:
  - note-statblock
---
```dataviewjs
const { Statblock } = await cJS();
Statblock.display(dv);
```