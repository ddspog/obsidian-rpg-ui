---
.item: 
type: Consumable
cost: __
weight: 0.5 lb.
reference_desc: 
- "![[Goodberry#^f36455|clean]]"
reference_img: "![[goodberry.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.metadata: 
cssclasses:
  - note-item
---
```tx
| Type: `= this.type` | Cost: `= this.cost` | Weight: `= this.weight` | `= default(this.rarity, "")` |
| -------------------- | -------------- | ----------------- |
[#css/tx/props/row]
```
`= join(this.reference_desc, "")`
`= this.reference_img`
**Source**: *`= this.source`*