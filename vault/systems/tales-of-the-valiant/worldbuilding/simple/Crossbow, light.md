---
.item: 
type: "[[Simple]] [[Ranged]] Weapons"
cost: 25 gp
weight: 5 lb.
reference_desc:
  - Proficiency with a light crossbow allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[light-crossbow.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 1d8 piercing
properties:
  - "[[Ammunition]]"
  - ([[Range]] 80/320)
  - "[[Loading]]"
  - "[[Two-Handed]]"
options:
  - "[[Patient Shot ᴷ]]"
  - "[[Shrapnel Shot ᴷ]]"
.shop: 
cheap: 18 gp
expensive: 38 gp
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