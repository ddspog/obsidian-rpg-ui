---
.creature: 
cr: "#CR-1/4"
type: Medium [[Beast]]
habitat:
  - "[[Coastal]]"
  - "[[Underwater]]"
treasure:
  - None
.stats: 
ac: 15 (natural armor)
hp: "13"
speed:
  - 30 ft.
  - swim 30 ft.
pas_perception: 9
pas_stealth: 14
vulnerable:
  - bludgeoning
resistant:
  - slashing
senses:
  - keensense 30 ft.
languages: 
.attributes: 
str_mod: "+2"
dex_mod: "+2"
con_mod: "+0"
int_mod: "-5"
wis_mod: "-1"
cha_mod: "-4"
.effects: 
features:
  - "[[Amphibious (Crab)]]"
  - "[[Pincer (Crab, Giant)]]"
  - "[[Pincer Pinch (Crab, Giant)]]"
.item: 
reference_img: "![[giant-crab.webp|384]]"
source: From **Tales of the Valiant** "Monster Vault" book by **Kobold Press**
.metadata: 
cssclasses:
  - note-statblock
---
```dataviewjs
const { Statblock } = await cJS();
Statblock.display(dv);
```