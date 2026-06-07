---
.group: 
habitat:
  - Any
treasure:
  - "[[Implements]]"
  - "[[Individual]]"
category: NPC
.metadata: 
cssclasses:
  - note-statblock
---
## Scouts
*Watchers and Wanderers*
```tx
| **Habitat**: `=join(this.habitat, ", ")`; | **Treasure**: `=join(this.treasure, ", ")` |
| -------------------- | ----------------- |
[#css/tx/props/row]
```
Scouts are warriors of the wilderness, trained in hunting and tracking. They might be explorers or trappers, or they could perform more martial roles as archers, bounty hunters, or outriders.
## Statblocks
```dataviewjs
const { Descriptions } = await cJS();
Descriptions.displayQuery(dv, [
	"012. Worldbuilding/Bestiary/NPCs",
], p => p.group.path.contains("Scouts"), "no-t");
```