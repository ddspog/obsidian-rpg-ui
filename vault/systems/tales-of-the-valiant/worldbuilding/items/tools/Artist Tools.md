---
.item: 
type: Tool
cost: 10 gp
weight: 5 lb.
reference_desc:
  - "![[05. Equipment & Magic Items#Artist Tools|no-h4 clean]]"
  - "![[07. Adventuring Options#Scroll Making|clean]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.notes: 
homebrew: Artist Tools joins Caligrapher's supplies and Painting tools from D&D rules. So I've joined the craft and tasks section here.
.shop: 
cheap: 3 gp
expensive: 8 gp
availability:
  - "[[013. Glossary/Product Availability/Urban]]"
  - "[[Premium]]"
.metadata: 
cssclasses:
  - note-item
banner: "![[test-artist-tools.webp]]"
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