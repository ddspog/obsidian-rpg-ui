---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
tab-icon: dice-6
tab-color: var(--color-blue)
---
# The Fate Chart
The Fate Chart on the following page is used to determine the percentile chances of your [[Fate Question|Fate Questions]] receiving a Yes answer. Along the left side are probability descriptors (Impossible, Likely, Nearly Certain, etc.), and along the bottom is the [[Chaos Factor]].

When asking a Fate Question, decide what you think the Odds are of the answer being Yes. This is a gut decision based on the Question you're asking and the [[Context]] you're asking it in. The Fate Chart's Odds uses common language such as Likely or Impossible to judge probability.
```rpg rule.content
id: example-occult
---
_Let's say the Player Character is an occult investigator searching a library for tomes of magic. The Player decides to make this search into a Fate Question: "Does he find any tomes?"_

_Maybe at this point in the adventure the PC has come across strange magic and supernatural events, and he knows that the library he's searching through once belonged to a sorcerer and occultist. Given this Context the Player assigns this Question the Odds of Likely._

_On the other hand, maybe the original owner of the library is unknown but the Player suspects they might have been involved in magic. This Context is different from the previous one: there's less evidence that books of magic would be present. Given this Context the Player assigns the Odds of 50/50._
```
```rpg table.fate-chart
@wide
|---|---|---|---|---|---|---|---|---|---|
|Certain|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|$^{20}\;99\;^{x}$|$^{20}\;99\;^{x}$|$^{20}\;99\;^{x}$|
|Nearly Certain|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|$^{20}\;99\;^{x}$|$^{20}\;99\;^{x}$|
|Very Likely|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|$^{20}\;99\;^{x}$|
|Likely|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|$^{19}\;95\;^{100}$|
|50/50|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|$^{18}\;90\;^{99}$|
|Unlikely|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|$^{17}\;85\;^{98}$|
|Very Unlikely|$^{x}\;1\;^{81}$|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|$^{15}\;75\;^{96}$|
|Nearly Impossible|$^{x}\;1\;^{81}$|$^{x}\;1\;^{81}$|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|$^{13}\;65\;^{94}$|
|Impossible|$^{x}\;1\;^{81}$|$^{x}\;1\;^{81}$|$^{x}\;1\;^{81}$|$^{1}\;5\;^{82}$|$^{2}\;10\;^{83}$|$^{3}\;15\;^{84}$|$^{5}\;25\;^{86}$|$^{7}\;35\;^{88}$|$^{10}\;50\;^{91}$|
|---|---|---|---|---|---|---|---|---|---|
|{{ axis Odds / Chaos Factor }} @header @highlight-cross @compact @middle-row|1|2|3|4|5|6|7|8|9|
|---|---|---|---|---|---|---|---|---|---|
|= {{ oracle dice=d100 answers="Exceptional Yes | Yes | No | Exceptional No" }} =|
|---|---|---|---|---|---|---|---|---|---|
[FATE CHART @title]
```
```rpg feature.gm
id: fate-chart
name: Fate Chart
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
oracle:
  question: '{{question}}'
  chaos: true
cards:
  - name: Fate Question
    stack: oracle
    rank: 1
    icon: "🔮"
    summary: Ask a yes/no question, pick its odds, and roll d100 — the answer comes from the roll and the current Chaos Factor.
    emits:
      - { oracle: { question: "{{question}}", consult: Fate Chart } }
---
Mythic's core oracle. Ask a Yes/No [[Fate Question]], judge the Odds, then read the
cell where your Odds row meets the current [[Chaos Factor]] and roll d100 against it.

? [CF:3] Does he find any tomes of magic?
-> Yes (d100=35)
```
## Choosing Odds
````rpg rule.side
title: ASKING THE RIGHT QUESTIONS
type: rules
---
Mythic relies on Fate Questions to construct the narrative of the adventure as you play; what you ask and how you ask it will influence your game. While it's best to phrase Fate Questions as naturally as possible, there are a few guidelines you should keep in mind.
```rpg rule.side
title: Action Oriented
kind: spread
---
The Chaos Factor assumes that Yes answers are typically more active than No answers, so you'll get the best results if your Fate Questions focus on active and interesting elements. "Are there zombies outside?" is better than "Is it all clear outside?"
```
```rpg rule.side
title: Guided By Expectations
kind: spread
---
It's generally best to let your Questions be guided by your expectations rather than your desires. A party of adventurers prowling down a dungeon hall might easily ask, "Do we hear anything?" but it would make little sense to ask, "Do I look down and see a Vorpal Blade of Instant Murder at my feet?" The current Context offers no logical expectation to prompt the second Question, but it does for the first.
```
````
Who determines the Odds of a Fate Question? Well, if you're playing solo, then you do. If you're playing with a GM, then they do. If you're playing with a group then the Players must all reach a consensus on how the Odds are chosen.

Your choices start in the middle at 50/50. These are the Odds to choose if you think there's roughly a 50% chance of getting a Yes answer, or if you have no idea of the probability. Odds range upward from 50/50 to Likely, Very Likely, Nearly Certain, and Certain, and downward from 50/50 to Unlikely, Very Unlikely, Nearly Impossible, and Impossible.

You may wonder at the Certain and Impossible Odds. After all, if something is impossible or certain then it's a foregone conclusion, right?

Not necessarily. The Odds are based on what you think they should be at the current moment, and that opinion is based on the Context of the adventure. Allowing some wiggle room in the results of extreme Odds acknowledges that what you and your PC know about the adventure is not absolute. Something may seem certain or impossible, but unfolding events can still prove us wrong about what we thought we knew.

Extreme Odds can also become more or less likely based on the Chaos Factor. When the narrative is in high gear the impossible can become probable for the sake of keeping tension and excitement high.
```rpg table.example-odds
|Odds|Description|"Is the Creature Hostile?"|"Will this Abandoned Car Start?"|"Does the guard Help Us?"|
|---|---|---|---|---|
|**Certain**|You're as sure of this as you can be.|It's stated its intent to destroy us and looks ready to do so.|It was driven here just a moment ago.|He is an ally. pursuing the same goals as us.|
|**Nearly Certain**|You're quite sure, but there is some doubt.|We've been fighting this thing all day.|We saw the vehicle operating a few hours ago.|He's helped us before and is sympathetic to our goals.|
|**Very Likely**| It's quite likely, although far from sure.|It's armed, angry, and actively threatening.|There's signs of recent use, and it looks to be in good shape.|We're on the same team, of course he'll help.|
|**Likely**| It's slightly more likely than 50/50.|It's armed and angry.|The car appears to be in working order.|He seems to be on our side. I think?|
|**50/50**| It can go either way, or you have no idea.|It's a new encounter, we'll have to see.|We just found this vehicle. Maybe it works?|You don't know whose side he's on. Cross your fingers.|
|**Unlikely**|It's slightly less likely than 50/50.|It's unarmed and uninterested in us.|The vehicle looks a little rough.|He hasn't been too friendly.|
|**Very Unlikely**|It's quite unlikely, but possible.|It looks docile. It doesn't seem to mind our presence.|The vehicle is a mess. It looks like it hasn't moved in a while.|He's been hostile. I doubt he would risk helping us.|
|**Nearly Impossible**|There might still be a chance.|We've seen these creatures before. They've all been peaceful.|The vehicle has lots of visible damage and is a mess.|This guy is doing his job, he doesn't care about our mission.|
|**Impossible**|There's no way, unless I'm wrong about something.|These creatures have always been peaceful. This one seems tame.|This thing is a wreck. It would be a miracle if it started.|He's a true believer in our enemy.|
[EXAMPLE ODDS]
```
## The Chaos Factor
`@[[Chaos Factor#The Chaos Factor]].bare()`
## Using the Fate Chart
You have your Question, you have your Odds, you know the Chaos Factor; now it's time to consult the Fate Chart. Cross reference the determined Odds with the current Chaos Factor to get the probability of a Yes answer to your Fate Question.

You'll notice that the values in the Fate Chart are expressed with a large central number flanked by smaller numbers on both sides. The central number is the percentile chance of a Yes answer. Roll 1D100 and compare the result to this value. If you roll within the value, then the answer is Yes; if you roll above it, then the answer is No.

By rolling very low or very high you can achieve Exceptional results. The smaller numbers to the left and right of the central number represent the extreme 20% of the Yes and No ranges, giving you a 1 in 5 chance of a Yes or No answer being Exceptional. Rolling equal to or less than the left-hand number is an Exceptional Yes; rolling equal to or higher than the right-hand number is an Exceptional No. A value of "X" means an Exceptional result is not possible with those Odds.

![[values-on-fate-chart.webp]]

Values on the Fate Chart are expressed with a central, large number showing the percentage chance of a Yes answer. Rolling 1d100 equal to or less than this number is a Yes answer. Rolling equal to or less than the number on the left, the lower 20% of the Yes answer range, is an Exceptional Yes. Rolling above the central number is a No, and rolling equal to or above the rightmost number is an Exceptional No. In the cutout above, a roll of 1-10 would be an Exceptional Yes, 11-50 a Yes, 51-90 a No, and 91-100 an Exceptional No.
# Fate Chart Answers
Mythic will yield one of four responses to a [[Fate Question]]: Yes, No, Exceptional Yes, or Exceptional No. This gives you four possible paths of interpretation.
```rpg table.fate-question-answers
|ANSWER|RESULT|
|---|---|
|YES|The answer is Yes, confirming your expectation.|
|EXCEPTIONAL YES|The answer is Yes, confirming your expectation and beyond.|
|NO|The answer is No. Go with the next most expected outcome.
|EXCEPTIONAL NO|The answer is the opposite of a Yes, or the opposite of a Yes intensified.|
[FATE QUESTION ANSWERS]
```
## Yes
A Yes response to a Fate Question means the answer is your Expectation of what a Yes would mean. This is the most straightforward of the possible answers and likely won't require much interpretation.
```rpg rule.content
id: example-yes
---
_"Is the door locked?" Yes, the door is locked. "Does the black hole begin to suck us in?" Yes, the black hole is sucking you in. "Is the gladiator armed with a sword?" Yes, he's armed with the kind of sword you'd expect._
```
## No
A No response to a Fate Question means the answer is the next most Expected outcome from what a Yes would have meant. With simple Questions, a No may be the opposite of a Yes and therefore easy to interpret; a complex Question might require more interpretative legwork.
```rpg rule.content
id: example-no
---
_"Is the door locked?" No, it's unlocked. "Does the black hole begin to suck us in?"'No, you're fine for now. "Is the gladiator armed with a sword?" No, he's armed with a spear._
```
## Exceptional Yes
An Exceptional Yes is the same as a Yes but intensified, meaning you take your Yes answer to the next logical level.
```rpg rule.content
id: example-exc-yes
---
_"Is the door locked?" Yes, and it's a darn good lock. "Does the black hole begin to suck us in?" Yes, and the stressors are causing damage all across the ship. "Is the gladiator armed with a sword?" Yes, a huge greatsword._
```
## Exceptional No
An Exceptional No is the opposite of a Yes answer. If that would be the same as a regular No, then it's the opposite of a Yes intensified.
```rpg rule.content
id: example-exc-no
---
_"Is the door locked?" No, in fact the door is partially open. "Does the black hole suck us in?" No, you're actually moving away from it. "Is the gladiator armed with a sword?" No, he's not armed at all._
```
## Random Events
One consequence of asking Fate Questions is inviting a [[Random Event]] to occur. When rolling d100 to answer your Question, if you get a double number (11, 22, 33, etc.), and the single value of that number (1, 2, 3, etc.) is equal to or less than the current [[Chaos Factor]], then you've triggered a Random Event. We'll delve more into Random Events in the next chapter.