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
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish]]#anglish-masculine", "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish]]#anglish-feminine", "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish]]#anglish-terrain-1", "@[[tales-of-the-valiant/compendium/the-nomicon/03. Anglish]]#anglish-terrain-3-endings"]
  - choice: Arabish
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish]]#arabish-masculine-names", "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish]]#arabish-feminine-names", "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish]]#arabish-terrain-feature-name", "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish]]#arabish-city-and-settlement-names-starting-syllables", "@[[tales-of-the-valiant/compendium/the-nomicon/05. Arabish]]#arabish-city-and-settlement-names-ending"]
  - choice: Brittonian (Gaelic)
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-masculine-personal-names-gaelic-start", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-masculine-personal-names-gaelic-ending", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-feminine-personal-names-gaelic", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonnian-country-names"]
  - choice: Brittonian (Welsh)
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-masculine-personal-names-welsh-1", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-masculine-personal-names-welsh-2", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-feminine-personal-names-welsh-part-1", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonian-feminine-personal-names-welsh-part-2", "@[[tales-of-the-valiant/compendium/the-nomicon/06. Brittonnian]]#brittonnian-bright-terrain-feature"]
  - choice: Celtigaulic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic]]#celtigaulic-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic]]#celtigaulic-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/07. Celtigaulic]]#celtigaulic-city-and-town-names"]
  - choice: Dwarven
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-1", "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-personal-names-table-2", "@[[tales-of-the-valiant/compendium/the-nomicon/08. Dwarven]]#dwarven-place-names-table-1"]
  - choice: East Asiantic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-cultures-and-countries", "@[[tales-of-the-valiant/compendium/the-nomicon/09. East-Asiantic]]#east-asiantic-terrain-features"]
  - choice: High Elven
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#high-elven-place-names"]
  - choice: Lower Elvish
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-masculine-names-wood-elves-etc", "@[[tales-of-the-valiant/compendium/the-nomicon/11. Elven]]#lower-elvish-feminine-names-wood-elves-etc"]
  - choice: Espannic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-feminine-personal-names-1", "@[[tales-of-the-valiant/compendium/the-nomicon/12. Espannic]]#espannic-terrain-and-region-names"]
  - choice: Eurovesian
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian]]#eurovesian-culture-or-country-name-table-1", "@[[tales-of-the-valiant/compendium/the-nomicon/13. Eurovesian]]#eurovesian-culture-or-country-name-table-2"]
  - choice: Hellenica
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica]]#hellenica-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica]]#hellenica-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/14. Hellenica]]#hellenica-city-names-1"]
  - choice: Italican
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican]]#italican-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican]]#italican-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/15. Italican]]#italican-culture-country-and-terrain-names-1"]
  - choice: Dharc-Metallik
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik]]#dharc-metallik-place-names-table-1", "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik]]#dharc-metallik-place-names-quick-table"]
  - choice: High Metallik
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik]]#high-metallik-place-names-table-1", "@[[tales-of-the-valiant/compendium/the-nomicon/16. Metallik]]#high-metallik-place-names-table-2"]
  - choice: Nanskrit
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit]]#nanskrit-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit]]#nanskrit-personal-feminine-names", "@[[tales-of-the-valiant/compendium/the-nomicon/17. Nanskrit]]#nanskrit-city-and-settlement-names"]
  - choice: Nörslik
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik]]#nrslik-masculine-personal-names-1", "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik]]#nrslik-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/18. Nörslik]]#nrslik-core-terrain-names"]
  - choice: Russlavik
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik]]#russlavik-masculine-personal-names-1", "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik]]#russlavik-feminine-personal-names-1", "@[[tales-of-the-valiant/compendium/the-nomicon/19. Russlavik]]#short-russlavik-city-names"]
  - choice: Stygian-Egyptic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-personal-names-masculine-and-feminine", "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-terrain-names", "@[[tales-of-the-valiant/compendium/the-nomicon/21. Stygian, Egyptic]]#stygianegyptic-city-names"]
  - choice: Sub-Saharish
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-general-names", "@[[tales-of-the-valiant/compendium/the-nomicon/20. Sequatorial]]#sequatorial-terrain-feature-names"]
  - choice: Teutonnic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic]]#teutonnic-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic]]#teutonnic-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/22. Teutonnic]]#teutonnic-countries-terrain-features-and-towns-1"]
  - choice: Trobadoric
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric]]#trobadoric-masculine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric]]#trobadoric-feminine-personal-names", "@[[tales-of-the-valiant/compendium/the-nomicon/23. Trobadoric]]#trobadoric-cities-and-towns"]
  - choice: Colossoponderous
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#colossoponderous-single-word-place-or-deity-names", "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#colossoponderous-two-word-place-names"]
  - choice: Cthonic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#cthonic-single-word-place-names", "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#cthonic-two-word-or-hyphenated-place-names"]
  - choice: Dreamlandish
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#dreamlandish-powerful-spellcasters-masculine-short-name", "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#dreamlandish-powerful-spellcasters-feminine-name", "@[[tales-of-the-valiant/compendium/the-nomicon/10. Elderweirdish]]#dreamlandish-cities-and-settlements"]
  - choice: Primordial-Divine
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#creator-deity-short", "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#creator-deity-hyphenated", "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#creator-deity-epithet"]
  - choice: Eldritch God
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#eldritch-god-names"]
  - choice: Angelic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#angelic-names-1", "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#angelic-names-2", "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#angelic-epithets"]
  - choice: Demonic
    tables: ["@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#demonic-name-part-1", "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#demonic-name-part-2", "@[[tales-of-the-valiant/compendium/the-nomicon/01. Primordial and Divine Names]]#evil-god-epithets"]
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
