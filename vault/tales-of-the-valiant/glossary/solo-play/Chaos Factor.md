---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
aliases:
  - CF
  - Chaos Factors
tab-icon: activity
tab-color: var(--color-orange)
---
# Chaos Factor
```rpg rule.content
id: summary
---
A good GM knows when to ramp up the tension and when to ease off and let the players catch their breath. This ebb and flow of action is a crucial part of any adventure and it rarely stays the same throughout.

The Chaos Factor is Mythic's way of simulating this changing tempo. It uses a value between 1 and 9 to measure how much control the PC has over the action. The higher the value the more Mythic generates active elements such as [[Random Event|Random Events]], unexpected Scenes, and Yes answers to [[Fate Question|Fate Questions]].
```
## The Chaos Factor
```rpg figure.mermaid
align: right
width: 40%
caption: Chaos Factor Values
---
flowchart TD
    HIGHER["Higher Values:<br/>• More Yes Answers<br/>• More Random Events<br/>• More Unexpected Scenes"]:::higher
    CHAOS["CHAOS FACTOR<br/>STARTS AT 5"]:::step
    LOWER["Lower Values:<br/>• More No Answers<br/>• Fewer Random Events<br/>• More Expected Scenes"]:::lower

    HIGHER <--> CHAOS <--> LOWER
    classDef step fill:#cfc6ad,stroke:#000,stroke-width:3px,font-weight:bold;
    classDef higher fill:#fff,stroke:#e11d1d,stroke-width:3px;
    classDef lower fill:#fff,stroke:#1a356b,stroke-width:3px;
    linkStyle 0 stroke:#e11d1d,stroke-width:6px;
    linkStyle 1 stroke:#1a356b,stroke-width:6px;
```
The Chaos Factor is a value tracked throughout the adventure that represents how much control the Player Characters have over current events. The more out of control Scenes get, the higher the Chaos Factor will climb; the higher the Chaos Factor, the greater your chance of getting a Yes response to Fate Questions. The Chaos Factor also determines the frequency of Random Events and how often Scenes begin as expected.

At the start of a new adventure the Chaos Factor is set to 5. A Scene that was chaotic and out of control increases the Chaos Factor by 1 point, while a Scene in which the Player Characters were mostly in control decreases it by 1. The value cannot drop below 1 or rise above 9; results that would push it beyond those limits are ignored.

We'll talk more about the ebb and flow of the Chaos Factor in the "Scenes" chapter.

The Chaos Factor has a big influence on the percentile chance of your Fate Question being a Yes. When consulting the [[Fate Chart]], cross-reference your chosen Odds on the left of the Chart with the current Chaos Factor at the bottom. The point at which these two intersect on the Fate Chart is the chance of your Fate Question being a Yes.
```rpg rule.content
id: example-occult-cf
---
_The occult investigator is searching the library for tomes of forbidden lore. The Player has determined that the Odds of finding such tomes are Likely. After all, this is the personal library of the mad mage Angus McGregor. The only reason they aren't assigning higher Odds is because the mage would probably keep his best books in a hidden location._

_Things have been fairly calm in the last few Scenes, with the Character maintaining control for the most part, so the Chaos Factor currently sits at a value of 3. Comparing the Odds of Likely to the current Chaos Factor, the Player determines that there is a 35% chance of finding a tome of magic sitting on one of the shelves._
```
`@[[octopus-lurking-around-snowwoman.webp]].banner(hero)`
### Shifting Tone
```rpg rule.side
title: Questionable Chaos
type: rules
---
The Chaos Factor is a major influence on the answers to Fate Questions. While this is meant to vary the tone throughout the adventure, you can adjust the Chaos Factor's influence to suit your tastes. Check out "Choose Your Chaos Flavor" in the "Variations" chapter on page 147 for variant rules that change how much power the Chaos Factor exerts.
```
A live Game Master isn't going to maintain the same tone throughout an adventure; there are times they'll want to push more action and times they'll want to dial it back. The Chaos Factor shifts throughout your adventure to simulate a GM shifting the tempo while running a game.

Since Yes answers to Fate Questions tend to be more action oriented, they become more and more likely the higher the Chaos Factor climbs. Higher Chaos also means higher chances of Random Events and a greater likelihood that your Scenes will start in unexpected ways; these aspects of the Chaos Factor are discussed more in the "Random Events" and "Scenes" chapters, respectively.

Here's an example of how the Chaos Factor influences Fate Questions to regulate the atmosphere of a game:
```rpg rule.content
id: example-safrid
---
_The Player Character Safrid, a high fantasy druid, has been exploring a dungeon. Safrid has handled the dungeon's various perils well so far, and the Chaos Factor has fallen to 4._

_Suddenly, he comes across a Bog Beast, a truly terrifying creature! The battle doesn't go well, and he retreats, fleeing from the monster to relative safety. This Scene was a mess for Safrid; the PC definitely wasn't in control. The Chaos Factor goes up to 5._

_In the following Scene, as Safrid flees, he runs afoul of a trap in the dungeon and barely escapes it with his life. Once again, this is a Scene where Safrid had difficulty dealing with trouble. The Chaos Factor goes up again to 6._

_The higher Chaos Factor means Safrid faces greater chances of active elements during the adventure. Is there a trap in this room? Yes. Is the door locked at the end of the hall? Yes. Is the Bog Beast still chasing him? Yes. Chaotic conditions in each Scene encourage more chaotic conditions in following Scenes, creating a snowball effect where the tension slowly increases and the Chaos Factor continues to rise._

_Eventually, Safrid gets a handle on things again. He finds a place to rest; he prepares for the Bog Beast and defeats it; he finds a potion that heals some of his wounds. The Character is facing the challenges of the adventure head-on and overcoming them. This control over the adventure reverses the rising tension, and things calm down as the Chaos Factor falls to 4, 3, and even 2._

_The lower Chaos Factor starts to have the opposite effect from before: now that things are calm in the adventure, and the Chaos Factor is low, No answers to Fate Questions are more common._

_When the Character is in control, No answers tend to be negative for them. Is there treasure in the chest? No. Does he have any food left? No. Now the lower Chaos Factor is working against Safrid; this encourages the pendulum to start swinging back the other way, setting the stage for future challenges that the character may face._
```
Not every Scene or Fate Question follows these assumptions exactly, but when you look at the course of an adventure as a whole they tend to hold true. The overall result is that the Chaos Factor shifts the tone of the adventure so you never get too comfortable or too sure of exactly how things are going to unfold.