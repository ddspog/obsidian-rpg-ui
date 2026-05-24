---
.item:
type: Scroll
cost: 10 gp
weight: __
rarity: common
reference_desc:
  - "![[05ª. Magic Items Effects#Spell Scroll css/h/item|clean no-h2 no-pt]]"
  - "![[07. Adventuring Options#Scroll Making|clean]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.shop:
cheap: 8 gp
expensive: 15 gp
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
**Source**: *`= this.source`*