---
cssclasses:
  - note-feature
source: From **The Nomicon** by **Dyson Logos**
aliases:
  - Nomicon Tavern Names
tab-icon: beer
tab-color: var(--color-orange)
tab-name: Tavern Name Generator
---
# Tavern Name Generator
```rpg feature.gm
id: tavern-name-generator
name: Tavern Name Generator
heading: none
source: From **The Nomicon** by **Dyson Logos**
generators:
  - id: tavern-name-generator
    name: Tavern Name Generator
    steps:
      - work: "Tavern formula"
        ask: kind
        choices: ["The Item", "The Adjective Item", "The Living Adjective Animal", "The Person's Item", "The Person's Animal", "The Person's Abstract Item", "The Animal's Abstract Item", "The Item and Animal", "The Person and Animal", "The Person and Person", "The Long Item"]
steps:
  - choice: "The Item"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 2. Taverns 1]]#short-tavern-items-1"
    labels:
      - "Name"
    choose:
      - "\"The \"+Item=1,2,3"
  - choice: "The Adjective Item"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 3. Taverns 2]]#short-tavern-item-adjective"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 2. Taverns 1]]#short-tavern-items-1"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Adjective=1& Item=2:1,2,3"
      - ""
  - choice: "The Living Adjective Animal"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 3. Taverns 2]]#short-tavern-living-adjective"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 4. Taverns 3]]#short-tavern-animal"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Adjective=1,2& Animal=2:1"
      - ""
  - choice: "The Person's Item"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-person"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 2. Taverns 1]]#short-tavern-items-1"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Person=1+\"'s \"+Item=2:1,2,3"
      - ""
  - choice: "The Person's Animal"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-person"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 4. Taverns 3]]#short-tavern-animal"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Person=1+\"'s \"+Animal=2:1"
      - ""
  - choice: "The Person's Abstract Item"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-person"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-abstract-item"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Person=1+\"'s \"+Item=2:1"
      - ""
  - choice: "The Animal's Abstract Item"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 4. Taverns 3]]#short-tavern-animal"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-abstract-item"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Animal=1+\"'s \"+Item=2:1"
      - ""
  - choice: "The Item and Animal"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 2. Taverns 1]]#short-tavern-items-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 4. Taverns 3]]#short-tavern-animal"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Item=1,2,3+\" and \"+Animal=2:1"
      - ""
  - choice: "The Person and Animal"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-person"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 4. Taverns 3]]#short-tavern-animal"
    labels:
      - "Name"
      - ""
    choose:
      - "\"The \"+Person=1+\" and \"+Animal=2:1"
      - ""
  - choice: "The Person and Person"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 5. Taverns 4]]#tavern-person"
    labels:
      - "Name"
    choose:
      - "\"The \"+Person=1+\" and \"+Second Person=1"
  - choice: "The Long Item"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/29. Miscellaneous Tables/Miscellaneous Tables 2. Taverns 1]]#long-tavern-items"
    labels:
      - "Name"
    choose:
      - "\"The \"+Item=1,2"
cards:
  - name: Tavern Name Generator
    stack: generator
    rank: 3
    icon: "🍺"
    summary: "Pick a tavern-name formula, then roll its Nomicon tables."
    emits:
      - { oracle: { question: "What is the tavern called?" } }
      - "@tavern-name-generator"
      - { scene: { consequence: "The tavern is called {{result?}}" } }
---
Pick a **formula** for the tavern's name (The Item, The Adjective Item, The Person's Animal…). Each word is rolled on its own table row and the Name line joins them.
```
See [[01. Introduction|The Nomicon]] for what each naming group sounds like.
