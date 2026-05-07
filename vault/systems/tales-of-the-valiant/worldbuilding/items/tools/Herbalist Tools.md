---
.item: 
type: Tool
cost: 5 gp
weight: 3 lb.
reference_desc:
  - "![[05. Equipment & Magic Items#Herbalist Tools|no-h4 clean]]"
  - "![[07. Adventuring Options#Potion Brewing|clean]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.notes: 
homebrew: Herbalist Tools joins Herbalism Kit and Poisoner's Kit from D&D rules. So I've joined the craft section here.
.shop: 
cheap: 3 gp
expensive: 8 gp
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