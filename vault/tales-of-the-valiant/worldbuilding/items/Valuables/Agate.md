---
.item:
type: Valuable
cost: 25 gp
weight: __
reference_desc:
  - An opaque gemstone with various colors but typically with many bands, worth 25 gold pieces. <hr/>
  - "![[07. Adventuring Options#^67d03f|clean]]"
  - "![[07. Adventuring Options#^23ed40|clean]]"
reference_img: "![[agate.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
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