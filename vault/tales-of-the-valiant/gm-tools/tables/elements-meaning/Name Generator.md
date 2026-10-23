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
    tables: ["@[[03. Anglish]]#anglish-masculine", "@[[03. Anglish]]#anglish-feminine", "@[[03. Anglish]]#anglish-terrain-1", "@[[03. Anglish]]#anglish-terrain-3-endings"]
  - choice: Arabish
    tables: ["@[[05. Arabish]]#arabish-masculine-names", "@[[05. Arabish]]#arabish-feminine-names", "@[[05. Arabish]]#arabish-terrain-feature-name", "@[[05. Arabish]]#arabish-city-and-settlement-names-starting-syllables", "@[[05. Arabish]]#arabish-city-and-settlement-names-ending"]
  - choice: Brittonian (Gaelic)
    tables: ["@[[06. Brittonnian]]#brittonian-masculine-personal-names-gaelic-start", "@[[06. Brittonnian]]#brittonian-masculine-personal-names-gaelic-ending", "@[[06. Brittonnian]]#brittonian-feminine-personal-names-gaelic", "@[[06. Brittonnian]]#brittonnian-country-names"]
  - choice: Brittonian (Welsh)
    tables: ["@[[06. Brittonnian]]#brittonian-masculine-personal-names-welsh-1", "@[[06. Brittonnian]]#brittonian-masculine-personal-names-welsh-2", "@[[06. Brittonnian]]#brittonian-feminine-personal-names-welsh-part-1", "@[[06. Brittonnian]]#brittonian-feminine-personal-names-welsh-part-2", "@[[06. Brittonnian]]#brittonnian-bright-terrain-feature"]
  - choice: Celtigaulic
    tables: ["@[[07. Celtigaulic]]#celtigaulic-masculine-personal-names", "@[[07. Celtigaulic]]#celtigaulic-feminine-personal-names", "@[[07. Celtigaulic]]#celtigaulic-city-and-town-names"]
  - choice: Dwarven
    tables: ["@[[08. Dwarven]]#dwarven-personal-names-table-1", "@[[08. Dwarven]]#dwarven-personal-names-table-2", "@[[08. Dwarven]]#dwarven-place-names-table-1"]
  - choice: East Asiantic
    tables: ["@[[09. East-Asiantic]]#east-asiantic-cultures-and-countries", "@[[09. East-Asiantic]]#east-asiantic-terrain-features"]
  - choice: High Elven
    tables: ["@[[11. Elven]]#high-elven-masculine-personal-names", "@[[11. Elven]]#high-elven-feminine-personal-names", "@[[11. Elven]]#high-elven-place-names"]
  - choice: Lower Elvish
    tables: ["@[[11. Elven]]#lower-elvish-masculine-names-wood-elves-etc", "@[[11. Elven]]#lower-elvish-feminine-names-wood-elves-etc"]
  - choice: Espannic
    tables: ["@[[12. Espannic]]#espannic-masculine-personal-names", "@[[12. Espannic]]#espannic-feminine-personal-names-1", "@[[12. Espannic]]#espannic-terrain-and-region-names"]
  - choice: Eurovesian
    tables: ["@[[13. Eurovesian]]#eurovesian-culture-or-country-name-table-1", "@[[13. Eurovesian]]#eurovesian-culture-or-country-name-table-2"]
  - choice: Hellenica
    tables: ["@[[14. Hellenica]]#hellenica-masculine-personal-names", "@[[14. Hellenica]]#hellenica-feminine-personal-names", "@[[14. Hellenica]]#hellenica-city-names-1"]
  - choice: Italican
    tables: ["@[[15. Italican]]#italican-masculine-personal-names", "@[[15. Italican]]#italican-feminine-personal-names", "@[[15. Italican]]#italican-culture-country-and-terrain-names-1"]
  - choice: Dharc-Metallik
    tables: ["@[[16. Metallik]]#dharc-metallik-place-names-table-1", "@[[16. Metallik]]#dharc-metallik-place-names-quick-table"]
  - choice: High Metallik
    tables: ["@[[16. Metallik]]#high-metallik-place-names-table-1", "@[[16. Metallik]]#high-metallik-place-names-table-2"]
  - choice: Nanskrit
    tables: ["@[[17. Nanskrit]]#nanskrit-masculine-personal-names", "@[[17. Nanskrit]]#nanskrit-personal-feminine-names", "@[[17. Nanskrit]]#nanskrit-city-and-settlement-names"]
  - choice: Nörslik
    tables: ["@[[18. Nörslik]]#nrslik-masculine-personal-names-1", "@[[18. Nörslik]]#nrslik-feminine-personal-names", "@[[18. Nörslik]]#nrslik-core-terrain-names"]
  - choice: Russlavik
    tables: ["@[[19. Russlavik]]#russlavik-masculine-personal-names-1", "@[[19. Russlavik]]#russlavik-feminine-personal-names-1", "@[[19. Russlavik]]#short-russlavik-city-names"]
  - choice: Stygian-Egyptic
    tables: ["@[[21. Stygian, Egyptic]]#stygianegyptic-personal-names-masculine-and-feminine", "@[[21. Stygian, Egyptic]]#stygianegyptic-terrain-names", "@[[21. Stygian, Egyptic]]#stygianegyptic-city-names"]
  - choice: Sub-Saharish
    tables: ["@[[20. Sequatorial]]#sequatorial-general-names", "@[[20. Sequatorial]]#sequatorial-terrain-feature-names"]
  - choice: Teutonnic
    tables: ["@[[22. Teutonnic]]#teutonnic-masculine-personal-names", "@[[22. Teutonnic]]#teutonnic-feminine-personal-names", "@[[22. Teutonnic]]#teutonnic-countries-terrain-features-and-towns-1"]
  - choice: Trobadoric
    tables: ["@[[23. Trobadoric]]#trobadoric-masculine-personal-names", "@[[23. Trobadoric]]#trobadoric-feminine-personal-names", "@[[23. Trobadoric]]#trobadoric-cities-and-towns"]
  - choice: Colossoponderous
    tables: ["@[[10. Elderweirdish]]#colossoponderous-single-word-place-or-deity-names", "@[[10. Elderweirdish]]#colossoponderous-two-word-place-names"]
  - choice: Cthonic
    tables: ["@[[10. Elderweirdish]]#cthonic-single-word-place-names", "@[[10. Elderweirdish]]#cthonic-two-word-or-hyphenated-place-names"]
  - choice: Dreamlandish
    tables: ["@[[10. Elderweirdish]]#dreamlandish-powerful-spellcasters-masculine-short-name", "@[[10. Elderweirdish]]#dreamlandish-powerful-spellcasters-feminine-name", "@[[10. Elderweirdish]]#dreamlandish-cities-and-settlements"]
  - choice: Primordial-Divine
    tables: ["@[[01. Primordial and Divine Names]]#creator-deity-short", "@[[01. Primordial and Divine Names]]#creator-deity-hyphenated", "@[[01. Primordial and Divine Names]]#creator-deity-epithet"]
  - choice: Eldritch God
    tables: ["@[[01. Primordial and Divine Names]]#eldritch-god-names"]
  - choice: Angelic
    tables: ["@[[01. Primordial and Divine Names]]#angelic-names-1", "@[[01. Primordial and Divine Names]]#angelic-names-2", "@[[01. Primordial and Divine Names]]#angelic-epithets"]
  - choice: Demonic
    tables: ["@[[01. Primordial and Divine Names]]#demonic-name-part-1", "@[[01. Primordial and Divine Names]]#demonic-name-part-2", "@[[01. Primordial and Divine Names]]#evil-god-epithets"]
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
