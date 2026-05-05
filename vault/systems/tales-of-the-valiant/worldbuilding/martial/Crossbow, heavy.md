---
.item: 
type: "[[Martial]] [[Ranged]] Weapons"
cost: 50 gp
weight: 18 lb.
reference_desc: 
- Proficiency with a heavy crossbow allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[heavy-crossbow.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 1d10 piercing
properties:
  - "[[Ammunition]]"
  - ([[Range]] 100/400)
  - "[[Heavy]]"
  - "[[Loading]]"
  - "[[Two-Handed]]"
options:
  - "[[Patient Shot ᴷ]]"
  - "[[Pinning Shot]]"
  - "[[Shrapnel Shot ᴷ]]"
.shop: 
cheap: 38 gp
expensive: 75 gp
availability:
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
````dataviewjs
const [page, links] = [dv.current(), (el) => el.join(", ").replaceAll("|", "\\|")];
const alt = (page.alt_attacks === undefined) ? "" : `
|${page.alt_attacks.join("|\n")}|`;
const table = `
\`\`\`tx
| Damage | Properties | Weapon Options |
| --- | --- | --- |
| ${page.damage} | ${links(page.properties)} | ${links(page.options)} | ${alt}
[#css/tx/table]
\`\`\`
`;
dv.paragraph(table);
````
`= this.reference_img`
**Source**: *`= this.source`*