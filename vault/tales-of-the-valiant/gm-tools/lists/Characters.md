## Characters List
```rpg feature.gm
id: characters-list
name: Characters
heading: none
list:
  default: Any Character
  section: 5
  max: 25
cards:
  - name: Roll on Characters
    stack: list
    rank: 2
    icon: "👥"
    summary: Roll on the Characters list to pick who something involves.
    emits:
      - { oracle: { question: "Which Character? [Characters@]" } }
---
The Characters List is where you record important Non-Player Characters and other active adventure elements as the PC encounters them. It's up to you to decide whether a Character is important enough to make the List, but a good rule of thumb is to add anything or anyone that can influence the adventure.

? Default Value [Characters?]

? Adding Values [Characters+ Brian; Alceus; Rodovan; Loki, the old God]

? Weighting a name [Characters+ Brian; Brian]

? Rolling on the List [Characters@ r1=3 r2=1]

? Removing Values [Characters- Alceus; Rodovan]

? Adding more Values [Characters+ Krillian; Tozu; Mio; Radagast; Pyong; Python]

? Rolling on the List [Characters@ r1=3 r2=1]
```
*The PC starts the adventure with the first mate of his stranded ship, "Tocky McAdams", on the Characters List. Later, when the PC runs afoul of a particularly bad-tempered bird of prey, the Player decides to add "Bertha the Angry Avian" to the List so she's more likely to make another appearance.*
### NON-CHARACTER ELEMENTS
`@[[Character]].bare()`
