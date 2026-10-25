---
cssclasses:
  - note-feature
source: From **The Nomicon** by **Dyson Logos**
aliases:
  - Nomicon Personal Epithets
tab-icon: feather
tab-color: var(--color-cyan)
tab-name: Epithet Generator
---
# Epithet Generator
```rpg feature.gm
id: epithet-generator
name: Epithet Generator
heading: none
source: From **The Nomicon** by **Dyson Logos**
generators:
  - id: epithet-generator
    name: Epithet Generator
    steps:
      - work: "Kind of epithet"
        ask: kind
        choices: ["Occupational surname", "Patronymic added to the name", "Patronymic as separate words", "Arcane (type 1)", "Arcane (type 2, evil)", "Arcane (type 2, good)", "Arcane (type 3)", "Descriptive", "Personality (table 1)", "Personality (table 2)", "Demonic", "Goodness", "Evil dominion", "Animal (negative)", "Animal (positive)", "Dragon (evil)"]
steps:
  - choice: "Occupational surname"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 1. Surnames + Habitational Bynames + PatronymicMatronymic + Occupational Surname]]#occupational-surnames"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Surname=1"
  - choice: "Patronymic added to the name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 1. Surnames + Habitational Bynames + PatronymicMatronymic + Occupational Surname]]#patronymic-added-to-end-of-name"
    labels:
      - "Suffix"
    choose:
      - "Suffix=1,2"
  - choice: "Patronymic as separate words"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 1. Surnames + Habitational Bynames + PatronymicMatronymic + Occupational Surname]]#patronymic-as-separate-words"
    labels:
      - "Word"
    choose:
      - "Word=1,2"
  - choice: "Arcane (type 1)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 2. Arcane Epithets 1]]#arcane-epithet-type-1"
    labels:
      - "Epithet"
    choose:
      - "Epithet=1"
  - choice: "Arcane (type 2, evil)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 2. Arcane Epithets 1]]#arcane-epithet-type-2a-evil-type"
    labels:
      - "Epithet"
    choose:
      - "Epithet=1"
  - choice: "Arcane (type 2, good)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 2. Arcane Epithets 1]]#arcane-epithet-type-2b-good-type"
    labels:
      - "Epithet"
    choose:
      - "Epithet=1"
  - choice: "Arcane (type 3)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 3. Arcane Epithets 2]]#arcane-epithet-type-3-evil-ish"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+First Word=1& Second Word=2"
  - choice: "Descriptive"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 3. Arcane Epithets 2]]#descriptive-epithet"
    labels:
      - "Epithet"
    choose:
      - "Epithet=1,2,3,4"
  - choice: "Personality (table 1)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 4. Arcane Epithets 3]]#personality-epithets-1"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Epithet=1,2"
  - choice: "Personality (table 2)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 4. Arcane Epithets 3]]#personality-epithets-2"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Epithet=1,2"
  - choice: "Demonic"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 5. Arcane Epithets 4]]#demonic-epithets"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Epithet=1,2,3"
  - choice: "Goodness"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 5. Arcane Epithets 4]]#epithets-of-goodness"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Epithet=1,2,3,4,5"
  - choice: "Evil dominion"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 5. Arcane Epithets 4]]#evil-dominion-epithets"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 5. Arcane Epithets 4]]#dominion-epithet-introduction"
    labels:
      - "Epithet"
      - ""
    choose:
      - "Intro=2:1& Domain=1,2,3"
      - ""
  - choice: "Animal (negative)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 6. Arcane Epithets 5]]#animal-epithet-negative-connotation"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Animal=1,2"
  - choice: "Animal (positive)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 6. Arcane Epithets 5]]#animal-epithet-broad-possibilities-generally-positive-connotation"
    labels:
      - "Epithet"
    choose:
      - "\"the \"+Animal=1,2"
  - choice: "Dragon (evil)"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/parts/28. Personal Epithets/Personal Epithets 6. Arcane Epithets 5]]#dragon-epithets-evil"
    labels:
      - "Epithet"
    choose:
      - "Epithet=1,2"
cards:
  - name: Epithet Generator
    stack: generator
    rank: 3
    icon: "🪶"
    summary: "Pick a kind of epithet, then roll its Nomicon tables."
    emits:
      - { oracle: { question: "What are they known as, {{subject}}?" } }
      - "@epithet-generator"
      - { scene: { consequence: "{{subject}} is known as {{result?}}" } }
---
Pick the **kind of epithet** to add after a name: surnames, patronymics, arcane, descriptive, personality, demonic, good, dominion and animal epithets.
```
See [[01. Introduction|The Nomicon]] for what each naming group sounds like. For a formal title use the [[Title Generator]].
