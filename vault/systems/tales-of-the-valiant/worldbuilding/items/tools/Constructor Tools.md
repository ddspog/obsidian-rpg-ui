---
.item: 
type: Tool
cost: 10 gp
weight: 8 lb.
reference_desc:
  - "![[05. Equipment & Magic Items#Construction Tools|no-h4 clean]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.notes: 
homebrew: Constructor Tools joins Carpenter's Tools, Mason's Tools and Woodcarver's Tools from D&D rules. So I've joined the tasks section here.
.shop: 
cheap: 7 gp
expensive: 15 gp
availability:
  - "[[Rural]]"
  - "[[013. Glossary/Product Availability/Urban]]"
  - "[[Premium]]"
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
## Homebrew Notes
`= this.homebrew`

**Source**: *`= this.source`*