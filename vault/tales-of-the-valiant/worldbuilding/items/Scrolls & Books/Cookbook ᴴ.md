---
.item: 
type: Book
cost: __
weight: __
reference_desc:
- A book with various old recipes, found during your trips.
source: Homebrew for worldbuilding.
reference_img: "![[cookbook.webp|384]]"
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