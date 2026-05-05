---
cssclasses:
  - note-feature
  - rpg-ui
---
# Ritualist
```rpg feature.details
subtitle: "Prerequisite: Spellcasting class feature"
text: |
  Your study of magic has unlocked the mysteries of ritual spells. When you gain this talent, you also gain a ritual book, which contains the rituals you know. To cast a ritual spell, you must have your ritual book in hand.

  Choose a spell source: [[Arcane]], [[Divine]], [[Primordial]], or [[Wyrd]]. You must choose your rituals from that source's spell list. Regardless of which source you choose, you use your normal spellcasting ability for these spells.

  When you gain your ritual book, add one ritual of each spell circle you have already unlocked via your spellcasting class. For example, a [[Cleric]] who selects this talent at 4th level has spell slots for 1st and 2nd circles, so they would add one 1st-circle ritual and one 2nd-circle ritual to their book.

  Each time you gain access to a new circle of spell slots by gaining a level in your spellcasting class, add one new ritual spell to your book. This new ritual must be from the same circle of magic you originally chose, and it must be of a circle for which you have spell slots. For example, when a cleric reaches 5th level, they gain access to 3rd-circle spells, so the cleric would select one ritual spell of 3rd circle or lower to add to their ritual book.
passive:
  text: |
    Your gained a *ritual book*, containing the rituals of a spell source you chose. You must have it in hand to cast those rituals, using your normal spellcasting for them. The book start with one ritual of each spell circle you have already unlocked via your spellcasting class.

    Each time you gain access to a new circle of spell slots by gaining a level in your spellcasting class, add one new ritual spell to your book. You can copy the book to a backup, like a wizard, and if you lose the book you can write a new one. Copy spells until you reach one for each spell slot you have available.
choose:
  type: spellcasting
  category: "list"
  number: 1
  options:
    - [[Arcane]]
    - [[Divine]]
    - [[Primordial]]
    - [[Wyrd]]
spellcasting:
  ritual:
    circle_1: 1
    circle_2: 1
    circle_3: 1
    circle_4: 1
    circle_5: 1
    circle_6: 1
    circle_7: 1
    circle_8: 1
    circle_9: 1
```

**Source**: _From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**_
