---
.creature: 
cr: "#CR-1/4"
type: Large [[Beast]]
habitat:
  - "[[Arctic]]"
  - "[[Forest]]"
  - "[[Hills]]"
treasure:
  - None
.stats: 
ac: "12"
hp: "15"
speed:
  - 5 ft.
  - fly 60 ft.
pas_perception: 15
pas_stealth: 14
senses:
  - "[[Darkvision]] 120 ft."
languages:
  - Giant Owl, understands [[Common]], [[Elvish]] and Sylvan but can't speak them
.attributes: 
str_mod: "+1"
dex_mod: "+2"
con_mod: "+1"
int_mod: "-1"
wis_mod: "+1"
cha_mod: "+0"
.effects: 
features:
  - "[[Flyby (Owl)]]"
  - "[[Heightened Hearing and Sight (Owl, Giant)]]"
  - "[[Quiet Wings (Owl, Giant)]]"
  - "[[Talons (Owl, Giant)]]"
.item: 
reference_img: "![[giant-owl.webp|384]]"
source: From **Tales of the Valiant** "Monster Vault" book by **Kobold Press**
.metadata: 
cssclasses:
  - note-statblock
---
```dataviewjs
const { Statblock } = await cJS();
Statblock.display(dv);
```