---
.metadata: 
cssclasses:
  - note-feature
source: Homebrew inspired in **D&D 5e** High Elf and adapted to **Tales of the Valiant**.
---
# Acolyte
Acolyte[^1] heritage characters were raised traveling alongside field agents of an established faction, acting as assistants to these members.

These agents could be part of a noble court, a shadowy organization, or emissaries of a powerful entity, and your formative years were spent constantly assisting them in missions. You learned much from observing and helping these agents, gaining a unique perspective on different cultures, strategies, and tools of the trade.

You also became adept at reading people—understanding their motivations, predicting their actions, and adapting to their behaviors. This skill helped you understand the dynamics of alliances, assist in negotiations, and recognize potential threats. Acolyte characters are adaptive and resourceful, comfortable in many environments, and capable of picking up tricks from those they traveled with.
```rpg feature.details
name: Acolyte Features
view: No Title
passive:
  - name: Arcane Tricks
    text: You are accustomed to adapting quickly. Choose a cantrip from the [[Arcane]] spell list. Whenever you finish a long rest, you may replace one cantrip you know with a different cantrip from the Arcane spell list. This new cantrip lasts until you use this feature again.
  - name: Observant Insight
    text: You have advantage on [[Insight]] checks when dealing with members of a faction you belong or its allies.
spellcasting:
  cantrips: 1
  pool: "[[Arcane]]"  
traits:
  Skill P.: [[Insight]]
  Languages: [[Common]]
choose:
  - type: traits
    category: "Languages"
    number: 2
    options:
      - "@worldbuilding/traits/languages"
  - type: spellcasting
    category: "ability"
    number: 1
    options:
      - CHA
      - INT
      - WIS

---
**_Languages._** You know [[Common]] and two additional languages of your choice. Typical wandering agent heritage characters choose [[Elvish]] and [[Draconic]].
###### Arcane Tricks
You are accustomed to adapting quickly. Choose a cantrip from the [[Arcane]] spell list. Your spellcasting ability for this cantrip is CHA, INT, or WIS (choose during character creation). Whenever you finish a long rest, you may replace one cantrip you know with a different cantrip from the Arcane spell list. This new cantrip lasts until you use this feature again.
###### Observant Insight
You gain proficiency in the [[Insight]] skill if you do not already have it. Additionally, you have advantage on [[Insight]] checks when dealing with members of a faction you belong or its allies.
```
[^1]: Homebrew inspired in the D&D High Elf, but suited for the Campaign.
