---
.metadata: 
cssclasses:
  - note-feature
---
# Kobold
![[kobold.webp|right|384]] Kobolds are a cunning people with draconic features. Many kobolds believe ancient dragons made kobolds in their likeness, to serve their draconic masters. Cagey and strategic, these diminutive draconic humanoids instinctually seek safety in tunnels and similar enclosed spaces such as collapsed architecture or rubble.

Kobolds display an inborn mechanical aptitude which often manifests as trap-making and tinkering. The crafting of traps became such a monumental part of kobold civilization that those rare kobolds born away from their own people still gravitate toward occupations and hobbies that allow them to craft small, potentially dastardly, creations. Though they can live for decades, a penchant for curiosity claims as many kobold lives as time does.
```rpg feature.details
name: Kobold Lineage Traits
text: |
  Your kobold character has the following hereditary traits. 

  **_Age._** Kobolds reach adulthood in their early teenage years and reach elderly status around the age of 80. Kobolds rarely live to be more than 100 years old.

  **_Size._** Your size is Small. Kobolds are rarely more than 3 feet tall, and tend toward extremes of body weight. However, you can choose to play a rare oversized type of kobold known as a truescale. Truescales stand around 5 feet tall and are Medium size. Your size determines which trait you have access to via the Natural Adaptation feature.

  **_Speed._** Your base walking speed is 30 feet. 

  **_Darkvision._** You have [[Darkvision]] to a range of 60 feet. 

  **_Tinker’s Fascination._** Your innate fascination with how things work allows you to use tools with ease. When you make an ability check with a tool, you can roll a d8 and add the result to the check. 

  **_Natural Adaptation._** You inherited one of the following unique traits, determined by your size.
passive:
  name: Tinker's Fascination
  text: Your innate fascination with how things work allows you to use tools with ease. When you make an ability check with a tool, you can roll a d8 and add the result to the check.
traits:
  Speed: "30 ft."
  Senses: "[[Darkvision]] 60ft."
pick: 1
```
```rpg feature.choice
parent: Kobold Lineage Traits
name: Fierce
text: |
  - **_Fierce (Small)._** When a Large or larger creature you can see within 5 feet of you attacks you, you can use your reaction to attack that creature immediately after its attack. 
reaction:
  text: When a Large or larger creature you can see within 5 feet of you attacks you, you can use your reaction to attack that creature immediately after its attack.
traits:
  Natural Adaptation: Fierce
  Size: Small
```
```rpg feature.choice
parent: Kobold Lineage Traits
name: Pack
text: |
  - **_Pack (Small)._** As a bonus action you may take advantage of the presence of your allies. You gain Advantage on the next attack roll you make this turn against a creature if at least one of your allies is within 5 feet of the creature and the ally can observe the creature and is able to take the Attack action.
bonus:
  text: As a bonus action you may take advantage of the presence of your allies. You gain Advantage on the next attack roll you make this turn against a creature if at least one of your allies is within 5 feet of the creature and the ally can observe the creature and is able to take the Attack action.
traits:
  Natural Adaptation: Pack
  Size: Small
```
```rpg feature.choice
parent: Kobold Lineage Traits
name: Truescale
text: |
  - **_Truescale (Medium)._** Your naturally thick scales provide significant protection. You have a natural AC of 13 + your DEX modifier. In addition, you have resistance to one of following types of damage: acid, cold, fire, lightning, or poison (choose during character creation).
natural_ac: 13 + DEX
choose:
  - type: traits
    category: "Resistance"
    number: 1
    options:
      - Acid Damage
      - Cold Damage
      - Fire Damage
      - Lightning Damage
      - Poison Damage
traits:
  Natural Adaptation: Truescale
  Size: Medium
```
**Source**: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**.