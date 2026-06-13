## Characters List
The Characters List is where you record important Non-Player Characters and other active adventure elements as the PC encounters them. It's up to you to decide whether a Character is important enough to make the List, but a good rule of thumb is to add anything or anyone that can influence the adventure.

*The PC starts the adventure with the first mate of his stranded ship, "Tocky McAdams", on the Characters List. Later, when the PC runs afoul of a particularly bad-tempered bird of prey, the Player decides to add "Bertha the Angry Avian" to the List so she's more likely to make another appearance.*
### NON-CHARACTER ELEMENTS
`@[[Character]].bare()`

```rpg feature.gm
name: Thread Check
stack: oracle
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
oracle:
  question: "Does {{thread}} come into play now?"
  chaos: true
  likelihood: 50/50
  roll: d100
example:
  thread: "the cult's hidden patron"
  cf: 5
  rolls: { d100: 22 }
---
Pick the most pressing open thread (or roll randomly across your list) and test
whether it surfaces in the current scene.
```
