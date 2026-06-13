## Threads List
Threads are the quests, tasks, and missions you choose to pursue through your Player Character. You can make anything into an open Thread at any time by writing it on the Threads List. Once a Thread has been added to the List it becomes an important part of your adventure and will likely be invoked by Random Events.

*The Player's pulp-era sailor, marooned on an island of dinosaurs and strange prehistoric creatures, starts out with the Threads "Find a way off the island" and "Locate missing crewmembers." Later in the adventure, after learning about a magic stone that heals wounds, the Player adds the Thread "Find the mystical stone."*

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
