---
cssclasses:
  - note-feature
source: From **The Nomicon** by **Dyson Logos**
aliases:
  - Nomicon Place Names
tab-icon: castle
tab-color: var(--color-green)
tab-name: Place Name Generator
---
# Place Name Generator
```rpg feature.gm
id: place-name-generator
name: Place Name Generator
heading: none
source: From **The Nomicon** by **Dyson Logos**
generators:
  - id: place-name-generator
    name: Place Name Generator
    steps:
      - work: "Kind of place"
        ask: kind
        choices: ["Terrain: \"…of ___\"", "Terrain: mixed names", "Terrain: more mixed names", "Terrain: shaped like an item", "Fortress (type 1)", "Fortress (type 2): Bastion of…", "Fortress (type 3): …of the Group", "Short castle name", "Mystical fortress (table 1)", "Mystical fortress (table 2)", "City (Black Company style)", "City epithet: a group", "City epithet: a thing", "City epithet: \"The City of…\"", "City epithet: \"The ___ City\"", "Street named for a profession"]
steps:
  - choice: "Terrain: \"…of ___\""
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 1. Terrain Features 1]]#legendary-terrain-feature-names-1"
    labels:
      - "Feature"
    choose:
      - "Feature=1,2"
  - choice: "Terrain: mixed names"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 1. Terrain Features 1]]#legendary-terrain-feature-names-2"
    labels:
      - "Name"
    choose:
      - "Name=1,2,3"
  - choice: "Terrain: more mixed names"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 2. Terrain Features 2]]#legendary-terrain-feature-names-3"
    labels:
      - "Name"
    choose:
      - "Name=1,2,3"
  - choice: "Terrain: shaped like an item"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 2. Terrain Features 2]]#legendary-terrain-feature-names-4"
    labels:
      - "Name"
    choose:
      - "\"The \"+Item=1"
  - choice: "Fortress (type 1)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 3. Strongholds 1]]#type-1-fortress-name-2"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 3. Strongholds 1]]#type-1-fortress-name-1"
    labels:
      - "Name"
      - ""
    choose:
      - "Name=1,2,3,4"
      - ""
  - choice: "Fortress (type 2): Bastion of…"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 3. Strongholds 1]]#type-2-fortress-name"
    labels:
      - "Start"
    choose:
      - "Start=1"
  - choice: "Fortress (type 3): …of the Group"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 3. Strongholds 1]]#type-2-fortress-name"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 3. Strongholds 1]]#type-3-fortress-name-part-2"
    labels:
      - "Name"
      - ""
    choose:
      - "Start=1& the Group=2:1,2,3,4"
      - ""
  - choice: "Short castle name"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 3. Strongholds 1]]#short-castle-name"
    labels:
      - "Name"
    choose:
      - "\"Castle \"+Name=1,2,3,4,5,6,7"
  - choice: "Mystical fortress (table 1)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 4. Strongholds 2]]#mystical-fortress-name-1"
    labels:
      - "Name"
    choose:
      - "\"The Fortress of \"+Name=1,2,3,4"
  - choice: "Mystical fortress (table 2)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/24. Names for Legendary Places/Names for Legendary Places 4. Strongholds 2]]#mystical-fortress-name-2"
    labels:
      - "Name"
    choose:
      - "\"The Fortress of \"+Name=1,2,3,4"
  - choice: "City (Black Company style)"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 1. Table 25-1 Black Company Style City Names 1]]#black-company-style-city-names"
    labels:
      - "Name"
    choose:
      - "Name=1,2,3,4"
  - choice: "City epithet: a group"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 1. Table 25-1 Black Company Style City Names 1]]#city-epithets-1"
    labels:
      - "Name"
    choose:
      - "\"City of the \"+Group Adjective=1& Groups=2"
  - choice: "City epithet: a thing"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 1. Table 25-1 Black Company Style City Names 1]]#city-epithets-1"
    labels:
      - "Name"
    choose:
      - "\"City of the \"+Thing Adjective=3& Thing=4"
  - choice: "City epithet: \"The City of…\""
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 2. Table 25-1 Black Company Style City Names 2]]#city-epithets-2"
    labels:
      - "Name"
    choose:
      - "\"The City of \"+Name=1,2,3,4"
  - choice: "City epithet: \"The ___ City\""
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 2. Table 25-1 Black Company Style City Names 2]]#city-epithets-3"
    labels:
      - "Name"
    choose:
      - "\"The \"+Adjective=1,2+\" City\""
  - choice: "Street named for a profession"
    tables:
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 3. Street Names]]#streets-named-for-professions"
      - "@[[tales-of-the-valiant/gm-tools/tables/the-nomicon/25. City and Settlement Names/City and Settlement Names 3. Street Names]]#selected-street-types"
    labels:
      - "Name"
      - ""
    choose:
      - "Type=2:1+\" of \"+Profession=1,2,3"
      - ""
cards:
  - name: Place Name Generator
    stack: generator
    rank: 3
    icon: "🏰"
    summary: "Pick a kind of place, then roll its Nomicon tables."
    emits:
      - { oracle: { question: "What is the place called?" } }
      - "@place-name-generator"
      - { scene: { consequence: "The place is called {{result?}}" } }
---
Pick the **kind of place**: legendary terrain, strongholds, cities and streets. For a place in a particular naming group, use the [[Name Generator]] instead.
```
See [[01. Introduction|The Nomicon]] for what each naming group sounds like.
