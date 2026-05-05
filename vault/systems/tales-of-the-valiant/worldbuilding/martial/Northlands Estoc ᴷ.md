---
.item: 
type: "[[Martial]] [[Melee]] Weapons"
cost: 40 gp
weight: 3 lb.
reference_desc:
  - A hand-and-a-half sword designed to pierce heavy armor and sharpened only on the tip, an estoc is 4 feet long, sometimes with a second crossguard. It is said to have been used first by the knights of Vael Turog and Balinor against the elves, but now is used by dwarven mercenaries and human knights who expect to fight other heavily armored warriors. Its anti-armor properties make it popular with monster hunters and dragon slayers as well. Sometimes called the “tuck.” <br/> <br/>
  - Proficiency with a northlands estoc allows you to add your proficiency bonus to the attack roll for any attack you make with it.
reference_img: "![[northlands-estoc.webp|384]]"
source: From **D&D 5e** "Beyond Damage Dice 1" book by **Kobold Press**.
.weapon: 
damage: 1d6/1d8 piercing
properties:
  - "[[Special (Northlands Estoc) ᴷ]]"
  - "[[Versatile]]"
options:
  - "[[Armor-Piercing Thrust ᴷ]]"
  - "[[Blunted Bash ᴷ]]"
.shop: 
cheap: 30 gp
expensive: 60 gp
availability:
  - "[[Exotic]]"
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