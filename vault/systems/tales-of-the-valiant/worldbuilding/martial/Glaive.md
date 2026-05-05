---
.item: 
type: "[[Martial]] [[Melee]] Weapons"
cost: 20 gp
weight: 6 lb.
reference_desc:
  - Proficiency with a glaive allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[glaive.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 1d10 slashing
properties:
  - "[[Heavy]]"
  - "[[Reach]]"
  - "[[Two-Handed]]"
options:
  - "[[Trip]]"
  - "[[Disarming Parry ᴷ]]"
.shop: 
cheap: 15 gp
expensive: 30 gp
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
const alt = (page.alt_attacks === undefined || page.alt_attacks === null) ? "" : `
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