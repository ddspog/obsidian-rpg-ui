---
cssclasses:
  - note-feature
source: From **The Nomicon** by **Dyson Logos**
aliases:
  - Nomicon Titles
tab-icon: crown
tab-color: var(--color-yellow)
tab-name: Title Generator
---
# Title Generator
```rpg feature.gm
id: title-generator
name: Title Generator
heading: none
source: From **The Nomicon** by **Dyson Logos**
generators:
  - id: title-generator
    name: Title Generator
    steps:
      - work: "Kind of title"
        ask: kind
        choices: ["Arcane title", "Admired Majesty", "Capacity or metaphor Majesty", "Holy or reverent Majesty", "Luminescent or distinguished Majesty", "Powerful Majesty", "Noun of Majesty (table 1)", "Noun of Majesty (table 2)", "Tyrant", "General title: official", "General title: noble", "Shorter noble title", "Eurovesian, Trobadoric, Brittonian or Celtigaulic title", "Nanskrit or Arabish title"]
steps:
  - choice: "Arcane title"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 1. Arcane Titles]]#arcane-titles"
    labels:
      - "Title"
    choose:
      - "\"The \"+Title=1"
  - choice: "Admired Majesty"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#admired"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Adjective=1,2+\" Majesty\""
  - choice: "Capacity or metaphor Majesty"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#capacity-and-metaphors"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Adjective=1,2,3+\" Majesty\""
  - choice: "Holy or reverent Majesty"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#holy-or-reverent"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Adjective=1,2,3+\" Majesty\""
  - choice: "Luminescent or distinguished Majesty"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#luminescent-or-distinguished"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Adjective=1,2,3+\" Majesty\""
  - choice: "Powerful Majesty"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#powerful"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Adjective=1,2,3+\" Majesty\""
  - choice: "Noun of Majesty (table 1)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#nouns-of-majesty-table-1"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Noun=1,2,3,4"
  - choice: "Noun of Majesty (table 2)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#nouns-of-majesty-table-2"
    labels:
      - "Title"
    choose:
      - "\"Your \"+Noun=1,2,3,4"
  - choice: "Tyrant"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 3. Modes of Address]]#tyrannical-title-adjective"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#noun-of-wickedness"
    labels:
      - "Title"
      - ""
    choose:
      - "\"Your \"+Adjective=1,2& Noun=2:1,2"
      - ""
  - choice: "General title: official"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#general-use-titles-part-1"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#general-use-titles-part-2"
    labels:
      - "Title"
      - ""
    choose:
      - "Start=1,2,3,4,5+End=2:1"
      - ""
  - choice: "General title: noble"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#general-use-titles-part-1"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#general-use-titles-part-2"
    labels:
      - "Title"
      - ""
    choose:
      - "Start=1,2,3,4,5+End=2:2"
      - ""
  - choice: "Shorter noble title"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#shorter-noble-titles"
    labels:
      - "Title"
    choose:
      - "Part 1=1+Part 2=2"
  - choice: "Eurovesian, Trobadoric, Brittonian or Celtigaulic title"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#eurovesian-trobadoric-brittonian-and-celtigaulic-titles-first-part"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#trobadoric-brittonian-titles-second-part"
    labels:
      - "Title"
      - ""
    choose:
      - "Start=1,2,3,4,5+End=2:1,2,3"
      - ""
  - choice: "Nanskrit or Arabish title"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/27. Titles/Titles 4. Modes of Address + Alternative Titles of Nobility or Office]]#nanskrit-and-arabish-titles"
    labels:
      - "Title"
    choose:
      - "First Part=1+Second Part=2"
cards:
  - name: Title Generator
    stack: generator
    rank: 3
    icon: "👑"
    summary: "Pick a kind of title, then roll its Nomicon tables."
    emits:
      - { oracle: { question: "What is {{subject}} titled?" } }
      - "@title-generator"
      - { scene: { consequence: "{{subject}} is titled {{result?}}" } }
---
Pick the **kind of title**: arcane titles, modes of address for a ruler (Your Admired Majesty), alternative titles of nobility or office, and the tyrant's "Your Ferocious Profanity".
```
See [[01. Introduction|The Nomicon]] for what each naming group sounds like. Epithets after the name are in the [[Epithet Generator]].
