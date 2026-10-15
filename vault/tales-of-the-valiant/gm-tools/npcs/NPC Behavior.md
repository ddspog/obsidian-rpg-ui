---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
aliases:
  - NPC Actions
tab-icon: users
---
# NPC Behavior
```rpg feature.gm
id: npc-behavior
name: NPC Behavior
heading: none
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
generators:
  - id: npc-behavior
    name: NPC Behavior
    steps:
      - work: Approach
        choices: [Expected Action, Fate Question, Actions, Characters, Animal Actions, Character Actions Combat, Character Actions General, Character Conversations]
steps:
  - choice: Expected Action
    calc: "(note: A clear expectation for an action that isn't crucial — the NPC does what you expect.)"
  - choice: Fate Question
    calc: "d100= ->"
    likelihood: "50/50"
  - choice: Actions
    tables: ["@[[Actions Meaning]]#action-01", "@[[Actions Meaning]]#action-02"]
  - choice: Characters
    tables: ["@[[Character Descriptors]]#characters", "@[[Character Descriptors]]#characters"]
  - choice: Animal Actions
    tables: ["@[[Animal Actions]]#animal-actions", "@[[Animal Actions]]#animal-actions"]
  - choice: Character Actions Combat
    tables: ["@[[Character Descriptors]]#character-actions-combat", "@[[Character Descriptors]]#character-actions-combat"]
  - choice: Character Actions General
    tables: ["@[[Character Descriptors]]#character-actions-general", "@[[Character Descriptors]]#character-actions-general"]
  - choice: Character Conversations
    tables: ["@[[Character Descriptors]]#character-conversations", "@[[Character Descriptors]]#character-conversations"]
cards:
  - name: NPC Behavior
    stack: oracle
    rank: 3
    icon: "🎭"
    summary: Decide what an NPC does — follow your expectation, ask a Fate Question, or roll two words on a Meaning Table.
    emits:
      - { oracle: { question: "What does {{npc}} do?" } }
      - "@npc-behavior"
---
What does the NPC do? Pick the approach the moment calls for:

- **Expected Action** — you have a clear idea and it isn't crucial: they do it.
- **Fate Question** — you have an idea, but it matters: ask whether they do it.
- **A Meaning Table** — you have no idea: roll two words and interpret them. Actions suits any NPC; the Characters, Character Actions and Conversations tables suit people, Animal Actions creatures.
```

See [[Generating NPC Behavior]] for the full guidance and its examples.
