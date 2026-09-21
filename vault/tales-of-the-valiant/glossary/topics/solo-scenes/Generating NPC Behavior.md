---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
---
# Generating NPC Behavior
```rpg rule.content
id: example
---
_The PC has battled his way through the Canyons of Chron, slaying beast after beast on an alien world to prove his worth to a powerful warlord. He returns triumphant to the warband's encampment and is summoned to the warlord's tent. The warlord, flanked by guards, leans forward in his chair and says...._
```
What does he say? Where do we go from here? You figure out what an NPC does in your adventure the same way you figure out anything else in Mythic: with expectations, Fate Questions, and Meaning Tables.

In the example above, if the Player had a clear expectation for what the warlord would say, they might go with that. "The warlord says he's impressed with your performance."![[hermit-frog-npc.webp|right|384]] If they have some idea but aren't sure, they might frame it as a Fate Question such as, "Does the warlord say he's impressed?" If they had no idea what the warlord would say, they might roll on a Meaning Table for inspiration.

Using expectations for behavior is good for unimportant NPCs or when you don't want to slow down your adventure to randomize NPC actions. If you have an idea of what the NPC will do, and their action is important to the adventure, you could pose the expected action as a Fate Question. This adds some randomness to the NPC's action—you think you know what they'll do but they might do something else.

If you have no idea what the NPC will do then you can roll a completely random action on a Meaning Table. The most useful Meaning Tables for determining NPC actions are:
- Actions
- Characters (Elements)
- Animal Actions (Elements)
- Character Actions, Combat (Elements)
- Character Actions, General (Elements)
- Character Conversations (Elements)
## Expectations As Actions
```rpg figure.mermaid
align: right
width: 40%
caption: Strategy for Generating NPC Actions
---
flowchart TD
    Q1(Do you have an idea of what the<br/>NPC will do?)
    Q2(Do you have a clear idea what the NPC<br/>will do and the action is not<br/>crucial to the adventure?)
    IMPROVISE[USE YOUR<br/>EXPECTATIONS &<br/>IMPROVISE]:::step
    FATE[ASK A<br/>FATE QUESTION]:::step
    DISCOVER[DISCOVER<br/>MEANING WITH<br/>MEANING TABLES]:::step

    Q1 -->|YES| Q2
    Q1 -->|NO| DISCOVER
    Q2 -->|YES| IMPROVISE
    Q2 -->|NO| FATE
    classDef step fill:#cfc6ad,stroke:#000,stroke-width:3px,font-weight:bold;
```
Most NPC actions will be determined by your expectations; you're probably not going to roll for every single thing an NPC does. If Bering the Magnificent is walking through a village market, then his Player will probably assume that the NPCs around him are going about their own business. When you have a clear expectation for an NPC action, and the action isn't important to the course of your adventure, then simply following your expectations will do.
```rpg rule.content
id: example
---
_A warrior PC sits down in a tavern, intent on getting something to eat and questioning the barkeeper for news about the area._

_The barkeeper is a new NPC, but the Player decides their initial action in this encounter is obvious: they come over to the PC's table and say, "What can I get you?"_
```
## Discovering Meaning As Actions
Maybe the Player has no idea what the NPC will do or they want to randomize it. Instead of following their expectations they can use words from Meaning Tables.
```rpg rule.content
id: example
---
The warrior's Player changes their mind and decides to determine the tavern keeper's action using Meaning Tables. Rolling on the Characters Elements Table gets them "Odd" and "Passive." They interpret this to mean that the barkeeper shambles over to the PC and grunts at them, apparently his way of asking the PC what they would like.
```
## Fate Questions As Actions
```rpg rule.side
type: rules
title: KEEP IT LOOSE AND FLOWING
---
You can check for NPC actions as often or as rarely as you like. Maybe you choose to only determine an NPC's first action in an encounter and follow your expectations from there, or maybe you're in a tense confrontation with an important NPC and want to randomly determine the Character's actions round-by-round

If you're frequently asking Fate Questions or consulting Meaning Tables to determine NPC behavior it's important to keep your adventure moving smoothly by taking the broadest interpretations you can. This will help you not get held up on a difficult Interpretation.
```
If you have an expectation for the NPC's behavior that you'd like to test you could ask a Fate Question. This is a good choice if the NPC's actions are important to your adventure or you just want to randomize the behavior.

_The Player decides to test their expectation with a Fate Question. They ask, "Does the barkeeper come to take my order?" assigning Odds of Certain._

When determining NPC actions with Fate Questions choose a behavior the NPC is likely to do. You don't have to be sure about this choice since you're going to test it with a Fate Question anyway.

If you're in the middle of an encounter where the NPC has already taken action you could ask, "Does the NPC keep doing what they're doing?" This is especially useful in tense situations where an NPC's actions matter every round but you don't want to slow down to think about what they 'Il do each time. Instead, you simply check to see if they continue a previous action.
```rpg rule.content
id: example
---
_Bering the Magnificent is facing off against an assassin on the deck of a ship during a rough storm. The Player has a good idea of what the assassin will do, so they ask the Fate Question, "Does the assassin attack Bering with his sword?" with Odds of Nearly Certain. Mythic says Yes, and the battle begins._

_In the next round, the Player wants to see if the assassin continues fighting in this way, so they ask, "Does the assassin continue with his current action?" with Odds of Certain._
```
Phrase the action as a Fate Question and assign it Odds like you would with any other Fate Question. If it's a behavior you expect it's probable that your Odds will at least be Likely if not stronger. If you're unsure then consider the Odds 50/50. If you're really unsure and just taking a shot in the dark with a random behavior you might go with lesser Odds such as Unlikely.

You can resolve these Fate Questions using Mythics normal rules or you can consult the NPC Behavior Table for suggestions on how to handle NPC actions.
### NPC BEHAVIOR TABLE
The NPC Behavior Table offers suggestions for how to interpret Fate Questions about NPC actions.

A Yes answer to a behavior Fate Question is easy to interpret: the NPC either does what you thought they would do or continues to do what they were already doing.

A No answer means the NPC does something other than what you expected. If you have an idea of what that would be you can use that as the action; otherwise, choose a Meaning Table to roll on for inspiration.

An Exceptional Yes means the NPC does what's expected with greater intensity.

_The Player asks the Fate Question "Does the assassin continue with his current action?" Mythic answers with an Exceptional Yes. The Player's interpretation is that the NPC launches himself at Bering in an aggressive attack without taking any defensive precautions._

An Exceptional No means the NPC either does the opposite of what you expected or does the next most expected action with greater intensity. If you don't have any ideas for an expected behavior roll on a Meaning Table for inspiration and make the resulting action more intense.

_A few rounds later Mythic answers Exceptional No to "Does the assassin continue his current action?" The fight hasn't been going well for the assassin, with Bering using magic to fend him off. The Player decides that the opposite of what they expected would be for the assassin to break away from the fight and flee._

If the Fate Question about NPC behavior generates a Random Event consider the Event an additional part of the NPC's actions, with Current Context as the Event Focus and the nature of the action determined by rolling on a Meaning Table. Combine the result with the original action if it makes sense; otherwise, treat them as two separate actions, basing the first action on the result of your Fate Question and the second action on the result of the Random Event.
```rpg rule.content
id: example
---
_When Bering's Player rolled Exceptional No for the assassin's action they also rolled a Random Event. The Player rolls on the "Character Actions, Combat" Elements Table and gets "Charge" and "Lie"._

_The Player decides it makes sense to combine the Random Event with the Fate Question's answer of Exceptional No; the Event will help clarify the NPC's unexpected action. They interpret it this way: the assassin charges at Bering again with a wild battle cry. Bering braces himself for the impact, his mystic barriers up. But just before he reaches Bering, the assassin veers to the side and leaps over the ship's railing. The charge attack was a bluff to make Bering hunker down and give the assassin an opportunity to escape._
```
```rpg table.npc-behavior-table
|FATE QUESTION RESULT|"DOES THE NPC DO X?"|
|---|---|
|YES|The NPC does what you expect or continues with their ongoing action.|
|NO|The NPC does the next most expected behavior. If you're unsure what that is then roll on a Meaning Table for inspiration.|
|EXCEPTIONAL YES|The NPC does the expected action, or continues their ongoing action, with greater intensity.|
|EXCEPTIONAL NO|The NPC does the opposite of what you expected or does the next most expected behavior with greater intensity. If you're unsure then roll on a Meaning Table for inspiration and intensify that action.|
|RANDOM EVENT|Roll on a Meaning Table for an additional action from the NPC.|
[NPC BEHAVIOR TABLE]
```
## Conversations
Saying something is an action, too. When determining what an NPC says in a conversation it's helpful to focus on the overall tone and message the NPC is trying to convey. Like anything in a Mythic adventure, the rules presented here are meant to give you general guidance; the actual words the NPC uses are up to you. Feel free to use creative license as long as their dialog is in line with the result you generated.

_Nemenor, a knight PC, has joined forces with the dragon Gregroth to work against a mutual foe. They're currently traveling together through a forest. As evening draws near the knight asks the dragon where he thinks they should camp for the night._

_The Player frames the expected action as a Fate Question: "Does Gregroth suggest camping next to a pile of boulders?" They don't really know what the dragon will say but this response seems plausible, so they give the Question Odds of 50/50. Mythic returns a Yes._

_Later, after they make camp, Nemenor asks the dragon who should take first watch during the night. The Player asks, "Does Gregroth say he will take first watch?" assigning this Odds of 50/50. Mythic comes back with a No. The Player interprets this to mean the dragon says the knight should take first watch since that seems like the next most expected thing he would say._

If specific language is required (maybe you're playing in a group setting and want to give the interaction more color, or maybe you're writing out your solo session for a blog post or your personal journal), then the Player can use any words that make sense with the rolled results.

_The Player words the first exchange between knight and dragon like this: Nemenor glances at the sky, noting that they have about an hour left until dark. "We should start looking for shelter before nightfall." He turns to the dragon. you have a preferred way to camp in the woods?"_

_Gregroth glances around at their surroundings. "Rocks. I like rocks. Big rocks. Let's find a nice pile of boulders to curl up against, get all warm and cozy."_
## Social Skills
```rpg rule.side
title: GETTING TO KNOW YOU
type: rules
---
The more interactions you have with an NPC during an adventure the more you'll come to understand them. Over time you'll get a feel for what a Character would do or say in any situation, making it easier to determine actions and conversations as you go.
```
If you're using Mythic with an RPG that has social skills you can incorporate skill rolls into your interactions with NPCs. The results of these skill rolls become part of the Context, helping you formulate expectations, adjust the Odds of Fate Questions, and interpret the roll results (including any Meaning Table rolls) to interpret NPC behavior.

For example, maybe your sci-fi spaceship captain is trying to talk another ship into assisting them with repairs, and you roll against your Character's Persuasion skill to get them to cooperate.

Let's say your Character succeeds. In game terms this means you talk the other ship into helping you. If you wanted to use Mythic to play out this interaction in more detail you'd approach it with the knowledge that the other ship's captain will say yes, so whatever results you get from Mythic will have to fit into that Context.

On the other hand, maybe the skill roll indicates that your Character did a good job at presenting their case, but it doesn't guarantee a specific reaction. You may decide that the skill roll results adjust the Odds of the Fate Question, "Do they help us with repairs?", so that while a failed roll would give 50/50 Odds of a Yes a successful roll bumps that up to Very Likely.

You can also use skills to help you decide what an expected behavior would be. Maybe your Character succeeded exceptionally well on their Persuasion roll, and the negotiation is going so smoothly that you think the other ship might not only help with repairs but also join your Character's quest through space. You may use these rolls as the basis for a behavior Fate Question like, "Does the ship captain decide to join us?"

![[et-and-tiger-fight.webp]]
From combat to conversations you can determine NPC actions by using a combination of expectations, Fate Questions, and Discovering Meaning.