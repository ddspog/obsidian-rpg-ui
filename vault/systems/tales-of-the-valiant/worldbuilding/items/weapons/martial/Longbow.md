---
.item: 
type: "[[Martial]] [[Ranged]] Weapons"
cost: 50 gp
weight: 2 lb.
reference_desc:
  - Proficiency with a longbow allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[longbow.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 1d8 piercing
properties:
  - "[[Ammunition]]"
  - ([[Range]] 150/600)
  - "[[Heavy]]"
  - "[[Two-Handed]]"
options:
  - "[[Distracting Shot ᴷ]]"
  - "[[Pinning Shot]]"
  - "[[Trick Shot ᴷ]]"
.shop: 
cheap: 38 gp
expensive: 75 gp
availability:
  - "[[Limited]]"
  - "[[Rural]]"
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