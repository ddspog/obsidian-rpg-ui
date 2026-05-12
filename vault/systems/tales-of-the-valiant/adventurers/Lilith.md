---
cssclasses:
  - hide-title
  - hide-properties
---
```rpg character.header
classes:
  - name: [[Fighter]]
    level: 1
lineage:
  file: [[Syderean]]
heritage:
  file: [[Cosmopolitan]]
  comment: (Baldur's Gate)
background:
  file: [[Sailor ᴰ]]
xp: 88
luck: 0
banner: "#ac8080"
```
```rpg character.health
portrait: [[cleric-harold-davies.webp]]
max_hp: 12
current_hp: 12
temp_hp: 0
hit_dice:
  d8:
    max: 1
    current: 1
death_saves:
  successes: 0
  failures: 0
exhaustion: 0
conditions:
initiative:
  proficiency: 0
  vantage: 0
  bonus: 0
natural_ac: 10
speed:
  value: 30
  type: walking
```
```rpg character.stats
STR: 18
DEX: 12
CON: 14
INT: 10
WIS: 8
CHA: 11
```
```rpg character.senses
```
```rpg character.skills
```
```rpg character.rolls
```
```rpg character.proficiencies
```
## Features
```rpg character.features
choices:
  Adherent:
    __auto_0:Tool P.:
      - "[[Charlatan Tools]]"
    __auto_0:Skill P.:
      - "[[Persuasion]]"
      - "[[Investigation]]"
    Talent:
      - "[[Ritualist]]"
  Druid:
    Proficiencies:
      - "[[Perception]]"
      - "[[Survival]]"
  Twisted Minion ᴴ:
    __auto_0:
      - "[[Draconic]]"
  Kobold:
    Kobold Lineage Traits:
      - Pack
  Fighter:
    Proficiencies:
      - "[[Intimidation]]"
      - "[[Insight]]"
  Syderean:
    Syderean Lineage Traits:
      - Dreadful Guise
  Cosmopolitan:
    __auto_0:
      - "[[Orcish]]"
      - "[[Gnomish]]"
      - "[[Elvish]]"
    Cosmopolitan Features:
      - "[[Orcish]]"
      - "[[Gnomish]]"
      - "[[Elvish]]"
  Sailor ᴰ:
    Talent:
      - "[[Vanguard]]"
```
## Spells
```rpg character.spells
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Glaive]]"
    notes: Main Weapon
    slot: main_hand
  - name: "[[Maul]]"
    notes: Bludgeoning
  - name: "[[Crossbow, light]]"
    notes: Ranged
  - name: "[[Quiver]]"
    contents:
      - name: "[[Crossbow Bolts]]"
        qty: 19
  - name: "[[Chain Mail]]"
    slot: armor
    notes: Heavy Armor, [[Noisy]]
  - name: "[[Clothes, common]]"
  - name: "[[Waterskin]]"
  - name: "[[Pouch]]"
    contents:
      - name: A belaying pin
      - name: A lucky charm
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
    - age: 34
      height: "6'3''"
      weight: "440 lb."
    - eyes: Green
      skin: Copperish
      hair: "Short, Dark Blonde"
  body: |
    Has a beautiful face with a short blonde hair, ornated by two small goat-like horns. Young, middle size, heavy but slim (weight in the bones). Copperish skin, and green eyes. She tends a lot on her looks when she got time to focus on that.
  clothes: |
    Normal clothes, white and brown colors, with a chain mail armor around. Wear basic adventures clothes, always prepared for emergencies. Has a side cloak to hid some stuff she carry, and use a hood when time requires her to hide her hornes.
backstory:
  homeland: "Baldur's Gate"  
  text: |
    Lilith was born in a cramped room within The Eager Turtle, an inn on Wyrm's Crossing in Baldur’s Gate. Her mother, Sedilia, a 59-year-old woman, worked there and lived nearby. Sauvage Eremon, a 61-year-old soldier, also lived with Sedilia but was away most of the time. Lilith was the fifth child, born during a tumultuous period in Baldur’s Gate. The presence of her small horns, her copper-toned skin, and her unnaturally heavy but slender frame filled Sedilia with despair.

    Considering the atmosphere in Baldur’s Gate, talk of a curse arose almost immediately. When Sauvage returned, he was horrified by Lilith’s appearance and soon decided to abandon her. At that time, Sedilia’s brother, Durant Phillippe—a 60-year-old man—assisted with the birth. Noticing Sauvage leaving with the infant, Durant followed and secretly took Lilith, raising her on his small farm near the sea, outside the city.

    Lilith had a simple childhood in a modest house, forming a few close friendships in the nearby village. Durant worked his farmland and traveled to Baldur’s Gate to sell his goods. Lilith, unhappy when left alone, loved hearing tales of the city and sometimes stowed away in Durant’s carts to visit in secret. Durant taught her how to conceal her fiendish traits; by letting her hair grow longer and using hoods, she managed to pass as a simple elf.

    In time, Lilith discovered her true heritage—something she hid from Durant. She also managed to meet her siblings and form a quiet bond with them: Andri, 43-year-old, who runs a decent farm near Baldur’s Gate; Andriet, 37, who works alongside Andri; Heloysis, a soldier of 40 years who is steadily rising through the ranks, much like their father; and Gile, a 42-year-old wanderer who joined a mining company and never returned.

    When Lilith was a teenager, a group of Reavers attacked the village near Durant’s farm, pillaging the area. She escaped by fleeing to the docks and boarding a small ship. From that day on, she lived as a sailor, taking work as a guard on various ships and at the docks she visited. As a tiefling, conflict often found her, so she honed her skills in wielding different weapons whenever she had the chance.

    Lilith’s maritime life was profitable; she amassed a modest fortune over the years. During her travels, she fell in love with Kastor Brontes, a 32-year-old bard who performed with a roaming troupe near Waterdeep. On the same day, however, she managed to earn the enmity of Dmitrei Nikola, a 43-year-old seafarer, by foiling a major heist. Dmitrei’s client, an infamous 292-year-old elf cleric named Erdan Meliamne, was also displeased and put criminal syndicates on Lilith’s trail.

    Fleeing Waterdeep, Lilith eventually made her way to the realm of [[Rindelbran]]. There, she learned of Lurker’s Hall and its network of secret contracts, and she soon found a place among their ranks.
  highlights:
    - key: "Abandoned"
      value: "She eventually learned that her own family abandoned her."
    - key: "Fleed from Home"
      value: "Fled after bandits attack. Fled from sailor's life."
    - key: "Prosperous Sailor"
      value: "Lived a prosperous life as a sailor. Someone eager to help in combat, face to face. An easy ticket to overseas. A good adventure hook to Baldur's Gate."
allies:
  - name: "Coral Reef Shipments"
    portrait: "📦"
    text: |
       A reputable merchant company operating throughout the Forgotten Realms, known for its vigilance against pirates and strong commitment to client trust. Lilith thrived under their banner, even taking command of her own vessel at times and honing her leadership skills on the high seas.
  - name: "Durant Phillippe"
    portrait: "🪽"
    role: "Guardian"
    text: "A patient, hardworking man who became a father figure to Lilith. He taught her practical life lessons, including how to defend herself. Although the Reavers once threatened them both, Durant managed to escape and still works around Baldur’s Gate, occasionally exchanging letters with Lilith about her adventures."
  - name: "Kastor Brontes"
    portrait: "❤️"
    role: "Lover"
    text: "A charismatic bard who travels with a nomadic troupe. Renowned for his mesmerizing performances, Kastor enjoys a devoted following throughout the realm. Despite her restless life, Lilith holds dear the moments she and Kastor spend together."
enemies:
  - name: "Reaver's Gang"
    portrait: "⚔️"
    text: "Lilith never discovered the precise identity of the gang that attacked her home. She gathered a few clues from their tattoos but never had the opportunity to investigate further. The memory of that assault drives her training, fueling her determination to one day confront them."
  - name: "Meliamne Family"
    portrait: "🪙"
    text: "A clandestine elven network rooted in Waterdeep’s underworld. Lilith is aware that her name appears in some of their records, though she’s uncertain of the full extent of their reach. What she does know is that their influence stretches overseas, where mercenaries and bandits carry out the Meliamnes’ bidding."
organizations:
  - name: "[[Lurker's Hall]]"
    portrait: "👤"
    text: "The famous hunter academy on [[Rindelbran]]. They are specialized in tracking: treasures, targets, game, weak points, etc. Not just rangers are formed there, but rogues, druids, etc. There's connection to other factions, where some missions can come to the people graduated there. After graduation, a Lurker can become a mercenary, soldier, investigator, thief, etc."
    position: "Graduating, on final quest for obtaining his Licensee."
motivation:
  - text: "Though some sailors are happy to remain with their crews, you ultimately parted ways for a life of land-based adventure."
  - text: "I’ve earned enough scars on the seas. Now I’ll earn gold on my own terms."
```