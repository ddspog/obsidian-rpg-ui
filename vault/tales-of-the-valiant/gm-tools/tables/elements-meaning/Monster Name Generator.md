---
cssclasses:
  - note-feature
source: From **The Nomicon** by **Dyson Logos**
aliases:
  - Nomicon Monster Names
tab-icon: skull
tab-color: var(--color-red)
tab-name: Monster Name Generator
---
# Monster Name Generator
```rpg feature.gm
id: monster-name-generator
name: Monster Name Generator
heading: none
source: From **The Nomicon** by **Dyson Logos**
generators:
  - id: monster-name-generator
    name: Monster Name Generator
    steps:
      - work: "Kind of monster"
        ask: kind
        choices: ["Monster type (option 1)", "Monster type, with a beast ending", "Monster type (option 2)", "Monster type (option 3)", "Bug monster", "Dragon", "Eldritch horror (option 1)", "Eldritch horror (option 2)", "Hag title", "Lizard monster", "Reptilian title", "Fish monster", "Tree-type plant creature", "Other plant creature"]
steps:
  - choice: "Monster type (option 1)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 1. General Monster Names]]#name-for-a-monster-type-option-1"
    labels:
      - "Name"
    choose:
      - "Part 1=1,2+Part 2=3,4"
  - choice: "Monster type, with a beast ending"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 1. General Monster Names]]#name-for-a-monster-type-option-1"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 1. General Monster Names]]#beast-ending"
    labels:
      - "Name"
      - ""
    choose:
      - "Part 1=1,2+Part 2=3,4+\"-\"+Beast Ending=2:1"
      - ""
  - choice: "Monster type (option 2)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 1. General Monster Names]]#name-for-a-monster-type-option-2"
    labels:
      - "Name"
    choose:
      - "Part 1=1& Part 2=2+Part 3=3"
  - choice: "Monster type (option 3)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 1. General Monster Names]]#name-for-a-monster-type-option-3"
    labels:
      - "Name"
    choose:
      - "Part 1=1+Part 2=2& Part 3=3"
  - choice: "Bug monster"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 2. Bug Monster names + Draconic Monster names]]#bug-placeperson-name"
    labels:
      - "Name"
    choose:
      - "Part 1=1+\"-\"+Part 2=2+\"-\"+Part 3=3"
  - choice: "Dragon"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 2. Bug Monster names + Draconic Monster names]]#dragon-nameplace"
    labels:
      - "Name"
    choose:
      - "Part 1=1+Part 2=2"
  - choice: "Eldritch horror (option 1)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 3. Eldritch Horror names]]#eldritch-horror-name-option-1"
    labels:
      - "Name"
    choose:
      - "Part 1=1& Part 2=2,3,4"
  - choice: "Eldritch horror (option 2)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 3. Eldritch Horror names]]#eldritch-horror-name-option-2"
    labels:
      - "Name"
    choose:
      - "Part 1=1& Part 2=2"
  - choice: "Hag title"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 4. Hags + Lizard Monster names]]#name-titles-for-a-hag"
    labels:
      - "Title"
    choose:
      - "Title=1"
  - choice: "Lizard monster"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 4. Hags + Lizard Monster names]]#lizard-placeperson-name"
    labels:
      - "Name"
    choose:
      - "Part 1=1+Part 2=2,3"
  - choice: "Reptilian title"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 4. Hags + Lizard Monster names]]#reptilian-titles"
    labels:
      - "Name"
    choose:
      - "Part 1=1+Part 2=2"
  - choice: "Fish monster"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 5. Fish Monster names + Plant-creature names]]#fish-placeperson-name"
    labels:
      - "Name"
    choose:
      - "Part 1=1+Part 2=2,3"
  - choice: "Tree-type plant creature"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 5. Fish Monster names + Plant-creature names]]#tree-type-plant-creature-names"
    labels:
      - "Name"
    choose:
      - "\"The \"+Tree Adjective=1+\" Tree of \"+Part 1=2+Part 2=3"
  - choice: "Other plant creature"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/26. Monster Names/Monster Names 5. Fish Monster names + Plant-creature names]]#other-plant-creature-names"
    labels:
      - "Name"
    choose:
      - "Start=1& Part 1=2,3+Part 2=4,5"
cards:
  - name: Monster Name Generator
    stack: generator
    rank: 3
    icon: "👹"
    summary: "Pick the kind of monster, then roll its Nomicon name tables."
    emits:
      - { oracle: { question: "What is {{subject}} called?" } }
      - "@monster-name-generator"
      - { scene: { consequence: "{{subject}} is called {{result?}}" } }
---
Pick the **kind of monster**. Each part of the name is rolled on its own row; the Name line joins them, with a word picker where the rows offer more than one choice.
```
See [[01. Introduction|The Nomicon]] for what each naming group sounds like. The same tables name places held by those creatures.
