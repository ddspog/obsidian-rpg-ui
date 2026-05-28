---
.item: 
type: Valuable
cost: 500 gp
weight: __
reference_desc: 
- A small and nice gold bracelet, with matching earrings, worth 500 gold pieces. <hr/>
- "![[07. Adventuring Options#^1c7bba|clean]]"
- "![[07. Adventuring Options#^eb638e|clean]]"
- "![[07. Adventuring Options#^945c11|clean]]"
reference_img: "![[gold-bracelet-earring-set.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
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