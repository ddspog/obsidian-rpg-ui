---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
tab-icon: crosshair
tab-color: var(--color-purple)
---
# Event Focus
```rpg feature.gm
id: event-focus
name: Event Focus
heading: none
reads: ["@[[Characters]]", "@[[Threads]]"]
generators:
  - id: event-focus
    name: Event Focus
    steps:
      - work: Event Focus
        roll: d100
        table: "@[[Event Focus]]#random-event-focus-table"
        interpret:
          NPC: "[Characters@]"
          Thread: "[Threads@]"
---
When a [[Random Event]] is triggered you need to establish where the action of the Event is focused. This is done by rolling 1d100 on the Random Event Focus Table. The result will point to an aspect of your adventure. For instance, the Event might directly affect a Player Character, or it might introduce a new Non-Player Character.

? Where is this Random Event centered?
gen: Event Focus
```
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
Here's what all the table results mean:
### REMOTE EVENT
```rpg rule.side
title: EVENT FOCUS OVERLAP
type: rules
---
The results of the Event Focus Table are specific about what aspect of the adventure the Random Event is centered around: Player Characters, NPCs, something bad, something good, and so on. However, just because the table indicates what element the Event includes doesn't mean it has to be the only element. There's plenty of overlap between results.

For instance, you might generate a PC Positive. Yay! Something good just happened to your Character, finally. Maybe the good thing that happened is you gained an ally, someone who will help you accomplish your goals.

Well, hold on. Wouldn't that be a Move Toward A Thread or New NPC?

Yes, it would be. You could have rolled any of those for an Event Focus and come up with the same interpretation. Whatever Event Focus you roll is not meant to limit you; it's simply meant to be a starting place that helps you interpret the final result. If that result includes multiple elements from your adventure, then all the better.
```
A Remote Event means that something has happened that your Character wasn't present for; they're only learning about it now. This can happen in many ways.

Maybe the Player Character encounters the dead body of an NPC they met earlier in the adventure, and the Remote Event is this Character's death, which the PC did not directly witness. Or maybe the PC wanders into a tavern and learns by word of mouth that the enemy horde has advanced, destroying the next town down the road.

Remote Events are a way of introducing new twists into an adventure without the PC being directly involved with them.
### AMBIGUOUS EVENT
Most of the Event Focus Table results give you a clear indication of what the Event is about. NPC Action means that an NPC does something; PC Positive means whatever that happens is good for the Player Character. Maybe a Thread is being losed, or maybe a new NPC enters the adventur Whatever it is, its impact on the adventure is clear

An Ambiguous Event, however, is purposefully vague. It's something that happens which is neither harmful nor helpful, at least not initially.

_The PC in a zombie apocalypse adventure is exploring an abandoned building in search of useful items or food. Suddenly, they hear something from the floor above: a bumping and scraping, followed by rhythmic thumps that might be footsteps. Is it a zombie? Another survivor? Maybe it's someone who can help them, or maybe it's just the wind blowing through an open window. The PC doesn't know._

An Ambiguous Event can be interpreted in several different ways. Perhaps the Event is vague, and you won't know whether it's good or bad until you check it out, like in the example above. This makes an Ambiguous Event an opportunity to explore.

![[two-hags-lurking.webp|right|264]]Or perhaps the Ambiguous Event is a new element in your adventure that doesn't make sense now but might make sense later. If your PC comes across a photo of several people while exploring an empty house, is this photo a clue related to what you're searching for, or is it just a random photo with no relevance to your mission? Only time will tell.

In the examples above, the Ambiguous Events don't say anything about the narrative. A random sound, a photo—these are details that may or may not expand into something meaningful later on in the adventure. They might turn out to be significant, or they might turn out to be red herrings or bits of ambiance. Interpreting an Ambiguous Event doesn't require you to figure out what it means; you just have to leave yourself open to the possibilities.

Ambiguous Events can easily turn into narrative foreshadowing. Maybe those animal sounds your PC heard in the woods are the passage of small creatures they'll soon encounter. Maybe that photo you found will come in handy later when you run afoul of a ghost in the house. Keep those ambiguous details in mind in case they fit with future Context and help you interpret later events.

_The PC encounters a man in town he recognizes from the photo he found in the house. After some detective work, the PC discovers that the man killed his own cousin, who is now haunting the mansion. This turn of events—discovering the murderer of the ghost—would not have been possible without first having the Ambiguous Event with the photo._
```rpg rule.side
title: CHARACTER CRAFTING
type: rules
---
If a Random Event calls for a New NPC but you have no idea who or what it could be asking a Fate Question or two can help you figure it out. Alternatively, you can use an Element Meaning Table.

There are Element Meaning Tables for all kinds of things pertaining to NPCs: what they look like, how they act, their background, their motivation, what they say, and more. You can pick and choose which tables seem most pertinent in the moment and use them to get to know the new Character that was just introduced into your adventure.

You'll find more in-depth discussion of the Element Meaning Tables in the Scenes" chapter on page 84.
```
### NEW NPC
A new Non-Player Character enters the adventure. This new Character plays a role in the current Scene and will likely be added to the [[Characters]] List when the Scene is over.

_The PC in a sword-and-sorcery fantasy game is exploring a dungeon. In a Scene where she's checking out a room, the Player gets a Random Event with a New NPC, which they determine to be a giant mutated rat. After a short battle, the Player realizes that there are likely more of these rats in the dungeon, so they add "Giant mutant rats" to the Characters List._
### NPC ACTION
An existing Non-Player Character does something that impacts the adventure. Roll on the [[Characters]] List to see which NPC acts for this Event.
```rpg rule.content
id: example-npc-action
---
_The PC, a zombie apocalypse survivor, is trying to find antibiotics for a sick friend. She's just discovered a pharmacy, and searching through it is the basis for this Scene._

_As the PC cautiously enters the building, the Player asks a Fate Question that generates a Random Event with the Focus of NPC Action. They roll on the Characters List and get "Dillard Gang", a violent group the PC encountered in an earlier Scene that the Player subsequently added to the List. The Player determines that a member of the gang is lurking in the store and ambushes the PC as she approaches the pharmacy counter._
```
### NPC/PC NEGATIVE OR POSITIVE
```rpg rule.side
title: BUT, THEY'RE NOT HERE
type: rules
---
Generating Random Events in Mythic is, well, random. Any NPC you've placed on the Characters List can turn up if the Event Focus calls for it. But what do you do when the Character called upon couldn't possibly be there for that Scene?

When an NPC is invoked for a Random Event, it doesn't necessarily mean that the Character themself is present and active, just that the Event involves them in some way.

For instance, in the example on the previous page, the survivor PC is searching a pharmacy for antibiotics when the Player rolls a Random Event with a Focus of NPC Action that invokes the Dillard Gang. In that case it makes sense that a member of the group would be physically present in the store to cause problems for the PC.

But what if the Player got the same Event Focus result later in the adventure when the PC was flying in a small airplane? Here are a few interpretations that would make sense:
- The pilot has been friendly and helpful up to this point, even offering to fly the PC to a safe place. But now she notices a tattoo on his wrist, the same tattoo that the other Dillards have. He's one of them! The NºC Action in this case is that he's lying to the PC about who he is and what he's doing.
- En route to the PCs destination, the pilot picks up radio chatter from a settlement below. They're being attacked by the Dillard Gang!
- While relaxing on the plane the PC checks through her backpack to see what supplies she has left. To her dismay, the Dillards must have gotten their hands on it during her most recent clash with them because all of her ammo is gone.
```
Something bad or good happens to a Player Character or Non-Player Character, depending on which result you got on the Event Focus Table.

If the Event calls for a PC, determine which PC it is. If you're playing solo with a single Player Character then this Event is automatically about them; if there is more than one Player Character, then choose the one you would most expect this Event to apply to.

If the Event calls for a Non-Player Character, roll on the Characters List to determine which Character it is.

Negative and Positive outcomes of this Random Event can run a gamut of possibilities depending on the Context of the adventure and how you interpret the result. The Positive or Negative Event can be something story-shifting and important, or it can be something minor, as long as you think it's the most expected interpretation of your results.
```rpg rule.content
id: example-pc-negative
---
_An occult investigator PC is trying to rid a manor house of an angry, powerful ghost, but it isn't going well. During a Scene where the PC is trying to banish the ghost with magic, Mythic generates a Random Event with a Focus of PC Negative. The Player is playing the game solo but controlling two Player Characters— the primary investigator Nigel and his assistant Clara—so they have to choose which of them this Event pertains to. They decide that Nigel is probably the target of the Event since he's the one casting the spell._

_The Player interprets this Event to mean that the ghost exerts tremendous supernatural force and pulls the entire house into a nightmare realm where reality is shifting and uncertain. In a later Scene, Nigel and Clara are trying to break down the door to the room where the angry ghost originally died. They believe that this room contains a family painting that's serving as the ghost's anchor to the house, and that if they can destroy it they'll be returned to the normal world._

_Mythic generates another Random Event during this Scene, this time with a Focus of NPC Positive. Rolling on the Characters List, the Player gets Warren, the gardener and caretaker of the mansion whom the PCs met in an earlier Scene but haven't seen for some time. Up until now the Player assumed that Warren must have met an unpleasant end somewhere on the property. They interpret this Event to mean that Warren comes running up the hall after hearing Nigel and Clara's attempt to break into the room. The "positive" for Warren in this case is that he's still alive. Maybe he'll also be of help in getting this door open..._
```
### MOVE TOWARD A THREAD
Threads are the goals and missions that the Player Character is pursuing. This Random Event brings the PC one step closer to resolving an open [[Threads|Thread]]. Roll on the Threads List to see which Thread the Event involves.
```rpg rule.content
id: example-move-toward
---
_The Player Character is a pulp era treasure hunter exploring an ancient pyramid. During this exploration, the Player runs into a Random Event and gets Move Toward A Thread, with the Thread being "Find the ancient tomb of Ank-Tonen."_

_The Player determines that the PC comes across a wall inscribed with a crude map of the pyramid complex, at the center of which is a symbol that can only be the tomb itself. This is a major clue for the PC: it shows her exactly how to get to where she wants to go!_
```
### MOVE AWAY FROM A THREAD
While the previous Random Event helps the Player Character get closer to resolving an open Thread, this Event does the opposite: it represents a new hurdle or setback that hinders the PC's progress toward closing a Thread. Roll on the Threads List to see which Thread the Event involves.
```rpg rule.content
id: example-move-away
---
_The Player Character, a hired mercenary, is tracking a criminal through the jungle when a Random Event comes up with the Event Focus of Move Away from a Thread, in this case, "Capture the escaped criminal". The Player interprets this to mean that the trail has disappeared and there is no sign of the criminal. No tracks in the mud, no broken branches, nothing. The PC must double back to find the trail again, losing valuable time in their pursuit._
```
The Event should make resolving the Thread more difficult but not necessarily impossible; the elimination of a Thread is handled with the next result on the table or through normal role-play.
### CLOSE A THREAD
```rpg rule.side
title: WHY THERE IS NO "NEW THREAD"
type: rules
---
The Random Event Focus Table has three entries pertaining to Threads, including Close A Thread, but no New Thread. Characters have a New NPC entry, so why don't Threads have one as well?

There is no New Thread result because the Threads you follow are decided by you, not the adventure. Mythic will present you with opportunities and ideas for goals to pursue, but it is your choice whether to make any of them a priority.
```
This Random Event brings about the closure of an open Thread. Roll on the Threads List to see which Thread this involves.

Determining how the Thread is closed will require interpretation, but whatever the Event is it should either resolve the Thread or nullify it somehow.
```rpg rule.content
id: example-close-thread
---
_Nigel and Clara, the occult investigators, have succeeded in returning the mansion back to the normal world, but they still need to banish the ghost, find Warren (who's disappeared again), and find the spell that summoned the enraged ghost in the first place._

_While Nigel is rummaging in the cellar, Mythic generates a Random Event with the Focus of Close a Thread. The Player rolls "Find Warren" on the Threads List and interprets this to mean that Nigel hears knocking sounds coming from a large, locked chest. When he opens it Warren pops out, gasping for breath. The ghost locked him in the chest to get rid of him for good. With that goal resolved, the Player removes "Find Warren" from the Threads List._

_In another Scene, while consulting with  a mage, Nigel is informed that tampering with the spell that summoned the ghost would only strengthen its power. He had hoped it would help them banish the ghost but now he knows there's no point in looking for it. The Player removes "Find the spell" from the Threads List._
```
### CURRENT CONTEXT
Whatever is happening in the Scene right now becomes the Focus for this Event. If the Random Event was generated from a [[Fate Question]] then use the [[Context]] of the Fate Question as the Focus. If the Random Event was triggered as a Scene Interrupt then the Event is directly related to whatever is currently going on in your adventure. A Random Event with a Focus of Current Context takes whatever is going on and adds a new layer to it.
```rpg rule.content
id: example-current-context
---
_The Player's gunslinger PC bursts into a barn, expecting to find the bandit he's been pursuing. The Player asks the Fate Question, "Is he in here?" Mythic comes back with a No and a Random Event. The Event Focus Table comes back with Current Context._

_The Player thought this might be a big moment in the adventure—capturing the bandit—but they were wrong. This unexpected letdown is the Context right now and this Random Event will have something to do with that. Depending on the Event Meaning generated, maybe the PC finds a taunting message scrawled on the wall or discovers a bedroll in the corner indicating the bandit had been here but moved on._
```
## Choosing The Event Focus
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
### When To Choose The Focus
There are circumstances in an adventure where choosing the Event Focus may make more sense than rolling for it. For instance, in the example above the Player was concerned a new wrinkle in the adventure would disrupt the current Scene so they chose Current Context to have a Random Event that clicked with what was going on.

The Choosing The Event Focus Table gives some situations where you might want to choose a specific Event Focus.

How often you choose instead of roll is your choice as well. If you want to have more narrative control over your adventure you may choose frequently or always. If you want a game with more surprises you may choose rarely or never.

If you want a middle ground approach that allows some limited choice then give yourself one choice every five Scenes. This means you can choose any result on the Event Focus Table for one Random Event within any span of five Scenes. Once spent you have to wait until the next span of five Scenes begins before you get a choice again.
```rpg rule.content
id: example-when-choose
---
_The Player above with the space adventurer was in Scene 4 of their adventure. They hadn't chosen an Event Focus yet so the option was available. After choosing the Focus for that Event the Player won't have the option to choose again until Scene 6 through 10, then again at Il through 15, 16 through 20, and so on._
```
## Empty List
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
