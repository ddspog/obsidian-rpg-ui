---
cssclasses:
  - note-feature
source: From **The Nomicon** by **Dyson Logos**
aliases:
  - Nomicon Name Generator
tab-icon: signature
tab-color: var(--color-orange)
tab-name: Name Generator
---
# Name Generator
```rpg feature.gm
id: name-generator
name: Name Generator
heading: none
source: From **The Nomicon** by **Dyson Logos**
generators:
  - id: name-generator
    name: Name Generator
    steps:
      - work: Naming Style
        ask: style
        choices: [Anglish, Arabish, Brittonian (Gaelic), Brittonian (Welsh), Celtigaulic, Dwarven, East Asiantic, High Elven, Lower Elvish, Espannic, Eurovesian, Hellenica, Italican, Dharc-Metallik, High Metallik, Nanskrit, Nörslik, Russlavik, Stygian-Egyptic, Sub-Saharish, Teutonnic, Trobadoric, Colossoponderous, Cthonic, Dreamlandish, Primordial-Divine, Eldritch God, Angelic, Demonic]
steps:
  - choice: Anglish
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 1. Anglish Personal Names]]#anglish-masculine"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 1. Anglish Personal Names]]#anglish-feminine"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 2. Anglish Terrain Names]]#anglish-terrain-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 2. Anglish Terrain Names]]#anglish-terrain-3-endings"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Terrain name"
      - "Terrain ending"
    notes:
      - ""
      - ""
      - "Join the First Part and an Ending."
      - "Optional: take the ending from the column for the terrain (Forest, Marsh/Swamp, Mountains/Hills or River)."
  - choice: Arabish
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 1. Personal Names]]#arabish-masculine-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 1. Personal Names]]#arabish-feminine-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 5. Name Of Culture + Terrain feature names]]#arabish-terrain-feature-name"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 6. Arabish city and settlement names]]#arabish-city-and-settlement-names-starting-syllables"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 6. Arabish city and settlement names]]#arabish-city-and-settlement-names-ending"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Terrain name"
      - "Settlement name"
      - "Settlement ending"
    notes:
      - ""
      - ""
      - ""
      - "Take a name from any column; you may add an ending from the next row."
      - "Optional ending for the settlement name above."
  - choice: Brittonian (Gaelic)
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-gaelic-start"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-gaelic-ending"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-feminine-personal-names-gaelic"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 3. Brittonian Culture names + Countries]]#brittonnian-country-names"
    labels:
      - "Masculine name, start"
      - "Masculine name, ending"
      - "Feminine name"
      - "Country name"
    notes:
      - "Take a start from any column, then add an ending from the next row."
      - "The ending to add to the start above."
      - "Join a Part 1 and a Part 2."
      - "Join a Start and an Ending."
  - choice: Brittonian (Welsh)
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-welsh-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-welsh-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 2. Brittonian Personal names 2]]#brittonian-feminine-personal-names-welsh-part-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 2. Brittonian Personal names 2]]#brittonian-feminine-personal-names-welsh-part-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 4. Brittonnian Terrain feature names]]#brittonnian-bright-terrain-feature"
    labels:
      - "Masculine name"
      - "Masculine name, variant"
      - "Feminine name, first part"
      - "Feminine name, ending"
      - "Terrain name"
    notes:
      - "Join a Part 1 and a Part 2."
      - "Same method as the table above, with different parts; use either."
      - "Take any column for the first part, then add an ending from the next row."
      - "The ending to add to the first part above."
      - "Put the First Word before the Second Word."
  - choice: Celtigaulic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 1. Celtigaulic Personal names]]#celtigaulic-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 1. Celtigaulic Personal names]]#celtigaulic-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 3. Celtigaulic City or Town names]]#celtigaulic-city-and-town-names"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Town name"
    notes:
      - "Join a Start and an Ending."
      - "Join a Start and an Ending."
      - "Join a Start and an Ending."
  - choice: Dwarven
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-place-names-table-1"
    labels:
      - "Personal name"
      - "Personal name, variant"
      - "Place name"
    notes:
      - "Join the Start and the Masculine or Feminine Ending."
      - "Same method as the table above, with different parts; use either."
      - "Join a Part 1 and a Part 2."
  - choice: East Asiantic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-cultures-and-countries"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-terrain-features"
    labels:
      - "Culture or country name"
      - "Terrain name"
    notes:
      - "Join a Start and an Ending."
      - "Join the First Part and a Second Part."
  - choice: High Elven
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-place-names"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Place name"
    notes:
      - "Join a Part 1 and a Part 2."
      - "Join a Part 1 and a Part 2."
      - "Join a Part 1, a Part 2 and a Part 3."
  - choice: Lower Elvish
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-masculine-names-wood-elves-etc"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-feminine-names-wood-elves-etc"
    labels:
      - "Masculine name"
      - "Feminine name"
    notes:
      - "Join a Part 1 and a Part 2."
      - "Join a Part 1 and a Part 2."
  - choice: Espannic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-feminine-personal-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-terrain-and-region-names"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Terrain or region name"
  - choice: Eurovesian
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian/Eurovesian 1. Culture Or Country 1]]#eurovesian-culture-or-country-name-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian/Eurovesian 1. Culture Or Country 1]]#eurovesian-culture-or-country-name-table-2"
    labels:
      - "Culture or country name"
      - "Culture or country name, variant"
    notes:
      - "Join a Start and an Ending."
      - "Join a Start and an Ending."
  - choice: Hellenica
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 1. Personal names]]#hellenica-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 1. Personal names]]#hellenica-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 3. Place Names 2]]#hellenica-city-names-1"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "City name"
    notes:
      - "Join a Start and an Ending."
      - ""
      - "Join a Start and an Ending."
  - choice: Italican
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 1. Italican Personal names]]#italican-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 1. Italican Personal names]]#italican-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 2. Italican Place names]]#italican-culture-country-and-terrain-names-1"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Culture, country or terrain name"
    notes:
      - ""
      - ""
      - "Join the Start and one Ending."
  - choice: Dharc-Metallik
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 1. Dharc-metallik 1]]#dharc-metallik-place-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 2. Dharc-metallik 2]]#dharc-metallik-place-names-quick-table"
    labels:
      - "Place name"
      - "Place name, quick"
    notes:
      - "Join a Start, a Middle and an Ending."
      - "Join a Start and an Ending."
  - choice: High Metallik
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 3. High Metallik]]#high-metallik-place-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 3. High Metallik]]#high-metallik-place-names-table-2"
    labels:
      - "Place name"
      - "Place name, short"
    notes:
      - "Join a Start, a Middle and an Ending."
      - "Join a Start and an Ending."
  - choice: Nanskrit
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 1. Personal Names]]#nanskrit-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 1. Personal Names]]#nanskrit-personal-feminine-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 4. City and Settlement names Nanskrit]]#nanskrit-city-and-settlement-names"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Settlement name"
    notes:
      - "Join the First Part and a Second Part."
      - "Join the First Part and a Second Part."
      - "Join a Start and an Ending."
  - choice: Nörslik
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 1. Personal names Nörslik 1]]#nrslik-masculine-personal-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 2. Personal names Nörslik 2]]#nrslik-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 4. Nörslik Terrain Feature names]]#nrslik-core-terrain-names"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Terrain name"
    notes:
      - "The Base Name is closer to Old Norse; a Dialect sounds easier to pronounce."
      - ""
      - "A core word for a terrain feature; add a terrain type of your choice."
  - choice: Russlavik
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 1. Personal Names]]#russlavik-masculine-personal-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 1. Personal Names]]#russlavik-feminine-personal-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 2. Place names]]#short-russlavik-city-names"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "City name"
    notes:
      - ""
      - ""
      - "Join a Start and an Ending."
  - choice: Stygian-Egyptic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-personal-names-masculine-and-feminine"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-terrain-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-city-names"
    labels:
      - "Personal name"
      - "Terrain name"
      - "City name"
    notes:
      - "Join the First Part and the Masculine or Feminine Ending."
      - "Join a Start and an Ending."
      - "Join a Start and an Ending."
  - choice: Sub-Saharish
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-general-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-terrain-feature-names"
    labels:
      - "Personal or place name"
      - "Terrain name"
    notes:
      - "Join the First Part and a Second Part."
      - "Join the First Part and a Second Part."
  - choice: Teutonnic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 2. Medieval Teutonnic 1]]#teutonnic-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 2. Medieval Teutonnic 1]]#teutonnic-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 3. Medieval Teutonnic 2]]#teutonnic-countries-terrain-features-and-towns-1"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "Country, terrain or town name"
    notes:
      - ""
      - ""
      - "Join the First Part and a Second Part."
  - choice: Trobadoric
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 1. Trobadoric Personal names]]#trobadoric-masculine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 1. Trobadoric Personal names]]#trobadoric-feminine-personal-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 3. Trobadoric City and Settlement names]]#trobadoric-cities-and-towns"
    labels:
      - "Masculine name"
      - "Feminine name"
      - "City or town name"
    notes:
      - ""
      - ""
      - "Take the First Part, then one Dialect. Keep to one Dialect within an area so its places sound alike."
  - choice: Colossoponderous
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 1. Colossoponderous]]#colossoponderous-single-word-place-or-deity-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 1. Colossoponderous]]#colossoponderous-two-word-place-names"
    labels:
      - "Place or deity name"
      - "Place name, two words"
    notes:
      - "Join a Start and an Ending."
      - "Put the First Word before the Second Word."
  - choice: Cthonic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 2. Cthonic]]#cthonic-single-word-place-names"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 2. Cthonic]]#cthonic-two-word-or-hyphenated-place-names"
    labels:
      - "Place name"
      - "Place name, two words"
    notes:
      - "Join a Part 1 and a Part 2."
      - "Put the First Word before the Second Word."
  - choice: Dreamlandish
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 3. Dreamlandish 1]]#dreamlandish-powerful-spellcasters-masculine-short-name"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 3. Dreamlandish 1]]#dreamlandish-powerful-spellcasters-feminine-name"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 5. Dreamlandish 3]]#dreamlandish-cities-and-settlements"
    labels:
      - "Spellcaster, masculine"
      - "Spellcaster, feminine"
      - "Settlement name"
    notes:
      - "Join a Start and an Ending."
      - "Join the First Part and an Ending."
      - "Join a Start and an Ending."
  - choice: Primordial-Divine
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-short"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-hyphenated"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-epithet"
    labels:
      - "Short name"
      - "Hyphenated name"
      - "Epithet"
    notes:
      - ""
      - "Alternative to the short name above."
      - "Optional title for the deity."
  - choice: Eldritch God
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 2. Eldritch God Names]]#eldritch-god-names"
    labels:
      - "God name"
    notes:
      - "Join the First Part and the Second Part."
  - choice: Angelic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-names-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-epithets"
    labels:
      - "Name"
      - "Name, variant"
      - "Epithet"
    notes:
      - ""
      - "Alternative to the table above; use either."
      - "Optional epithet for the angel."
  - choice: Demonic
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 5. Demonic Names + Arch-Demonic or Evil God Epithets]]#demonic-name-part-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 5. Demonic Names + Arch-Demonic or Evil God Epithets]]#demonic-name-part-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 5. Demonic Names + Arch-Demonic or Evil God Epithets]]#evil-god-epithets"
    labels:
      - "Name, first part"
      - "Name, second part"
      - "Epithet"
    notes:
      - "Join the first part with the second part from the next row."
      - "The second part of the name above."
      - "Optional epithet for an arch-demon or evil god. Part 1 on its own also works."
cards:
  - name: Name Generator
    stack: generator
    rank: 3
    icon: "✒️"
    summary: Pick a naming style, then roll its Nomicon tables for personal, place and settlement names.
    emits:
      - { oracle: { question: "What is {{subject}} called?" } }
      - "@name-generator"
      - { scene: { consequence: "{{subject}} is named {{result}}" } }
---
Pick a **naming style**; the generator rolls that style's name tables from The Nomicon — masculine and feminine personal names, then terrain, country or settlement names where the style has them. Combine the parts using the formulas in the style's chapter.
```
See [[00. Introduction|The Nomicon]] for what each naming group sounds like, and the chapters on titles and epithets for surnames and honorifics.
