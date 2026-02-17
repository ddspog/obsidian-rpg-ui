# D&D 5e Attribute Definitions

This file demonstrates the detailed attribute display format with descriptions.

```rpg system.attributes
- name: strength
  alias: STR
  subtitle: "Associated Skills: Athletics"
  description: |
    Strength measures bodily power, athletic aptitude, and the extent to which you can exert raw physical force. STR is used to:
    
    - Calculate attack rolls and damage with melee weapons
    - Determine how much weight can be lifted or carried
    
    Use STR for checks that involve feats of bodily force, such as:
    
    - Kicking down a door, breaking free of bonds, or smashing a lock
    - Pulling, pushing, or lifting heavy objects
    - Climbing a rope or swimming against the current
    - Resisting an attempt to grab, pull, or push you

- name: dexterity
  alias: DEX
  subtitle: "Associated Skills: Acrobatics, Sleight of Hand, Stealth"
  description: |
    Dexterity measures agility, reflexes, and balance. DEX is used to:
    
    - Calculate attack rolls and damage with ranged weapons or melee weapons with the finesse property
    - Calculate Armor Class
    - Determine initiative order during encounter gameplay
    
    Use DEX for checks that involve reflexes, precise motion, or swift response time such as:
    
    - Maintaining balance while on a moving vehicle or scooting along a narrow ledge
    - Picking a pocket without being noticed
    - Picking a lock or disabling a trap
    - Crafting a small or detailed object
    - Moving silently or sneaking up on prey
    - Resisting an attempt to grab, pull, or push you

- name: constitution
  alias: CON
  subtitle: "Associated Skills: None"
  description: |
    Constitution measures health, stamina, and vital force. CON is used to:
    
    - Calculate hit points (HP)
    
    Use CON for checks that involve endurance or weathering extreme conditions, such as:
    
    - Holding your breath
    - Extended marching or labor without rest
    - Going without sleep
    - Surviving without food or water
    - Quaffing an entire stein of ale in one go

- name: intelligence
  alias: INT
  subtitle: "Associated Skills: Arcana, History, Investigation, Nature, Religion"
  description: |
    Intelligence measures mental acuity, accuracy of recall, and the ability to reason. INT is used to:
    
    - Calculate certain class spellcasting abilities
    
    Use INT for checks to draw on logic, education, memory, or deductive reasoning, such as:
    
    - Communicating without using words
    - Estimating the value of a precious item
    - Forging a document
    - Recalling lore about a craft or trade
    - Winning a game of skill

- name: wisdom
  alias: WIS
  subtitle: "Associated Skills: Animal Handling, Insight, Medicine, Perception, Survival"
  description: |
    Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition. WIS is used to:
    
    - Calculate certain class spellcasting abilities
    
    Use WIS for checks to intuit clues about the environment and people or treat the injured, such as:
    
    - Getting a gut feeling about next steps
    - Discerning if a seemingly dead creature is Undead
    - Picking up on subtle signals happening around you
    - Bandage a wound or recognize a disease

- name: charisma
  alias: CHA
  subtitle: "Associated Skills: Deception, Intimidation, Performance, Persuasion"
  description: |
    Charisma measures your ability to interact with others and can represent a charming or commanding personality. CHA is used to:
    
    - Calculate certain class spellcasting abilities
    
    Use CHA for checks to influence or entertain, make an impression, tell a convincing lie, or navigate a tricky social situation, such as:
    
    - Finding the best person to talk to for news, rumors, and gossip
    - Pulling together a disguise to pass as a city guard
    - Blending into a crowd to get the sense of key topics of conversation
```

## Visual Display

When rendered in Reading View, each attribute appears as a D&D-style card with:

- **Header**: Attribute name in uppercase with alias (e.g., "STRENGTH (STR)")
- **Subtitle**: Italicized associated skills or special description
- **Description**: Full markdown-formatted description with bullet lists

The cards use a responsive grid layout and feature:
- Colored header backgrounds
- Hover effects
- Professional styling matching the plugin theme
- Support for markdown formatting in descriptions (bold, italic, lists, etc.)
