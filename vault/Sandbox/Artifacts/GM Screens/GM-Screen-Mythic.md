# GM Screen — Mythic GME

A solo-play GM Screen. Each `rpg feature.gm` block becomes a card on the GM
side of a session log that links this file via `gm: "[[GM-Screen-Mythic]]"`.

```rpg feature.gm
name: Scene Check
oracle:
  question: "Does {{scene}} occur?"
  chaos: true
generator:
  name: Testing the Expected Scene
  roll: d10
  vs: CF
  work: Alterations
  interpret:
    ">CF": Expected Scene
    "<=CF, even": Altered Scene
    "<=CF, odd": Interrupt Scene
scene:
  opens: "S{{n}} {{title}}"
example:
  scene: "the ambush at the rockslide"
  cf: 5
  rolls: { d10: 8 }
  n: "01"
  title: "After the Landslide — the road north lies buried."
---
Test whether the expected scene plays out as you imagined.
```

```rpg feature.gm
name: Fate Question
oracle:
  question: "{{question}}"
  chaos: true
  likelihood: likely
  roll: d100
---
A yes/no question resolved on the Fate Chart against the current Chaos Factor.
```

```rpg feature.gm
name: Perception Check
roll:
  name: Perception
  die: d20
  vs: "DC 12"
  interpret:
    ">=12": Success
    "<12": Failure
```

```rpg feature.gm
name: Weather
table:
  source: "@[[Tables/Weather]]"
  die: d6
```

```rpg feature.gm
name: Random Event
event:
  focus: "@[[Oracles/Event Focus]]"
  meaning: ["@[[Oracles/Action]]", "@[[Oracles/Subject]]"]
  text: "{{event}}"
---
Roll a Mythic random event: focus + two meaning words, then narrate it.
```

```rpg feature.gm
name: Open Scene
scene:
  opens: "S{{n}} {{title}}"
```
```rpg feature.gm
name: Plot Twist
uses: 1
recovery: 1/session
generator:
  name: Plot Twist
  roll: d100
  work: Twist
---
A once-per-session curveball.
```
