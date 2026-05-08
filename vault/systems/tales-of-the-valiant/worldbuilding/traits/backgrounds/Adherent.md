---
.metadata: 
cssclasses:
  - note-feature
---
# Adherent
Before you began adventuring, you committed yourself to a faith, belief, or cause. The exacting tasks required of this commitment—daily prayers, holy rites, or cryptic ceremonies—instilled in you a sense of duty and purpose. 

Perhaps you was a hopeful inductee into the war god’s clergy, a priest excommunicated from a fiend-worshiping sect, or a lifelong member of a secret society with global reach. In any case, you still carry the teachings and traditions of your devotion.
```rpg feature.details
text: |
  **Skill Proficiencies:** Choose two from [[History]], [[Investigation]], [[Religion]], or [[Persuasion]]. 

  **Additional Proficiencies:** Gain proficiency with [[Artist Tools]] and an additional tool of your choice.
traits:
  Tools: 
    - [[Artist Tools]]
choose:
  - type: traits
    category: "Skill P."
    number: 2
    options:
      - [[History]]
      - [[Investigation]]
      - [[Religion]]
      - [[Persuasion]]
  - type: traits
    category: "Tools"
    number: 1
    options:
      - "@worldbuilding/items/tools"
```
**Equipment:** A [[Prayer book ᴺ]] or [[Ceremonial Dagger ᴺ]], a [[Holy Symbol]], [[Incense (one block) ᴺ]], [[Vestments ᴺ]], [[Clothes, common]], and a [[Pouch]] containing 10 gp.
```rpg feature.details
name: Talent
text: |
  You devoted yourself to an array of highly specific tasks and teachings known only to your order, each of which demanded mental and emotional precision. Choose a talent from this list to represent your experience: [[Field Medic]], [[Mental Fortitude]], or [[Ritualist]]. 
choose:
  type: talent
  number: 1
  options:
    - [[Field Medic]]
    - [[Mental Fortitude]]
    - [[Ritualist]]
```
### Adventuring Motivation
Many adherents don’t stray far from the object of their devotion. Those who roam often do so for reasons specific to their order. When you begin your adventures, consider what tempted—or perhaps called—your character to step into the unknown.
```rpg table.adventure-motivation
| d8* | Adventuring Motivation |
| --- | ---------------------- |
| 1 | I can test the limits of my devotion out in the wider world through adventuring. |
| 2 | Adventuring allows me to learn about and report on other religions and orders. |
| 3 | Adventuring frees me to practice more unorthodox methods of worship. |
| 4 | I may find others sworn to my order when I am out adventuring. |
| 5 | Encountering new people while adventuring lets me share my faith with heretics, pagans, and the uninitiated. |
| 6 | When I triumph through adventuring, I will bring glory and notoriety to my order. |
| 7 | Adventuring furnishes me with the tithe my order deserves. |
| 8 | Staying on the move keeps me from being dragged back to the order from which I narrowly escaped. |
|= {{ roll }} =|
```
**Source**: *From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**.*