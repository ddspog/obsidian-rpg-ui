---
.item: 
type: Material
cost: __
weight: 5 lb.
reference_desc: 
- There’s much water as you can define it.
reference_img: "![[water.webp|384]]"
source: Homebrew for needed organization.
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