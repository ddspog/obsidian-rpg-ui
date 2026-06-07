---
.group: 
habitat:
  - Any
treasure:
  - "[[Individual]]"
  - "[[Relics]]"
category: NPC
.metadata: 
cssclasses:
  - note-statblock
---
## Priests
*Arbiters of the Mortal and the Divine*
```tx
| **Habitat**: `=join(this.habitat, ", ")`; | **Treasure**: `=join(this.treasure, ", ")` |
| -------------------- | ----------------- |
[#css/tx/props/row]
```

![[priests.webp]]

Priests harness the power of faith to work miracles. These religious adherents are as diverse as the faiths they follow. Some obey gods and their servants, while others live by age-old creeds. Belief guides priests’ actions and their magic, which they use to shape the world in line with their ideologies.

Roll on or choose a result from the Priest Roles table to inspire different sorts of priests.

|dice: 1d10|Priest Roles: The Priest Is …|
|---|---|
|1|An ascetic who keeps wicked spirits at bay.|
|2|An elder who speaks for the dead.|
|3|An exorcist who hunts wicked spirits.|
|4|A follower of a god no one has heard of.|
|5|A mediator and teacher of traditional ways.|
|6|A philosopher devoted to a concept, multiversal view, or plane of existence.|
|7|The reincarnation of an ancient faith leader.|
|8|A ritualist who uses tinctures and performances to access the divine.|
|9|A shaman whose medicines ease many ills.|
|10|A zealot who wages war for a divine cause.|

^priest-roles

`dice: [[Priests^priest-roles]]`
## Statblocks
```dataviewjs
const { Descriptions } = await cJS();
Descriptions.displayQuery(dv, [
	"012. Worldbuilding/Bestiary/NPCs",
], p => p.group.path.contains("Priests"), "no-t");
```