---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
aliases:
  - Interrupt Scenes
tab-icon: zap
tab-color: var(--color-red)
---
# INTERRUPT SCENES
While Altered Scenes play off your expectations, Interrupt Scenes ignore them entirely; anything can happen.

If your Expected Scene becomes an Interrupt Scene, then Mythic derails your expectations to send the narrative in a new and unforeseen direction. You generate an Interrupt Scene the same way you'd generate a Random Event: roll for the Event Focus and Event Meaning, then interpret the results in Context.

*The detective PC investigating the death of his client's husband is about to visit a suspect at his workplace-the next Expected Scene. The Player rolls to test this Expected Scene and gets a 2 Since 2 is less than the current Chaos Factor of 4 an Interrupt Scene will happen instead.*

*To generate a Random Event for the Interrupt Scene, the Player rolls on the Event Focus Table and gets NPC Action. Rolling on the Characters List invokes Ricky No-Thumb, another suspect the detective identified in an earlier Scene. Ricky runs an illegal gambling operation that the victim often visited.*

*The Player rolls on the Actions Meaning Tables to see what Ricky is doing and gets "Disrupt" and "Path". The Player comes up with the following Interruption: The PC heads downstairs from his office to go and pay Johnny Loanshark a visit, but there's someone waiting for him. Leaning against the PC's car door is a large and angry-looking man whom the PC unfortunately recognizes as Ricky No-Thumb.*

This Interruption stopped the Expected Scene from happening and created an entirely new Scene, one that forces the detective into an encounter with another Character. Considering Ricky's hostile demeanor, this Scene will likely lead to new revelations about the relationships between the PC's client, her dead husband, and the suspects in his case.
## Making Connections
Expected Scenes flow together organically: they start as you expect them to and follow the trajectory of the Player Character's actions. If your Character chooses to enter a room and search it, that's the basis for an Expected Scene. If your Character then leaves the room and explores the dungeon further, that's another Expected Scene.

Altered Scenes are close enough to your Expected Scene that they, too, tend to flow together organically. Maybe your Character finishes ransacking a room and leaves to explore the dungeon further, and you get an Altered Scene that you interpret as a monster in the hall.

![[blue-ogre-stabbed.webp|left|384]]Interrupt Scenes disturb that flow of events, so it may not be immediately obvious how it connects to your previous Scene. Keep in mind that this Event is interrupting the expected transition from one Scene to the next. If you take into account how the previous Scene ended and what the Player Character is currently trying to do, you should be able to interpret this new Scene in a way that fits the current Context.

In the example above, the Player Character was about to drop in on a suspect when the Interrupt Scene happened. This Context gives the new Scene a logical tie-in to the adventure.
```rpg feature.gm
name: Interrupt Scene
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
steps:
  - choice: Generate a Random Event
    calc: "(note: pending — Random Event mechanics not yet built)"
---
Imported by the [[Scene Check]] when its roll lands on Interrupt. Stubbed until
the Random Event tool exists.
```
