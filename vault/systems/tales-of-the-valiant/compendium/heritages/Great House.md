---
.metadata:
  cssclasses: [note-heritage, rpg-ui]
---
# Great House
Characters with the great house heritage have a real, if distant, claim to royal power—or at least to noble authority. The traditions and values of a great house heritage vary by house, for each house and family will cultivate the qualities they wish their scions to exemplify. 

While great houses as organizations might have claims to authority and power in a realm, not all of their members can share in that wealth of station. A great house is made up of not only the house’s main family, which often includes long ancestral lines of marriage and lineage both within the house and without it, but also retainers, servants, serfs, and any number of cousins and extended family. 

Work with the GM to determine the name for the great house, their heraldic symbol, motto, location, and relevance to the campaign setting. How large is the great house, how many retainers, staff, and servants do they have, and how big is its army? These are questions that should be considered, at least vaguely. Does the great house have rivals or enemies that want to see it destroyed or unseated from power? And do they have allies in other great or lesser houses, or are they on their own? A vulnerable house is just the sort of pivot point many great legends start on, spurring heroes on to escape tragedy—or to meet it. 
```rpg feature.details
text: |
  **_Languages._** You know [[Common]] and one additional language. Typical great house heritage characters choose either [[Draconic]] or the primary language of an allied nation.
  ###### Heraldic Studies.
  You gain proficiency in the [[History]] skill. When you make a History check related to your nation of origin, your family, or nobility in general, double your PB for the roll. 
  ###### Noble Pursuits
  You gain proficiency in the [[Persuasion]] skill and with one type of [[Martial]] weapon of your choice. 
passive:
  name: Heraldic Studies
  text: When you make a History check related to your nation of origin, your family, or nobility in general, double your PB for the roll.
traits:
  Languages: [[Common]]
  Skill P.: 
    - [[History]]
    - [[Persuasion]]
choose:
  - type: traits
    category: "Languages"
    number: 1
    options:
      - "@compendium/languages"
  - type: traits
    category: "Weapons"
    number: 1
    options:
      - "@worldbuilding/martial"
```
**Source**: *From **Tales of the Valiant** "Campaign Builder: Castles & Crowns" book by **Kobold Press**.*