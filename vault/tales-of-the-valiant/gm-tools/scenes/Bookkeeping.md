---
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
---
# End of Scene Bookkeeping
```rpg figure.mermaid
align: right
width: 40%
caption: End of Scene Bookkeeping
---
flowchart TD
    ADD[ADD LIST<br/>ELEMENTS]:::step
    N1(Add new and recurring Threads<br/>and NPCs to their Lists, up to a<br/>maximum of 3 times for a<br/>particular element.)
    REMOVE[REMOVE LIST<br/>ELEMENTS]:::step
    N2(Remove Threads and NPCs that<br/>are no longer relevant to the<br/>adventure.)
    ADJUST[ADJUST THE<br/>CHAOS FACTOR]:::step
    Q("Did the Player Character(s)<br/>mostly control the Scene?")
    DOWN(Chaos Factor -1 to<br/>a minimum CF of 1.)
    UP(Chaos Factor +1 to<br/>a maximum CF of 9.)

    ADD --> N1 --> REMOVE --> N2 --> ADJUST --> Q
    Q -->|YES| DOWN
    Q -->|NO| UP
    classDef step fill:#cfc6ad,stroke:#000,stroke-width:3px,font-weight:bold;
```
It's your call when to end a Scene (as discussed in the "Scene Structure" section on page 63), but usually a Scene ends when the primary action in that Scene wraps up. Before you move on to the next Scene you have a few Bookkeeping tasks to do.
## Add List Elements
The end of a Scene is the time to add Threads and Characters to your Lists if they were active in the Scene. Think about the Scene that just played out and add any Threads or NPCs that seem important to the adventure.

If any Threads or Characters already on a List played a part in the Scene add an additional entry for them as well. This creates weighted Lists that make important elements more likely to reappear in your adventure. Once a specific Thread or NPC has filled three slots on its List don't add any more entries of that element, even if it's important in a later Scene.

You can consider a Thread or Character "important" to the Scene if it was invoked by a Random Event or something meaningful happens in a Scene that involves the Thread or Character.
### THREADS LIST
```rpg rule.side
title: CROWDING OUT THE GOOD STUFF
type: rules
---
While adding lots of Threads that interest you can make for an expansive adventure, there are also good reasons for keeping your Threads List sparse. The more Threads you have, the more options are available for Random Events. You may like having all that potential for plot twists, but if the plot is centered around a single core Thread, those extra plotlines may detract from the focus of your adventure.

Think about the kind of experience you're looking for. If you want something laser-focused on one goal, be more selective about adding new Threads. If you're looking for more of a sandbox approach, add as many Threads as you like, with the knowledge that you may sometimes take significant detours from your primary goal.
```
Threads are goals that your Player Character is pursuing. You can add any Thread to the List that you want, even if it hasn't come up in a Scene.
```rpg rule.content
id: example
---
_Early on in the adventure, the Player Character decides that Bering will take up a quest to return a stolen relic treasured by a poor, remote village. The Player adds "Return relic" as a Thread._

_Later, when Bering emerges from the rat-infested dungeon, the Player decides he needs more healing magic. There are no potion sellers nearby and no one around who can teach him healing spells, so the Player adds "Acquire healing magic" to the Threads List as a goal to pursue._

_A few Scenes after deciding to acquire healing magic, Bering is chatting with a farmer who's tending to a field of cows. Bering has been trailing a group of travelers he suspects of stealing the sacred artifact, so he asks the farmer if he's seen anyone lately. The farmer mentions seeing a local healer who helped him with his livestock. Intrigued, Bering asks for more information and realizes that this mysterious healer may be a wizard._

_This is an important potential lead for Bering to get his hands on healing potions, which reflects one of the Threads. At the end of the Scene the Player writes "Acquire healing magic" for a second time on the Threads List._
```
### CHARACTERS LIST
```rpg rule.side
type: rules
title: NOT WAITING TIL THE END
---
Editing your Lists after the Scene is over means
you don't have to pause the action, but it's not a
bad idea to update them as you play if it doesn't
slow things down too much. Adding or removing
Threads and Characters during a Scene means
those elements will be available sooner for
Random Events; it also makes Bookkeeping easier
since you won't have to think back on the Scene
to remember which Threads and Characters
stood out.

You'll most likely do a combination of the two,
making changes to the Lists as you play and going
over them again at the end of a Scene to make
sure you caught everything.
```
You can add just about anything to the Characters List, from individual NPCs to organizations to geographical areas to objects. If it has some level of activity and can act for or against your PC you can add it to the Characters List.
```rpg rule.content
id: example
---
Bering the Magnificent has come across several different monsters and opponents in the dungeon he's exploring, including giant mutated rats, robed cultists lurking in the shadows, and demonic frogs squatting in stygian pools. The Player has added each of these antagonists to the Characters List. Mutant Rats appear three times on the List because they've featured in many Scenes, while Cultists appear twice and Demon Frogs only once.

After a Scene in which Bering survived a trap, the Player decides that the dungeon itself should be on the Characters List to represent pitfalls, cave-ins, and other nasty surprises.
```
## Remove List Elements
Review your Threads and Characters Lists and remove any elements you feel are no longer relevant to your adventure, (accomplished goals, defeated enemies, etc.). If the irrelevant Thread or Character appears more than once on the List cross out all instances of it.

Removing an NPC doesn't necessarily mean they've died. Characters can exit an adventure for all kinds of reasons, including that you've deemed them no longer important to your adventure. The same is true for Threads: you can remove one simply because you are no longer interested in pursuing it.
```rpg rule.content
id: example
---
_In the swashbuckling adventure with Edward the pirate, the Player has a Thread of "Get vengeance against the dread pirate Victor". Then Edward learns that he wasn't betrayed by Victor at all but by the governor of Capsalon Island-he's been pursuing the wrong villain! The Player removes the now-irrelevant Thread from the List and replaces it with "Bring the governor to justice."_
```
```rpg rule.side
title: CLEANING UP LISTS
kind: callout
type: rules
---
Mythic Lists can get messy over time. Threads get added as you come across new goals, Characters get added as they're introduced, Threads and Characters get additional entries when they come into play again, Threads get removed when they're completed, Characters get removed when they lose relevance ... there's a lot going on in those 25 lines!

If you max out a List with no room for new entries, it's time to clean up. Get a fresh, empty Adventure List sheet and copy over the Threads and Characters you want to keep, with a single entry for each element. For any Threads or Characters with three entries on the original List, give them two entries on the new List. Doing this resets the Lists, decreasing elements that have grown while still retaining weighted importance for the most popular items.

Cleaning up your Lists is a prime opportunity to edit them in other ways as well. If you think a Thread or Character should be removed, go ahead and do it. Maybe a minor Character who appeared early on in the Adventure no longer seems relevant, or maybe there's a Thread you forgot about that you're no longer interested in pursuing.

You can also consolidate less important Characters into a single group entry to free up more space. If you've met an innkeeper, a farmer, and a merchant during your adventure, but none of them have proven to be important, you could combine them into a single entry called "Villagers" on the Characters List.

Your new, revised Lists give your adventure room to continue evolving. If the new List gets full it'll be time to tidy up again.
```
## Adjust The Chaos Factor
```rpg rule.side
type: rules
title: REVERT TOWARD THE MEAN
---
The default rule for the Chaos Factor is to increase it when a Scene wasn't under Player Character control and decrease it when it was. This gives the CF a snowball effect, where crisis begets more crisis and calm begets more calm until something happens to switch things up.

If you prefer, you can flip this concept on its head by reverting toward the mean so that the CF goes up when a Scene goes well for the Player Characters and down when a Scene goes poorly. Instead of a snowball effect, you get a release valve-the more controlled Scenes you have in a row the more things are likely to blow up on the Player Characters; the more things blow up on them, the more likely things are to calm down again. This kind of adventure will have a slightly different feel from the norm, with fewer extreme mood swings as the Chaos Factor gets continually nudged back toward the middle.
```
The final Bookkeeping task is adjusting the Chaos Factor. Think about the Scene that just happened and decide whether you think the Player Character(s) were in control of events—in other words, whether the Scene was a success or a failure for them. Did they make progress toward any of their goals? Did they suffer any setbacks or sidetracks?

Maybe the PC was seriously wounded while navigating a building full of explosive traps, but they still made it through. You might decide that the progress your Character made is more important than the damage they sustained, so the Scene was more in their control than out of it. On the other hand, maybe the PC was forced to retreat back to where they came from, in which case you might decide that the Scene was more out of their control than within it.

A Scene that was mostly within your PC's control gives the CF a -1 modifier, lowering the Chaos of the adventure, while a Scene that was mostly out of their control gives the CF a +1 modifier, raising the Chaos. The CF cannot go below 1 or above 9; any modifiers that would take it beyond that range are ignored.

For alternative methods of adjusting the Chaos Factor check out the sidebars "Revert Toward The Mean" and "Random Chaos" on this page.
```rpg rule.side
kind: callout
title: RANDOM CHAOS
type: rules
---
Another way to handle the Chaos Factor is to skip the process of evaluating how well the Player Character(s) did in a Scene and simply let the dice decide how the Chaos Factor changes. This gives you one less thing to worry about in the Bookkeeping phase.

At the end of a Scene roll a d10. If you roll equal to the current Chaos Factor or less, give it a -1 modifier with a minimum of 1; if you roll more than the Chaos Factor, give it a +1 modifier with a maximum of 9. This detaches the Chaos Factor from the PC's actions, letting it ebb and flow at the whim of the dice.

With this method the tone of your adventure will shift at random intervals based on your Chaos rolls from Scene to Scene. As with Revert Toward The Mean, extreme values will be rare, with the CF more frequently moving back toward the middle.
```