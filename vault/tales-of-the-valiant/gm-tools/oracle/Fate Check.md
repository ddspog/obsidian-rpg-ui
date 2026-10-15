---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
tab-icon: dice-5
tab-color: var(--color-blue)
---
# The Fate Check
```rpg rule.side
title: THE ART OF INTERPRETATION
type: rules
---
Interpretation is an important part of the emulating process. Mythic answers your Questions, but these answers are merely prompts for you to make sense of.

Often interpretations will come easily. If the Question was, "I open the desk drawer; is there a gun inside?" then a Yes or a No will be clear. Sometimes, though, interpretations elude you, or an answer won't give you enough to interpret. If you feel like you need more information you can try to clarify the answer with another Fate Question. "Is the gun a pistol?" "Is it loaded?"

Be careful not to fall into the trap of asking for more detail than you need. A string of narrow, specific Questions can easily stall the flow of the game. Unless it's something important to the adventure it's generally best to ask a few "big picture" Questions and run with your expectations as far as you can. The goal is to gather just enough information to move things forward.
```
Not everyone likes looking up percentile values on a table. If you'd rather not use the [[Fate Chart]] to answer [[Fate Question|Fate Questions]] you can skip the Chart and use a Fate Check instead. You still roll 2d10, but this time you add the dice together instead of treating them like a percentile. This method of answering Fate Questions can be faster than using the Fate Chart and it matches the Odds fairly closely aside from a higher chance of Exceptional results.
```rpg feature.gm
id: fate-check
name: Fate Check
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
cards:
  - name: Fate Check
    stack: oracle
    rank: 2
    icon: "🎲"
    summary: Ask a yes/no question and roll 2d10 plus the odds and Chaos Factor modifiers — 11 or more is a Yes.
    emits:
      - { oracle: { question: "{{question}}", consult: Fate Check } }
---
The 2d10 alternative to the Fate Chart. Add the dice, apply the Odds and Chaos Factor
modifiers, and read the total against the answers table below: 11 or more is a Yes,
18–20 an Exceptional Yes, 2–4 an Exceptional No, and matching dice at or under the
Chaos Factor also trigger a [[Random Event]].
```
## Adjusts for Odds & Chaos Factor
Like the d100 Fate Chart, a 2d10 Fate Check is modified based on the current [[Chaos Factor]] and the Odds assigned to a Fate Question. The "Fate Check Modifiers" table on the next page breaks down how the Odds and Chaos Factor affect your roll results.

For instance, if you asked a Fate Question with Odds of Very Likely you would apply a +2 modifier to the roll. If the Chaos Factor currently stood at 4, you would apply another modifier of -1. Adding both modifiers together gives a final modifier of +1.

If your next Fate Question had Odds of Nearly Impossible you would get a modifier of -4. Combined with the Chaos Factor modifier of -1 your total modifier is -5.
```rpg table.fate-check-modifiers
|ODDS|ROLL MODIFIER|CHAOS FACTOR|ROLL MODIFIER|
|---|---|---|---|
|CERTAIN|+5|9|+5|
|NEARLY CERTAIN|+4|8|+4|
|VERY LIKELY|+2|7|+2|
|LIKELY|+1|6|+1|
|50/50|None|5|None|
|UNLIKELY|-1|4|-1|
|VERY UNLIKELY|-2|3|-2|
|NEARLY IMPOSSIBLE|-4|2|-4|
|IMPOSSIBLE|-5|1|-5|
[FATE CHECK MODIFIERS]
```
## Fate Check Answers
The "Fate Check Answers" table summarizes what your roll total means. A modified total of 11 or more is a Yes answer, while a total below 11 is a No answer.

As with the Fate Chart, rolling very high or very low will give you an Exceptional answer. If the modified total falls within the 18-20 range then the answer is an Exceptional Yes; if the total falls within the 2-4 range then the answer is an Exceptional No. Your final total must fall somewhere within those ranges to count as an Exceptional result. A modified roll of 18 is an Exceptional Yes, while a modified roll of 22 is a regular Yes. This means modifiers will push your dice total toward those ranges but may also cause the total to exceed them, in which case no Exceptional result occurs.
```rpg table.fate-check-answers
|ROLL TOTAL|FATE QUESTION ANSWER|
|---|---|
|18-20|Exceptional Yes|
|11 or more|Yes
|10 or less|No
|2-4|Exceptional No|
|Doubles, single digit CF or less|Random Event|
[FATE CHECK ANSWERS]
```
## Random Events
Random Events are handled the same way with a Fate Check as they are with the Fate Chart. If both dice come up as the same number (11, 22, 33, etc.), and the single digit value (1, 2, 3, etc.) is equal to or less than the [[Chaos Factor]], then you get a [[Random Event]]. As with the Fate Chart, the result that triggers an Event is still used to answer your Fate Question as well.
```rpg rule.content
id: example-bridge
---
_Safrid the Druid has survived the Dungeon of Galzarad... so far. Now, in his travels through a deep, subterranean cavern, he's come across a rope bridge suspended over a chasm. Using a Fate Check, his Player asks the Fate Question, "Does the bridge look stable?"_

_The Player assigns this Question the Odds of Nearly Impossible (-4 modifier), and the Chaos Factor is currently 6 (+1 modifier), resulting in a final modifier of -3. This means the Player has to roll at least a 14 to receive a Yes answer._

_The Player rolls 2d10 and gets a 3 and a 3. The rolled total is 6 with a -3 modifier for a final result of 3. That's below the target number of 11, so the answer is a No. This result also falls within the 2-4 range, making it an Exceptional No. And since a double number was rolled (3 and 3), and 3 is within the CF value of 6, this Question also results in a Random Event._

_It looks like Safrid may be in for an interesting time trying to get across that bridge._
```
