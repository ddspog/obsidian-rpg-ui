---
.item: 
type: Tool
cost: 25 gp
weight: 3 lb.
reference_desc:
  - "![[05. Equipment & Magic Items#Charlatan Tools|no-h4 clean]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.notes: 
homebrew: Constructor Tools joins Disguise Kit and Forgery kit from D&D rules. So I've joined the tasks section here.
.shop: 
cheap: 18 gp
expensive: 38 gp
availability:
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