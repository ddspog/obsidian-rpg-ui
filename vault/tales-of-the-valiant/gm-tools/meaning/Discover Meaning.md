---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
aliases:
  - Meaning Tables
tab-icon: sparkles
---
# Discover Meaning
```rpg feature.gm
id: discover-meaning
name: Discover Meaning
heading: none
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
generators:
  - id: discover-meaning
    name: Discover Meaning
    steps:
      - work: Meaning
        choices: [Actions, Descriptions, Elements]
  - id: elements-table
    name: Elements Table
    steps:
      - work: Elements
        choices: ["Adventure Tone", "Plot Twists", "Alien Species Descriptors", "Animal Actions", "Army Descriptors", "Characters", "Character Actions Combat", "Character Actions General", "Character Appearance", "Character Background", "Character Conversations", "Character Descriptors", "Character Identity", "Character Motivations", "Character Personality", "Character Skills", "Character Traits & Flaws", "Civilization Descriptors", "Creature Descriptors", "Creature Abilities", "Undead Descriptors", "Cryptic Message", "Curses", "Dungeon Traps", "Gods", "Legends", "Cavern Descriptors", "City Descriptors", "Domicile Descriptors", "Dungeon Descriptors", "Forest Descriptors", "Locations", "Starship Descriptors", "Terrain Descriptors", "Magic Item Descriptors", "Mutation Descriptors", "Names", "Noble House", "Objects", "Powers", "Scavenging Results", "Smells", "Sounds", "Spell Effects", "Visions & Dreams"]
steps:
  - choice: Actions
    tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"]
  - choice: Descriptions
    tables: ["@[[Descriptions Meaning]]#description-01", "@[[Descriptions Meaning]]#description-02"]
  - choice: Elements
    tables: ["@[[Location Descriptors]]#locations", "@[[Character Descriptors]]#characters", "@[[Objects Descriptors]]#objects"]
    pick: 2
  - choice: "Adventure Tone"
    tables: ["@[[Adventure Tone & Plot Twists]]#adventure-tone", "@[[Adventure Tone & Plot Twists]]#adventure-tone"]
  - choice: "Plot Twists"
    tables: ["@[[Adventure Tone & Plot Twists]]#plot-twists", "@[[Adventure Tone & Plot Twists]]#plot-twists"]
  - choice: "Alien Species Descriptors"
    tables: ["@[[Alien Species Descriptors]]#alien-species-descriptors", "@[[Alien Species Descriptors]]#alien-species-descriptors"]
  - choice: "Animal Actions"
    tables: ["@[[Animal Actions]]#animal-actions", "@[[Animal Actions]]#animal-actions"]
  - choice: "Army Descriptors"
    tables: ["@[[Army Descriptors]]#army-descriptors", "@[[Army Descriptors]]#army-descriptors"]
  - choice: "Characters"
    tables: ["@[[Character Descriptors]]#characters", "@[[Character Descriptors]]#characters"]
  - choice: "Character Actions Combat"
    tables: ["@[[Character Descriptors]]#character-actions-combat", "@[[Character Descriptors]]#character-actions-combat"]
  - choice: "Character Actions General"
    tables: ["@[[Character Descriptors]]#character-actions-general", "@[[Character Descriptors]]#character-actions-general"]
  - choice: "Character Appearance"
    tables: ["@[[Character Descriptors]]#character-appearance", "@[[Character Descriptors]]#character-appearance"]
  - choice: "Character Background"
    tables: ["@[[Character Descriptors]]#character-background", "@[[Character Descriptors]]#character-background"]
  - choice: "Character Conversations"
    tables: ["@[[Character Descriptors]]#character-conversations", "@[[Character Descriptors]]#character-conversations"]
  - choice: "Character Descriptors"
    tables: ["@[[Character Descriptors]]#character-descriptors", "@[[Character Descriptors]]#character-descriptors"]
  - choice: "Character Identity"
    tables: ["@[[Character Descriptors]]#character-identity", "@[[Character Descriptors]]#character-identity"]
  - choice: "Character Motivations"
    tables: ["@[[Character Descriptors]]#character-motivations", "@[[Character Descriptors]]#character-motivations"]
  - choice: "Character Personality"
    tables: ["@[[Character Descriptors]]#character-personality", "@[[Character Descriptors]]#character-personality"]
  - choice: "Character Skills"
    tables: ["@[[Character Descriptors]]#character-skills", "@[[Character Descriptors]]#character-skills"]
  - choice: "Character Traits & Flaws"
    tables: ["@[[Character Descriptors]]#character-traits-and-flaws", "@[[Character Descriptors]]#character-traits-and-flaws"]
  - choice: "Civilization Descriptors"
    tables: ["@[[Civilization Descriptors]]#civilization-descriptors", "@[[Civilization Descriptors]]#civilization-descriptors"]
  - choice: "Creature Descriptors"
    tables: ["@[[Creature Descriptors]]#creature-descriptors", "@[[Creature Descriptors]]#creature-descriptors"]
  - choice: "Creature Abilities"
    tables: ["@[[Creature Descriptors]]#creature-abilities", "@[[Creature Descriptors]]#creature-abilities"]
  - choice: "Undead Descriptors"
    tables: ["@[[Creature Descriptors]]#undead-descriptors", "@[[Creature Descriptors]]#undead-descriptors"]
  - choice: "Cryptic Message"
    tables: ["@[[Cryptic Message]]#cryptic-message", "@[[Cryptic Message]]#cryptic-message"]
  - choice: "Curses"
    tables: ["@[[Curses Descriptors]]#curses", "@[[Curses Descriptors]]#curses"]
  - choice: "Dungeon Traps"
    tables: ["@[[Dungeon Traps Descriptors]]#dungeon-traps", "@[[Dungeon Traps Descriptors]]#dungeon-traps"]
  - choice: "Gods"
    tables: ["@[[Gods Descriptors]]#gods", "@[[Gods Descriptors]]#gods"]
  - choice: "Legends"
    tables: ["@[[Legends Descriptors]]#legends", "@[[Legends Descriptors]]#legends"]
  - choice: "Cavern Descriptors"
    tables: ["@[[Location Descriptors]]#cavern-descriptors", "@[[Location Descriptors]]#cavern-descriptors"]
  - choice: "City Descriptors"
    tables: ["@[[Location Descriptors]]#city-descriptors", "@[[Location Descriptors]]#city-descriptors"]
  - choice: "Domicile Descriptors"
    tables: ["@[[Location Descriptors]]#domicile-descriptors", "@[[Location Descriptors]]#domicile-descriptors"]
  - choice: "Dungeon Descriptors"
    tables: ["@[[Location Descriptors]]#dungeon-descriptors", "@[[Location Descriptors]]#dungeon-descriptors"]
  - choice: "Forest Descriptors"
    tables: ["@[[Location Descriptors]]#forest-descriptors", "@[[Location Descriptors]]#forest-descriptors"]
  - choice: "Locations"
    tables: ["@[[Location Descriptors]]#locations", "@[[Location Descriptors]]#locations"]
  - choice: "Starship Descriptors"
    tables: ["@[[Location Descriptors]]#starship-descriptors", "@[[Location Descriptors]]#starship-descriptors"]
  - choice: "Terrain Descriptors"
    tables: ["@[[Location Descriptors]]#terrain-descriptors", "@[[Location Descriptors]]#terrain-descriptors"]
  - choice: "Magic Item Descriptors"
    tables: ["@[[Magical Item Descriptors]]#magic-item-descriptors", "@[[Magical Item Descriptors]]#magic-item-descriptors"]
  - choice: "Mutation Descriptors"
    tables: ["@[[Mutation Descriptors]]#mutation-descriptors", "@[[Mutation Descriptors]]#mutation-descriptors"]
  - choice: "Names"
    tables: ["@[[Names]]#names", "@[[Names]]#names"]
  - choice: "Noble House"
    tables: ["@[[Noble House]]#noble-house", "@[[Noble House]]#noble-house"]
  - choice: "Objects"
    tables: ["@[[Objects Descriptors]]#objects", "@[[Objects Descriptors]]#objects"]
  - choice: "Powers"
    tables: ["@[[Powers Descriptors]]#powers", "@[[Powers Descriptors]]#powers"]
  - choice: "Scavenging Results"
    tables: ["@[[Scavenging Results]]#scavenging-results", "@[[Scavenging Results]]#scavenging-results"]
  - choice: "Smells"
    tables: ["@[[Smells & Sounds]]#smells", "@[[Smells & Sounds]]#smells"]
  - choice: "Sounds"
    tables: ["@[[Smells & Sounds]]#sounds", "@[[Smells & Sounds]]#sounds"]
  - choice: "Spell Effects"
    tables: ["@[[Spell Effects]]#spell-effects", "@[[Spell Effects]]#spell-effects"]
  - choice: "Visions & Dreams"
    tables: ["@[[Visions & Dreams]]#visions-and-dreams", "@[[Visions & Dreams]]#visions-and-dreams"]
cards:
  - name: Discover Meaning
    stack: meaning
    rank: 1
    icon: "✨"
    summary: Roll two words on the Actions, Descriptions or Elements tables to answer an open question.
    emits:
      - { oracle: { question: "{{question}}" } }
      - "@discover-meaning"
  - name: Roll an Elements Table
    stack: meaning
    rank: 2
    icon: "🧩"
    summary: Roll twice on one themed Elements table (Characters, Locations, Spell Effects…) for a specific detail.
    emits:
      - { oracle: { question: "{{question}}" } }
      - "@elements-table"
---
When an answer needs more than Yes or No — what is in the room, what the stranger wants, what the Random Event means — roll on a Meaning Table and interpret the two words it gives you through the [[Context]] of the moment.

**Actions** and **Descriptions** each roll two columns: a verb and a subject, or an adverb and an adjective. **Elements** draws from a themed table — two rolls on the one table — when the question is about something specific, like a [[Character Descriptors|character]] or a [[Location Descriptors|location]].
```

See [[Discovering Meaning]] for how to read the words, and [[Generating NPC Behavior]] for using them to decide what an NPC does.
