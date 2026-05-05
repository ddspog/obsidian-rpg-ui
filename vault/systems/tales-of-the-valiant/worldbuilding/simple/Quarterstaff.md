---
.item: 
type: "[[Simple]] [[Melee]] Weapons"
cost: 2 sp
weight: 4 lb.
reference_desc:
  - Proficiency with a quarterstaff allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[quarterstaff.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 1d6/1d8 bludgeoning
properties:
  - "[[Versatile]]"
options:
  - "[[Bash]]"
  - "[[Vault ᴷ]]"
.shop: 
cheap: 1 sp
expensive: 3 sp
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