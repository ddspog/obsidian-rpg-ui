---
.item: 
type: Book
cost: __
weight: __
rarity: Legendary
reference_desc:
- A set of scrolls, detailing maps, history and geography of the [[Kam]] world.
source: Homebrew for worldbuilding.
reference_img: "![[mebogholtic-scrolls.webp|384]]"
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