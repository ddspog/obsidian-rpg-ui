---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
tab-icon: crosshair
tab-color: var(--color-purple)
---
# Event Focus
When a [[Random Event]] is triggered you need to establish where the action of the Event is focused. This is done by rolling 1d100 on the Random Event Focus Table. The result will point to an aspect of your adventure. For instance, the Event might directly affect a Player Character, or it might introduce a new Non-Player Character.
```rpg table.random-event-focus-table
|1d100|RESULT|
|---|---|
|1-5|Remote Event|
|6-10|Ambiguous Event|
|11-20|New NPC|
|21-40|NPC Action|
|41-45|NPC Negative|
|46-50|NPC Positive|
|51-55|Move Toward A Thread|
|56-65|Move Away From A Thread|
|66-70|Close A Thread|
|71-80|PC Negative|
|81-85|PC Positive|
|86-100|Current Context|
[RANDOM EVENT FOCUS TABLE]
```
For what each result means, see [[Reading the Event Focus]].
```rpg feature.gm
name: Event Focus
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
steps:
  - choice: Remote Event
    calc: "(something happened off-screen the PC only now learns about)"
  - choice: Ambiguous Event
    calc: "(a vague event, neither helpful nor harmful yet)"
  - choice: New NPC
    calc: "@[[Characters]] (a new NPC enters; add to the Characters List)"
  - choice: NPC Action
    calc: "@[[Characters]] (roll the Characters List — that NPC acts)"
  - choice: NPC Negative
    calc: "@[[Characters]] (roll the Characters List — something bad befalls that NPC)"
  - choice: NPC Positive
    calc: "@[[Characters]] (roll the Characters List — something good befalls that NPC)"
  - choice: Move Toward A Thread
    calc: "@[[Threads]] (roll the Threads List — progress on that Thread)"
  - choice: Move Away From A Thread
    calc: "@[[Threads]] (roll the Threads List — a setback on that Thread)"
  - choice: Close A Thread
    calc: "@[[Threads]] (roll the Threads List — that Thread resolves or is nullified)"
  - choice: PC Negative
    calc: "(something bad happens to a Player Character)"
  - choice: PC Positive
    calc: "(something good happens to a Player Character)"
  - choice: Current Context
    calc: "(whatever is happening right now becomes the Focus)"
---
Roll 1d100 on the table above to see where a [[Random Event]] is centered, then resolve the
matching step. (List rolls use a variable section/line die — see [[Lists#Lists as Random Tables]].)
```
# Choosing The Event Focus
When a Random Event is generated you don't always have to roll on the Event Focus Table. If you have a good idea of what the Event Focus should be you can choose that result instead of rolling.
```rpg rule.content
id: example-choosing
---
_The PC, a space adventurer, is in a tight, dramatic spot: caught in a phaser battle in the engine room while the warp drive is spiraling toward a meltdown. The Player asks a Fate Question that generates a Random Event, but with so much already going on having an Event introduce a brand new and potentially unconnected element into the Scene would be more cumbersome than helpful. The Player decides to skip rolling for the Event Focus and instead chooses Current Context to ensure that this Random Event will have something to do with the phaser battle or the engine crisis._
```
`@[[reporters-in-cold-env.webp]].banner(hero)`
```rpg table.choosing-the-event-focus
|EVENT FOCUS|REASON|
|---|---|
|REMOTE EVENT|Your PC is expecting news from afar and now seems like a good time for it to arrive.|
|AMBIGUOUS EVENT|The adventure has slowed and you are ready for a mystery to pursue.|
|NEW NPC|There is a logical reason for a new NPC to appear in your adventure right now.|
|NPC ACTION|Your PC is waiting on the action of NPCs to move the adventure forward.|
|NPC NEGATIVE or NPC POSITIVE|You want to shift the focus of your adventure onto an NPC right now, maybe to develop new storylines in your adventure.|
|MOVE TOWARD A THREAD|Your adventure has stalled and needs a push forward This is especially useful for an Interrupt Scene.|
|MOVE AWAY FROM A THREAD or PC NEGATIVE|You want a new challenge for your PC to face.|
|PC POSITIVE|Your PC is having a hard time and could use a break.|
|CLOSE A THREAD|The adventure has gotten complicated and you want to thin out the Threads List.|
|CURRENT CONTEXT|- The Random Event could help explain a Fate Question result.
|^^|- A Random Event could be disruptive to the current action.|
[CHOOSING THE EVENT FOCUS]
```
## When To Choose The Focus
There are circumstances in an adventure where choosing the Event Focus may make more sense than rolling for it. For instance, in the example above the Player was concerned a new wrinkle in the adventure would disrupt the current Scene so they chose Current Context to have a Random Event that clicked with what was going on.

The Choosing The Event Focus Table gives some situations where you might want to choose a specific Event Focus.

How often you choose instead of roll is your choice as well. If you want to have more narrative control over your adventure you may choose frequently or always. If you want a game with more surprises you may choose rarely or never.

If you want a middle ground approach that allows some limited choice then give yourself one choice every five Scenes. This means you can choose any result on the Event Focus Table for one Random Event within any span of five Scenes. Once spent you have to wait until the next span of five Scenes begins before you get a choice again.
```rpg rule.content
id: example-when-choose
---
_The Player above with the space adventurer was in Scene 4 of their adventure. They hadn't chosen an Event Focus yet so the option was available. After choosing the Focus for that Event the Player won't have the option to choose again until Scene 6 through 10, then again at Il through 15, 16 through 20, and so on._
```
# Empty List
If you don't have anything on your [[Threads]] or [[Characters]] List-perhaps the adventure has only just begun—then some results from the Event Focus Table won't be usable for you. When the Event Focus Table calls for an element from an empty List ignore the roll and treat the Current Context as the Event Focus instead.
```rpg rule.content
id: example-empty
---
_In an adventure set during a futuristic world war, the PC is slowly moving through the snow down a bombed-out street, staying behind cover as much as possible while she searches for activity in the area. The Player asks the Fate Question, "Does she see anyone?"_

_Mythic comes back with Yes and a Random Event. The Player rolls on the Event Focus Table and gets NPC Negative, , but this is the first Scene of the adventure and the Characters List is empty. Since this Event Focus isn't possible, Current Context becomes the Focus instead._
```
![[empty-list-alist-01.webp]]
If a Random Event calls for an NPC you don't have to roll for the section of the Characters List with this List, only the first section has any elements in it. The player would just roll a 1d10 to determine which element is invoked. A roll of 6, for example, would indicate "Jungle".

![[empty-list-alist-02.webp]]
A few Scenes later the Characters List is more built up. When a Random Event happens now that calls for an NPC the player must roll a d4 to determine which section to use since there are now elements in the second section on lines 6 and 7. A roll of 3 on the d4 and a roll of 1 on the d10 would result in "Minga the lizard man" being selected.

![[empty-adventure-list.webp]]
