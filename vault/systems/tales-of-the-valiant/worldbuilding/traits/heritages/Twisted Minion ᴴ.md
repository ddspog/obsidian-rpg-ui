---
.metadata: 
cssclasses:
  - note-feature
---
# Twisted Minion
Characters of the Twisted Minion heritage were molded under the iron rule of a cruel overlord who fused arcane or alchemical methods into their subordinates. Through invasive experimentation and forced servitude, these unfortunate souls were forever altered in both body and mind.

Though some twisted minions share similarities with typical supplicant communities—collecting resources, fortifying lairs, and living under the thumb of a tyrant—their existence diverges due to the meddling and tampering they endured. Their overlord’s experiments might have granted them bizarre abilities or left them physically changed, reviled by other civilizations. Escaping such torment is no easy feat, but those who manage to slip away must contend with the aftermath of unnatural magic and scars that refuse to fade.

Still, twisted minions can learn solidarity in shared suffering. Within their hidden enclaves, battered creatures bound by trauma might gather, forging pockets of quiet resistance against their overlord. Others betray their overlord from within, leveraging the powers gained through cruel experiments for their own ends. However they live, twisted minions rarely find true peace; lingering remnants of the overlord’s control haunt them, a perpetual reminder of what was done.
```rpg feature.details
name: Twisted Minion Features
text: |
  **_Languages._** You speak [[Common]] and one language typical of your overlord (such as [[Draconic]], Giant, or [[Undercommon]]).
  ###### Augmented
  You were altered by your overlord and grown used to these advantages, learning how to improve on them. You can select enhancements from the **Augmented Enhancements** table on the following pages. You have a total number of points you can spend on these enhancements equal to 5 + your proficiency bonus. Whenever you gain a level, you can choose one of your enhancements and replace it with another one.
buy: 5 + PB
passive:
  name: Augmented
  text: You were altered by your overlord and grown used to these advantages, learning how to improve on them. You can select enhancements from the **Augmented Enhancements** table on the following pages. You have a total number of points you can spend on these enhancements equal to 5 + your proficiency bonus. Whenever you gain a level, you can choose one of your enhancements and replace it with another one.
traits:
  Languages: [[Common]]
choose:
  - type: traits
    category: "Languages"
    number: 1
    options:
      - "@worldbuilding/traits/languages"
```
```rpg feature.choice
parent: Twisted Minion Features
name: Falling Wings
cost: 2
reaction:
  text: When you fall or are falling at the start of your turn, you can use your reaction to stop your fall, sprouting spectral and magic wings and hovering in place for 1 minute or until you become [[incapacitated]] or die. While hovering in this way, you can use your movement to move through the air horizontally or descend.
  max: 1
  recovery: short or long rest
traits:
  Augmented: Falling Wings
```
```rpg feature.choice
parent: Twisted Minion Features
name: Knowledge Implant, Skills
cost: 2
choose:
  - type: traits
    category: "Skill P."
    number: 1
    options:
      - [[Arcana]]
      - [[History]]
      - [[Investigation]]
      - [[Nature]]
      - [[Religion]]
traits:
  Augmented: Knowledge Implant
```
```rpg feature.choice
parent: Twisted Minion Features
name: Knowledge Implant, Languages
cost: 2
choose:
  - type: traits
    category: "Languages"
    number: 2
    options:
      - "@worldbuilding/traits/languages"
traits:
  Augmented: Knowledge Implant
```
```rpg feature.choice
parent: Twisted Minion Features
name: Advanced Metrics Scanner, Initiative
cost: 2
traits:
  Augmented: Advanced Metrics Scanner
  Initiative J.: "[[Initiative]]"
```
```rpg feature.choice
parent: Twisted Minion Features
name: Advanced Metrics Scanner, Skills
cost: 2
choose:
  - type: traits
    category: "Skill P."
    number: 1
    options:
      - [[Insight]]
      - [[Perception]]
traits:
  Augmented: Advanced Metrics Scanner
```
```rpg feature.choice
parent: Twisted Minion Features
name: Guardian Bubble
cost: 3
passive:
  text: You can project and retract a magic bubble around you with eternal breathable air (no action required). You can use this to breath on void, water, and around toxic gas.
traits:
  Augmented: Guardian Bubble
```
```rpg table.augmented-enhancement
|LOCAL|ENHANCEMENTS|COST|DESCRIPTION|
|---|---|---|---|
|Back|Falling wings|2|When you fall or are falling at the start of your turn, you can use your reaction to stop your fall, sprouting spectral and magic wings and hovering in place for 1 minute or until you become incapacitated or die. While hovering in this way, you can use your movement to move through the air horizontally or descend. Once you use this trait, you can’t use it again until you finish a short or long rest.|
|Brain|Knowledge Implant|2|You have proficiency in one of the following skills of your choice: [[Arcana]], [[History]], [[Investigation]], [[Nature]], or [[Religion]]. Alternatively, you can speak, read, and write two additional languages of your choice.|
|Eyes|Advanced Metrics Scanner|2|You have a bionic eye that outputs information about your surroundings. Choose one of the following benefits when you select this trait: you have proficiency in either the [[Insight]] or [[Perception]] skill (your choice), or you can add half your proficiency bonus to your initiative rolls.|
|Neck|Guardian Bubble|3|You can project and retract a magic bubble around you with eternal breathable air (no action required). You can use this to breath on void, water, and around toxic gas.|
[AUGMENTED ENHANCEMENTS #css/tx/table]
```
**Source**: Homebrew based on *Supplicant* from **Tales of the Valiant** "Player's Guide" book by **Kobold Press**, and *Augmented* by **D&D** "Caliya's Chronicle of Runes" book by **Spectre Creations**.