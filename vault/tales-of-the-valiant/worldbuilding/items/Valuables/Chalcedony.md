---
.item:
type: Valuable
cost: 100 gp
weight: __
reference_desc:
  - An opaque white gemstone worth 100 gold pieces. <hr/>
  - "![[07. Adventuring Options#^67d03f|clean]]"
  - "![[07. Adventuring Options#^4d0a67|clean]]"
reference_img: "![[chalcedony.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.shop:
availability:
  - "[[Limited]]"
  - "[[Rural]]"
  - "[[Urbane]]"
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
`= this.reference_img`
**Source**: *`= this.source`*