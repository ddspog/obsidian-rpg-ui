---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
aliases:
  - Random Events
tab-icon: dices
tab-color: var(--color-purple)
---
# Random Events
````rpg rule.content
id: summary
---
Although most of your adventure is built upon [[Fate Question|Fate Questions]], Mythic will periodically interject new elements at random. These Random Events allow Mythic to add surprises and plot twists that aren't based in your expectations, guaranteeing that you'll never know for sure what's going to happen next.

Random Events can occur when you ask a Fate Question or when you start a new Scene. They are generated using the [[Event Focus]] Table and the [[Meaning]] Tables. The Event Focus tells you which aspect of the adventure the Random Event involves, while the Meaning Tables give you a pair of words meant to inspire an interpretation of what the Random Event is. If the Event Focus Table gives you "PC (Player Character) Positive", and the Meaning Tables give you the words "attainment" and "travel", you might interpret these words to mean that your post-apocalyptic PC has found a working vehicle, or that your high-fantasy PC has found a possible means of escaping the dungeon they're trapped in.
```rpg table.mythic-adventure-elements
|---|---|---|---|
|FATE QUESTIONS| CHAOS FACTOR| RANDOM EVENTS| SCENES|
|LISTS |MEANING| EXPECTATIONS & INTERPRETATION| YOUR CHOSEN RPG|
[MYTHIC ADVENTURE ELEMENTS @title]
```
````
## Generating Random Events
```rpg figure.mermaid
align: right
width: 40%
caption: Generating Random Events
---
flowchart TD
  A[CONSIDER<br/>CONTEXT]:::step
  B[DETERMINE<br/>EVENT FOCUS]:::step
  C[DETERMINE<br/>EVENT MEANING]:::step
  D[INTERPRET YOUR<br/>RESULTS]:::step

  A --> B --> C --> D
  classDef step fill:#cfc6ad,stroke:#000,stroke-width:3px,font-weight:bold;
```
```rpg feature.gm
id: random-event
name: Random Event
heading: none
reads: ["@[[Characters]]", "@[[Threads]]"]
generators:
  - id: random-event
    name: Random Event
    emits:
      - "@[[Event Focus]]#event-focus"
      - "@[[Event Meaning]]#event-meaning"
cards:
  - name: Trigger a Random Event
    stack: generator
    emits:
      - "@random-event"
      - { event: { text: "{{event}}" } }
---
Once a Random Event has been triggered you need to figure out what happens. There are two components to a Random Event: [[Event Focus]] and [[Event Meaning]]. Both of these components are interpreted through the lens of [[Context]]. Interpret those elements together to get your final result.

? A Random Event fires — what is it?
gen: Random Event
```
