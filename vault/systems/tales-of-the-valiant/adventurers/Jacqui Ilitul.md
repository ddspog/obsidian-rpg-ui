```rpg character.sheet
# Header
classes:
  - name: [[Cleric]]
    level: 1
lineage:
  file: [[Human]]
heritage:
  file: [[Great House ᴷ]]
  comment: of [[Ilitul]] ([[Borelhearth]])
background:
  file: [[Adherent]]
  comment: to [[Lusanda, the Muse]]
xp: 88
luck: 0
banner: "#ac8080"
# Health
portrait: [[cleric-harold-davies.webp]]
max_hp: 9
current_hp: 9
temp_hp: 0
hit_dice:
  d8:
    max: 1
    current: 0
death_saves:
  successes: 0
  failures: 0
exhaustion: 0
conditions:
natural_ac: 10

# Attributes
STR: 14
DEX: 11
CON: 12
INT: 8
WIS: 18
CHA: 10
```
## Features
```rpg character.features
choices:
  Cleric:
    Proficiencies:
      - "[[Medicine]]"
      - "[[Insight]]"
    Manifestation of Faith:
      - Might
    Might:
      - "[[Warhammer]]"
  Human:
    Human Lineage Traits:Size:
      - Medium
    Human Lineage Traits:Skill P.:
      - "[[Stealth]]"
    Human Lineage Traits:Talent:
      - "[[Comrade]]"
  Great House:
    __auto_0:Languages:
      - "[[Dwarvish]]"
    __auto_0:Weapons:
      - "[[Northlands Estoc ᴷ]]"
  Adherent:
    __auto_0:Skill P.:
      - "[[Investigation]]"
      - "[[Religion]]"
    Talent:
      - "[[Field Medic]]"
    __auto_0:Tool P.:
      - "[[Constructor Tools]]"
    __auto_0:Tools:
      - "[[Constructor Tools]]"
  Great House ᴷ:
    __auto_0:Languages:
      - "[[Dwarvish]]"
    __auto_0:Weapons:
      - "[[Northlands Estoc ᴷ]]"
    Great House Features:Weapons:
      - "[[Northlands Estoc ᴷ]]"
    Great House Features:Languages:
      - "[[Dwarvish]]"
```
## Spells
```rpg character.spells
style: [Dream, Portal]
casters:
  Cleric:
    cantrips:
      - "[[Guidance]]"
      - "[[Luminous Bolt ᴷ]]"
      - "[[Message]]"
    prepared:
      "1":
        - "[[Arcane Mark ᴴ]]"
        - "[[Cure Wounds]]"
        - "[[Last Strike ᴷ]]"
        - "[[Lunarbolt Waxing ᴷ]]"
        - "[[Sanctuary]]"
    rituals:
      "1":
        - "[[Clue º]]"
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Warhammer]]"
    slot: main_hand
    notes: For melee range
  - name: "[[Chain Mail]]"
    slot: armor
    notes: Heavy Armor, [[Noisy]]
  - name: "[[Clothes, common]]"
    notes: (worn)
  - name: "[[Holy Symbol]]"
    notes: An amulet for [[Lusanda, the Muse]] (Under clothes)
  - name: "[[Holy Symbol]]"
    notes: An emblem of [[Aderyn, the Fuel]] (Near neck)
  - name: "[[Waterskin]]"
  - name: "[[Pouch]]"
    contents:
      - name: "[[Incense (one block) ᴺ]]"
      - name: "[[Prayer book ᴺ]]"
      - name: "[[Contract, Lurkers Hall ᴺ]]"
currency:
  pp: 0
  gp: 10
  sp: 0
  cp: 0
```
# Description
```rpg character.description
appearance:
  art:
    src: "[[mounted-combat.webp]]"
    fit: width
    align: top
  side_props:
    - age: 21
      height: "5'7''"
      weight: "200 lb."
    - eyes: Blue
      skin: Caucasian
      hair: "Short, blonde-silver"
  body: |
    With a striking face and short, blonde hair—a signature trait of the Ilitul family—Jacqui exudes an air of refined nobility. His youthful, medium build is complemented by his clean, fair skin and piercing blue eyes that hint at his distinguished lineage. His hair, though often neatly kept, grows slightly unkempt during his busier times.
  clothes: |
    Jacqui wears common clothes in brown, touched with a shimmering dark-blue comming from the [[Lusanda, the Muse]] faith. His attire is practical yet stylish, reflecting his noble heritage while remaining suitable for his clerical duties.
backstory:
  homeland: "[[Borelhearth]]"        
  text: |
    Jacqui was born to a couple from the Ilitul family. His mother bore the prestigious Ilitul name, while his father belonged to an unknown noble lineage. He was born in a secret [[Lusanda]] Temple dedicated to [[Twilight]], during a time when his family desperately sought peaceful endings to their conflicts. From birth, Jacqui was destined to become an [[Lusanda]] cleric, serving his family by bringing prosperity to their city and business. Mysteriously, both his parents vanished, an event shrouded in secrecy that erased them from the memory of all who knew them. By that time, the family had grown to include 11 children.

    The family came under the care of Caleb Ilitul, a cheerful uncle aged 51, who took them to a sprawling goat farm outside [[Borelhearth]]. There, Jacqui was raised alongside his siblings. Caleb managed the estate with the help of Bjarte, his 23-year-old sibling most invested in the business. The eldest brother, Eric, at 27, pursued a bardic career in Borelhearth, becoming an entertainer. Leif, 26, and Ivar, 19, moved to the city to engage in politics on behalf of the Ilitul family. Olga, 25, embarked on a scholarly path, working in Borelhearth's libraries. The younger siblings—Erland, 16; Ingrid, 13; Dagmar, 10; Sten, 7; and Hjalmar, 4—remained apprentices under Bjarte’s supervision on the farm. Despite his large family, Jacqui often felt isolated, seen as peculiar among his peers.

    After his father’s disappearance, Bjarte learned of the unfulfilled promise of Jacqui’s clerical future. But, the temple where Jacqui was born, was destroyed. Fearing divine retribution, Bjarte searched for other temples, and using his connections sent Jacqui on an immediate pilgrimage to the secret [[Treyfell]] temple for [[Lusanda]]. This abrupt departure strained Jacqui’s relationships with Eric and Bjarte, who were especially close to him. At that time, Caleb suffered a severe injury, forcing Bjarte to assume greater responsibilities. Leif and Ivar also faced setbacks, as the family’s political standing deteriorated.

    In [[Treyfell]], Jacqui learned of rites, and of its cult enemy: the [[Lladeryn]] faith. Soon, Jacqui was entangled in a plot by local nobles who accused him of fraud to extort money from his family. Fleeing, Jacqui took refuge on a village near Wisdom’s Path, where he fell in love with Meriele Tiltathana, a local elf. Through her, Jacqui learned about the renowned [[Lurker’s Hall]], sparking his ambition to join its ranks. He hoped the Lurkers could eventually help him make the [[Lusanda]] faith stronger.

    Jacqui remains determined to restore the honor of the Ilitul name and bring glory to his family.

  highlights:
    - key: "Parents Forgotten"
      value: "This parents disappeared after an uknown event, that magically erase their memories from their peers."
    - key: "Active Siblings"
      value: "Various brothers and sisters are active in Waterdeep, taking care of the family business."
    - key: "Birth Promise"
      value: "From birth, promised to become a cleric. _A character with good connections to nobility._"
allies:
  - name: "Caleb Ilitul"
    role: "Guardian"
    portrait: "🪽"
    text: |
       A dear uncle in his early fifties who provided Jacqui with invaluable life lessons. Caleb served as the primary tutor for all his siblings, imparting extensive knowledge about [[Borelhearth]], noble customs, and the workings of the family farm.
  - name: "Meriele Tiltathana"
    portrait: "❤️"
    role: "Lover"
    text: "A kind-hearted elf ranger who lovingly tends to a small farm near Wisdom's Path. Meriele’s steadfast nature and connection to the land make her a source of inspiration and grounding for Jacqui."
  - name: "Great House of Ilitul"
    portrait: "🛡️"
    text: "The Ilitul family amassed their wealth as goat herders before diversifying into mercenary ventures. Their grand villa in the Sea Ward, situated at the intersection of Ivory Street and the Streets of Whispers and Singing Dolphin, symbolizes their stature. Opposite their villa stands the Emveolstone family estate, while the nearby Shrines of Nature and the Melshimber villa surround their domain. Outside the city, they maintain extensive goat herds, cementing their reputation as industrious and resourceful landowners."
enemies:
  - name: "Thorp Family"
    portrait: "🤼"
    text: "During the early 1370s DR, a bitter feud erupted between the Ilitul and Thorp families when Guster Ilitul was infamously seen strangling Delbert Thorp during the second annual Black Bucket Hunt. This shocking event occurred while both parties were navigating the dangers of the [[Slitters]] caves. The incident was witnessed by many through a modified arcane eye spell, which projected the gruesome scene for all to see."
organizations:
  - name: "[[Lurker's Hall]]"
    portrait: "👤"
    text: "The famous hunter academy on [[Rindelbran]]. They are specialized in tracking: treasures, targets, game, weak points, etc. Not just rangers are formed there, but rogues, druids, etc. There's connection to other factions, where some missions can come to the people graduated there. After graduation, a Lurker can become a mercenary, soldier, investigator, thief, etc."
    position: "Graduating, on final quest for obtaining his Licensee."
motivation:
  - text: "Many adherents don’t stray far from the object of their devotion. Those who roam often do so for reasons specific to their order."
  - text: "Adventuring frees me to practice more unorthodox methods of worship."
```