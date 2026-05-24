---
.item: 
type: Book
cost: __
weight: __
rarity: Legendary
reference_desc:
- A set of tomes, containing famous metaphysics discussions about the interconnected worlds, the [[Slitters]].
source: Homebrew for worldbuilding.
reference_img: "![[raldrunic-codex.webp|384]]"
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