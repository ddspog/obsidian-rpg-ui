---
.item: 
type: "[[Martial]] [[Melee]] Weapons"
cost: 10 gp
weight: 10 lb.
reference_desc:
  - Proficiency with a maul allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[maul.webp|384]]"
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
.weapon: 
damage: 2d6 bludgeoning
properties:
  - "[[Heavy]]"
  - "[[Two-Handed]]"
options:
  - "[[Bash]]"
  - "[[Disarm]]"
  - "[[Crushing Blow ᴷ]]"
  - "[[Hurling Impact ᴷ]]"
.shop: 
cheap: 7 gp
expensive: 15 gp
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