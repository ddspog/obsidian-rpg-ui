---
.item: 
type: Certificate
cost: __
weight: __
reference_desc:
- A contract that collects a signature from involved ones to make partnership on some venture, or start an operation.
reference_img: "![[certificate.webp|384]]"
source: Homebrew for needed organization.
.note: 
contents: 
- An empty contract for requesting Lurker's Hall services. It's a kit with pen and paper that fills itself when a quest is requested. It requires the treasure offered to be presented, so the treasure is magically sealed until the quest conclusion and sent back to Lurker's Hall.
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
## Contents
`= join(this.contents, "")`
`= this.reference_img`
**Source**: *`= this.source`*