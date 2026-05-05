---
.item: 
type: "[[Simple]] [[Ranged]] Weapons"
cost: 1 sp
weight: __
reference_desc:
  - Proficiency with a sling allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[sling.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 1d4 bludgeoning
properties:
  - "[[Ammunition]]"
  - ([[Range]] 30/120)
options:
  - "[[Ricochet Shot]]"
.shop: 
cheap: 7 cp
expensive: 2 sp
availability:
  - "[[Rural]]"
  - "[[013. Glossary/Product Availability/Urban]]"
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