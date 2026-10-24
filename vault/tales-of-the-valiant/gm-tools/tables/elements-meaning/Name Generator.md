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
        choices: ["Anglish", "Arabish", "Brittonian (Gaelic)", "Brittonian (Welsh)", "Celtigaulic", "Dwarven", "East Asiantic", "High Elven", "Lower Elvish", "Espannic", "Eurovesian", "Hellenica", "Italican", "Dharc-Metallik", "High Metallik", "Nanskrit", "Nörslik", "Russlavik", "Stygian-Egyptic", "Sub-Saharish", "Teutonnic", "Trobadoric", "Colossoponderous", "Cthonic", "Dreamlandish", "Primordial-Divine", "Eldritch God", "Angelic", "Demonic"]
steps:
  - choice: "Anglish"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 1. Anglish Personal Names]]#anglish-masculine"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 1. Anglish Personal Names]]#anglish-feminine"
        labels:
          - "Name"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 2. Anglish Terrain Names]]#anglish-terrain-1"
          - "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish/Anglish 2. Anglish Terrain Names]]#anglish-terrain-3-endings"
        labels:
          - "Name"
          - "& Ending (optional)"
  - choice: "Arabish"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 1. Personal Names]]#arabish-masculine-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 1. Personal Names]]#arabish-feminine-names"
        labels:
          - "Name"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 5. Name Of Culture + Terrain feature names]]#arabish-terrain-feature-name"
        labels:
          - "Name"
      - choice: "Settlement name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 6. Arabish city and settlement names]]#arabish-city-and-settlement-names-starting-syllables"
          - "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish/Arabish 6. Arabish city and settlement names]]#arabish-city-and-settlement-names-ending"
        labels:
          - "Name"
          - "& Ending (optional)"
  - choice: "Brittonian (Gaelic)"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-gaelic-start"
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-gaelic-ending"
        labels:
          - "Start"
          - "& Ending"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-feminine-personal-names-gaelic"
        labels:
          - "Name"
      - choice: "Country name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 3. Brittonian Culture names + Countries]]#brittonnian-country-names"
        labels:
          - "Name"
  - choice: "Brittonian (Welsh)"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-welsh-1"
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 1. Brittonian Personal names 1]]#brittonian-masculine-personal-names-welsh-2"
        labels:
          - "Name"
          - "Name, variant"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 2. Brittonian Personal names 2]]#brittonian-feminine-personal-names-welsh-part-1"
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 2. Brittonian Personal names 2]]#brittonian-feminine-personal-names-welsh-part-2"
        labels:
          - "First part"
          - "& Ending"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian/Brittonnian 4. Brittonnian Terrain feature names]]#brittonnian-bright-terrain-feature"
        labels:
          - "Name"
  - choice: "Celtigaulic"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 1. Celtigaulic Personal names]]#celtigaulic-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 1. Celtigaulic Personal names]]#celtigaulic-feminine-personal-names"
        labels:
          - "Name"
      - choice: "Town name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic/Celtigaulic 3. Celtigaulic City or Town names]]#celtigaulic-city-and-town-names"
        labels:
          - "Name"
  - choice: "Dwarven"
    thenLabel: "Kind of name"
    then:
      - choice: "Personal name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-1"
          - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-2"
        labels:
          - "Name"
          - "Name, variant"
      - choice: "Place name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-place-names-table-1"
        labels:
          - "Name"
  - choice: "East Asiantic"
    thenLabel: "Kind of name"
    then:
      - choice: "Culture or country name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-cultures-and-countries"
        labels:
          - "Name"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-terrain-features"
        labels:
          - "Name"
  - choice: "High Elven"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-feminine-personal-names"
        labels:
          - "Name"
      - choice: "Place name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-place-names"
        labels:
          - "Name"
  - choice: "Lower Elvish"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-masculine-names-wood-elves-etc"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-feminine-names-wood-elves-etc"
        labels:
          - "Name"
  - choice: "Espannic"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-feminine-personal-names-1"
        labels:
          - "Name"
      - choice: "Terrain or region name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-terrain-and-region-names"
        labels:
          - "Name"
  - choice: "Eurovesian"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian/Eurovesian 1. Culture Or Country 1]]#eurovesian-culture-or-country-name-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian/Eurovesian 1. Culture Or Country 1]]#eurovesian-culture-or-country-name-table-2"
    labels:
      - "Name"
      - "Name, variant"
  - choice: "Hellenica"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 1. Personal names]]#hellenica-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 1. Personal names]]#hellenica-feminine-personal-names"
        labels:
          - "Name"
      - choice: "City name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica/Hellenica 3. Place Names 2]]#hellenica-city-names-1"
        labels:
          - "Name"
  - choice: "Italican"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 1. Italican Personal names]]#italican-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 1. Italican Personal names]]#italican-feminine-personal-names"
        labels:
          - "Name"
      - choice: "Culture, country or terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican/Italican 2. Italican Place names]]#italican-culture-country-and-terrain-names-1"
        labels:
          - "Name"
  - choice: "Dharc-Metallik"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 1. Dharc-metallik 1]]#dharc-metallik-place-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 2. Dharc-metallik 2]]#dharc-metallik-place-names-quick-table"
    labels:
      - "Name"
      - "Name, quick"
  - choice: "High Metallik"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 3. High Metallik]]#high-metallik-place-names-table-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik/Metallik 3. High Metallik]]#high-metallik-place-names-table-2"
    labels:
      - "Name"
      - "Name, short"
  - choice: "Nanskrit"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 1. Personal Names]]#nanskrit-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 1. Personal Names]]#nanskrit-personal-feminine-names"
        labels:
          - "Name"
      - choice: "Settlement name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit/Nanskrit 4. City and Settlement names Nanskrit]]#nanskrit-city-and-settlement-names"
        labels:
          - "Name"
  - choice: "Nörslik"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 1. Personal names Nörslik 1]]#nrslik-masculine-personal-names-1"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 2. Personal names Nörslik 2]]#nrslik-feminine-personal-names"
        labels:
          - "Name"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik/Nörslik 4. Nörslik Terrain Feature names]]#nrslik-core-terrain-names"
        labels:
          - "Name"
  - choice: "Russlavik"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 1. Personal Names]]#russlavik-masculine-personal-names-1"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 1. Personal Names]]#russlavik-feminine-personal-names-1"
        labels:
          - "Name"
      - choice: "City name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik/Russlavik 2. Place names]]#short-russlavik-city-names"
        labels:
          - "Name"
  - choice: "Stygian-Egyptic"
    thenLabel: "Kind of name"
    then:
      - choice: "Personal name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-personal-names-masculine-and-feminine"
        labels:
          - "Name"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-terrain-names"
        labels:
          - "Name"
      - choice: "City name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-city-names"
        labels:
          - "Name"
  - choice: "Sub-Saharish"
    thenLabel: "Kind of name"
    then:
      - choice: "Personal or place name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-general-names"
        labels:
          - "Name"
      - choice: "Terrain name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-terrain-feature-names"
        labels:
          - "Name"
  - choice: "Teutonnic"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 2. Medieval Teutonnic 1]]#teutonnic-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 2. Medieval Teutonnic 1]]#teutonnic-feminine-personal-names"
        labels:
          - "Name"
      - choice: "Country, terrain or town name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic/Teutonnic 3. Medieval Teutonnic 2]]#teutonnic-countries-terrain-features-and-towns-1"
        labels:
          - "Name"
  - choice: "Trobadoric"
    thenLabel: "Kind of name"
    then:
      - choice: "Masculine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 1. Trobadoric Personal names]]#trobadoric-masculine-personal-names"
        labels:
          - "Name"
      - choice: "Feminine name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 1. Trobadoric Personal names]]#trobadoric-feminine-personal-names"
        labels:
          - "Name"
      - choice: "City or town name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric/Trobadoric 3. Trobadoric City and Settlement names]]#trobadoric-cities-and-towns"
        labels:
          - "Name"
  - choice: "Colossoponderous"
    thenLabel: "Kind of name"
    then:
      - choice: "Place or deity name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 1. Colossoponderous]]#colossoponderous-single-word-place-or-deity-names"
        labels:
          - "Name"
      - choice: "Place name, two words"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 1. Colossoponderous]]#colossoponderous-two-word-place-names"
        labels:
          - "Name"
  - choice: "Cthonic"
    thenLabel: "Kind of name"
    then:
      - choice: "Place name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 2. Cthonic]]#cthonic-single-word-place-names"
        labels:
          - "Name"
      - choice: "Place name, two words"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 2. Cthonic]]#cthonic-two-word-or-hyphenated-place-names"
        labels:
          - "Name"
  - choice: "Dreamlandish"
    thenLabel: "Kind of name"
    then:
      - choice: "Spellcaster, masculine"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 3. Dreamlandish 1]]#dreamlandish-powerful-spellcasters-masculine-short-name"
        labels:
          - "Name"
      - choice: "Spellcaster, feminine"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 3. Dreamlandish 1]]#dreamlandish-powerful-spellcasters-feminine-name"
        labels:
          - "Name"
      - choice: "Settlement name"
        tables:
          - "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish/Elderweirdish 5. Dreamlandish 3]]#dreamlandish-cities-and-settlements"
        labels:
          - "Name"
  - choice: "Primordial-Divine"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-short"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-hyphenated"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 1. Creator Deity Names]]#creator-deity-epithet"
    labels:
      - "Short name"
      - "Hyphenated name"
      - "& Epithet (optional)"
  - choice: "Eldritch God"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 2. Eldritch God Names]]#eldritch-god-names"
    labels:
      - "Name"
  - choice: "Angelic"
    tables:
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-names-1"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-names-2"
      - "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names/Primordial and Divine Names 4. Angelic Names]]#angelic-epithets"
    labels:
      - "Name"
      - "Name, variant"
      - "& Epithet (optional)"
  - choice: "Demonic"
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
    summary: Pick a naming style, then the kind of name, and roll that style's Nomicon tables.
    emits:
      - { oracle: { question: "What is {{subject}} called?" } }
      - "@name-generator"
      - { scene: { consequence: "{{subject}} is named {{result}}" } }
---
Pick a **naming style**. Where the style has several kinds of name (masculine, feminine, settlement, terrain or place), a second dropdown in the Log picks the kind, and only those Nomicon tables are rolled. A name made from a start and an ending shares one row, with a die for each part.
```
See [[00. Introduction|The Nomicon]] for what each naming group sounds like, and the chapters on titles and epithets for surnames and honorifics.
