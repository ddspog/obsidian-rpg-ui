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
        choices: ["Anglish – Masculine name", "Anglish – Feminine name", "Anglish – Terrain name", "Arabish – Masculine name", "Arabish – Feminine name", "Arabish – Terrain name", "Arabish – Settlement name", "Brittonian (Gaelic) – Masculine name", "Brittonian (Gaelic) – Feminine name", "Brittonian (Gaelic) – Country name", "Brittonian (Welsh) – Masculine name", "Brittonian (Welsh) – Feminine name", "Brittonian (Welsh) – Terrain name", "Celtigaulic – Masculine name", "Celtigaulic – Feminine name", "Celtigaulic – Town name", "Dwarven – Personal name", "Dwarven – Place name", "East Asiantic – Culture or country name", "East Asiantic – Terrain name", "High Elven – Masculine name", "High Elven – Feminine name", "High Elven – Place name", "Lower Elvish – Masculine name", "Lower Elvish – Feminine name", "Espannic – Masculine name", "Espannic – Feminine name", "Espannic – Terrain or region name", "Eurovesian – Culture or country name", "Hellenica – Masculine name", "Hellenica – Feminine name", "Hellenica – City name", "Italican – Masculine name", "Italican – Feminine name", "Italican – Culture, country or terrain name", "Dharc-Metallik – Place name", "High Metallik – Place name", "Nanskrit – Masculine name", "Nanskrit – Feminine name", "Nanskrit – Settlement name", "Nörslik – Masculine name", "Nörslik – Feminine name", "Nörslik – Terrain name", "Russlavik – Masculine name", "Russlavik – Feminine name", "Russlavik – City name", "Stygian-Egyptic – Personal name", "Stygian-Egyptic – Terrain name", "Stygian-Egyptic – City name", "Sub-Saharish – Personal or place name", "Sub-Saharish – Terrain name", "Teutonnic – Masculine name", "Teutonnic – Feminine name", "Teutonnic – Country, terrain or town name", "Trobadoric – Masculine name", "Trobadoric – Feminine name", "Trobadoric – City or town name", "Colossoponderous – Place or deity name", "Colossoponderous – Place name, two words", "Cthonic – Place name", "Cthonic – Place name, two words", "Dreamlandish – Spellcaster, masculine", "Dreamlandish – Spellcaster, feminine", "Dreamlandish – Settlement name", "Primordial-Divine – Deity name", "Eldritch God – God name", "Angelic – Name", "Demonic – Name"]
steps:
  - choice: "Anglish – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 1. Anglish Personal Names]]#anglish-masculine"
    labels:
      - "Name"
  - choice: "Anglish – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 1. Anglish Personal Names]]#anglish-feminine"
    labels:
      - "Name"
  - choice: "Anglish – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 2. Anglish Terrain Names]]#anglish-terrain-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 2. Anglish Terrain Names]]#anglish-terrain-3-endings"
    labels:
      - "Name"
      - "& Ending (optional)"
  - choice: "Arabish – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 1. Personal Names]]#arabish-masculine-names"
    labels:
      - "Name"
  - choice: "Arabish – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 1. Personal Names]]#arabish-feminine-names"
    labels:
      - "Name"
  - choice: "Arabish – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 5. Name Of Culture + Terrain feature names]]#arabish-terrain-feature-name"
    labels:
      - "Name"
  - choice: "Arabish – Settlement name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 6. Arabish city and settlement names]]#arabish-city-and-settlement-names-starting-syllables"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 6. Arabish city and settlement names]]#arabish-city-and-settlement-names-ending"
    labels:
      - "Name"
      - "& Ending (optional)"
  - choice: "Brittonian (Gaelic) – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-gaelic-start"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-gaelic-ending"
    labels:
      - "Start"
      - "& Ending"
  - choice: "Brittonian (Gaelic) – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-feminine-personal-names-gaelic"
    labels:
      - "Name"
  - choice: "Brittonian (Gaelic) – Country name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 3. Brittonian Culture names + Countries]]#brittonnian-country-names"
    labels:
      - "Name"
  - choice: "Brittonian (Welsh) – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-welsh-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-welsh-2"
    labels:
      - "Name"
      - "Name, variant"
  - choice: "Brittonian (Welsh) – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 2. Brittonian Personal names 2]]#brittonian-feminine-personal-names-welsh-part-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 2. Brittonian Personal names 2]]#brittonian-feminine-personal-names-welsh-part-2"
    labels:
      - "First part"
      - "& Ending"
  - choice: "Brittonian (Welsh) – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 4. Brittonnian Terrain feature names]]#brittonnian-bright-terrain-feature"
    labels:
      - "Name"
  - choice: "Celtigaulic – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 1. Celtigaulic Personal names]]#celtigaulic-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Celtigaulic – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 1. Celtigaulic Personal names]]#celtigaulic-feminine-personal-names"
    labels:
      - "Name"
  - choice: "Celtigaulic – Town name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 3. Celtigaulic City or Town names]]#celtigaulic-city-and-town-names"
    labels:
      - "Name"
  - choice: "Dwarven – Personal name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-2"
    labels:
      - "Name"
      - "Name, variant"
  - choice: "Dwarven – Place name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-place-names-table-1"
    labels:
      - "Name"
  - choice: "East Asiantic – Culture or country name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-cultures-and-countries"
    labels:
      - "Name"
  - choice: "East Asiantic – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-terrain-features"
    labels:
      - "Name"
  - choice: "High Elven – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-masculine-personal-names"
    labels:
      - "Name"
  - choice: "High Elven – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-feminine-personal-names"
    labels:
      - "Name"
  - choice: "High Elven – Place name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-place-names"
    labels:
      - "Name"
  - choice: "Lower Elvish – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-masculine-names-wood-elves-etc"
    labels:
      - "Name"
  - choice: "Lower Elvish – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-feminine-names-wood-elves-etc"
    labels:
      - "Name"
  - choice: "Espannic – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Espannic – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-feminine-personal-names-1"
    labels:
      - "Name"
  - choice: "Espannic – Terrain or region name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-terrain-and-region-names"
    labels:
      - "Name"
  - choice: "Eurovesian – Culture or country name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian/Eurovesian 1. Culture Or Country 1]]#eurovesian-culture-or-country-name-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian/Eurovesian 1. Culture Or Country 1]]#eurovesian-culture-or-country-name-table-2"
    labels:
      - "Name"
      - "Name, variant"
  - choice: "Hellenica – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 1. Personal names]]#hellenica-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Hellenica – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 1. Personal names]]#hellenica-feminine-personal-names"
    labels:
      - "Name"
  - choice: "Hellenica – City name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 3. Place Names 2]]#hellenica-city-names-1"
    labels:
      - "Name"
  - choice: "Italican – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 1. Italican Personal names]]#italican-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Italican – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 1. Italican Personal names]]#italican-feminine-personal-names"
    labels:
      - "Name"
  - choice: "Italican – Culture, country or terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 2. Italican Place names]]#italican-culture-country-and-terrain-names-1"
    labels:
      - "Name"
  - choice: "Dharc-Metallik – Place name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 1. Dharc-metallik 1]]#dharc-metallik-place-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 2. Dharc-metallik 2]]#dharc-metallik-place-names-quick-table"
    labels:
      - "Name"
      - "Name, quick"
  - choice: "High Metallik – Place name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 3. High Metallik]]#high-metallik-place-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 3. High Metallik]]#high-metallik-place-names-table-2"
    labels:
      - "Name"
      - "Name, short"
  - choice: "Nanskrit – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 1. Personal Names]]#nanskrit-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Nanskrit – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 1. Personal Names]]#nanskrit-personal-feminine-names"
    labels:
      - "Name"
  - choice: "Nanskrit – Settlement name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 4. City and Settlement names Nanskrit]]#nanskrit-city-and-settlement-names"
    labels:
      - "Name"
  - choice: "Nörslik – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 1. Personal names Nörslik 1]]#nrslik-masculine-personal-names-1"
    labels:
      - "Name"
  - choice: "Nörslik – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 2. Personal names Nörslik 2]]#nrslik-feminine-personal-names"
    labels:
      - "Name"
  - choice: "Nörslik – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 4. Nörslik Terrain Feature names]]#nrslik-core-terrain-names"
    labels:
      - "Name"
  - choice: "Russlavik – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 1. Personal Names]]#russlavik-masculine-personal-names-1"
    labels:
      - "Name"
  - choice: "Russlavik – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 1. Personal Names]]#russlavik-feminine-personal-names-1"
    labels:
      - "Name"
  - choice: "Russlavik – City name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 2. Place names]]#short-russlavik-city-names"
    labels:
      - "Name"
  - choice: "Stygian-Egyptic – Personal name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-personal-names-masculine-and-feminine"
    labels:
      - "Name"
  - choice: "Stygian-Egyptic – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-terrain-names"
    labels:
      - "Name"
  - choice: "Stygian-Egyptic – City name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-city-names"
    labels:
      - "Name"
  - choice: "Sub-Saharish – Personal or place name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-general-names"
    labels:
      - "Name"
  - choice: "Sub-Saharish – Terrain name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-terrain-feature-names"
    labels:
      - "Name"
  - choice: "Teutonnic – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 2. Medieval Teutonnic 1]]#teutonnic-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Teutonnic – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 2. Medieval Teutonnic 1]]#teutonnic-feminine-personal-names"
    labels:
      - "Name"
  - choice: "Teutonnic – Country, terrain or town name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 3. Medieval Teutonnic 2]]#teutonnic-countries-terrain-features-and-towns-1"
    labels:
      - "Name"
  - choice: "Trobadoric – Masculine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 1. Trobadoric Personal names]]#trobadoric-masculine-personal-names"
    labels:
      - "Name"
  - choice: "Trobadoric – Feminine name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 1. Trobadoric Personal names]]#trobadoric-feminine-personal-names"
    labels:
      - "Name"
  - choice: "Trobadoric – City or town name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 3. Trobadoric City and Settlement names]]#trobadoric-cities-and-towns"
    labels:
      - "Name"
  - choice: "Colossoponderous – Place or deity name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 1. Colossoponderous]]#colossoponderous-single-word-place-or-deity-names"
    labels:
      - "Name"
  - choice: "Colossoponderous – Place name, two words"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 1. Colossoponderous]]#colossoponderous-two-word-place-names"
    labels:
      - "Name"
  - choice: "Cthonic – Place name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 2. Cthonic]]#cthonic-single-word-place-names"
    labels:
      - "Name"
  - choice: "Cthonic – Place name, two words"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 2. Cthonic]]#cthonic-two-word-or-hyphenated-place-names"
    labels:
      - "Name"
  - choice: "Dreamlandish – Spellcaster, masculine"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 3. Dreamlandish 1]]#dreamlandish-powerful-spellcasters-masculine-short-name"
    labels:
      - "Name"
  - choice: "Dreamlandish – Spellcaster, feminine"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 3. Dreamlandish 1]]#dreamlandish-powerful-spellcasters-feminine-name"
    labels:
      - "Name"
  - choice: "Dreamlandish – Settlement name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 5. Dreamlandish 3]]#dreamlandish-cities-and-settlements"
    labels:
      - "Name"
  - choice: "Primordial-Divine – Deity name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-short"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-hyphenated"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-epithet"
    labels:
      - "Short name"
      - "Hyphenated name"
      - "& Epithet (optional)"
  - choice: "Eldritch God – God name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 2. Eldritch God Names]]#eldritch-god-names"
    labels:
      - "Name"
  - choice: "Angelic – Name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-names-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-epithets"
    labels:
      - "Name"
      - "Name, variant"
      - "& Epithet (optional)"
  - choice: "Demonic – Name"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 5. Demonic Names + Arch-Demonic or Evil God Epithets]]#demonic-name-part-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 5. Demonic Names + Arch-Demonic or Evil God Epithets]]#demonic-name-part-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 5. Demonic Names + Arch-Demonic or Evil God Epithets]]#evil-god-epithets"
    labels:
      - "First part"
      - "& Second part"
      - "& Epithet (optional)"
cards:
  - name: Name Generator
    stack: generator
    rank: 3
    icon: "✒️"
    summary: Pick a naming style and the kind of name, then roll that style's Nomicon tables.
    emits:
      - { oracle: { question: "What is {{subject}} called?" } }
      - "@name-generator"
      - { scene: { consequence: "{{subject}} is named {{result}}" } }
---
Pick a **naming style** and the **kind of name** — masculine, feminine, settlement, terrain or place, depending on what the style has. The generator rolls only those Nomicon tables. A name made from a start and an ending shares one row, with a die for each part.
```
See [[00. Introduction|The Nomicon]] for what each naming group sounds like, and the chapters on titles and epithets for surnames and honorifics.
