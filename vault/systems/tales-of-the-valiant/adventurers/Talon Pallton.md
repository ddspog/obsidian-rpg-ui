---
cssclasses:
  - hide-title
  - hide-properties
---
```rpg character.header
classes:
  - name: [[Ranger]]
    level: 1
lineage:
  file: [[Elf]]
heritage:
  file: [[Acolyte ᴴ]]
  comment: for Lurker's Hall
background:
  file: [[Celebrity Adventurer's Scion ᴰ]]
xp: 88
luck: 0
banner: "#ac8080"
```
```rpg character.health
portrait: [[cleric-harold-davies.webp]]
max_hp: 10
current_hp: 10
temp_hp: 0
hit_dice:
  d10:
    max: 1
    current: 0
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
STR: 11
DEX: 18
CON: 11
INT: 8
WIS: 15
CHA: 9
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
  Ranger:
    Proficiencies:Tools:
      - "[[Herbalist Tools]]"
    Proficiencies:Skill P.:
      - "[[Athletics]]"
      - "[[Nature]]"
      - "[[Stealth]]"
    Explorer:
      - "[[Climbing]]"
  Acolyte ᴴ:
    Acolyte Features:Languages:
      - "[[Dwarvish]]"
      - "[[Elvish]]"
    Acolyte Features:ability:
      - WIS
  Celebrity Adventurer's Scion ᴰ:
    Celebrity Adventurer's Scion Features:Skill P.:
      - "[[Perception]]"
      - "[[Performance]]"
    Celebrity Adventurer's Scion Features:Languages:
      - "[[Undercommon]]"
    Talent:
      - "[[Noxious Apothecary]]"
trivialized:
  Acolyte ᴴ:
    "0": Acolyte Features
    Acolyte Features:
      - passive:Arcane Tricks
  Elf:
    "0": Elf Lineage Traits
    Elf Lineage Traits:
      - passive:Trance
```
## Spells
```rpg character.spells
style: [Shadow, Rune]
casters:
  Acolyte ᴴ:
    cantrips:
      - "[[Douse Light ᴷ]]"
```
## Inventory
```rpg character.inventory
items:
  - name: "[[Longbow]]"
    notes: Main
  - name: "[[Quiver]]"
    contents:
      - name: "[[Arrows]]"
        qty: 19
  - name: "[[Shortsword]]"
    qty: 2
    slot: main_hand
    notes: For melee, dual
  - name: "[[Leather]]"
    slot: armor
  - name: "[[Clothes, fine]]"
  - name: "[[Waterskin]]"
  - name: "[[Charlatan Tools]]"
  - name: "[[Kowyn's Bag]]"
    container: main
  - name: "[[Pouch]]"
    container: main
currency:
  pp: 0
  gp: 20
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
    - age: 24
      height: "4'7''"
      weight: "150 lb."
    - eyes: Dark Black
      skin: Light Brown
      hair: "Glowing Dark"
  body: |
    A young elf, middle size. Has a skin that blends with other normal elves, but his hair, always hidden, glows showing a mysterious heritage. Eyes in deep black. Hair short rarely requiring care.
  clothes: |
    Use elegant clothes, but fit for exploring with nature traces all over it. Has leather armor to protect itself, coated in green to blend in the environment. Always carries his cloak for protecting against harsh environments.
backstory:
  homeland: "unknown"        
  text: |
    As a child, had a close mother and a soldier father. Was created mostly by her during war times, living a modest life at a farm. Had some friends, living a peaceful childhood.

    His birthplace was assaulted by a horde of monsters. Alexis, his father (an old soldier) took him to live in the outskirts where they could be more protected with friends and allies (Mother destiny unknown). For strange reason he started to forgot his mother.

    The father, started working inside [[Lurker's Hall]], and that brought Talon to accompany on his missions, helping when he could in minor tasks. But his father is really famous, and brought a heavy role on Talon to be his Son. Eventually Talon enlist himself on Lurker's Hall to build fame for himself.
  highlights:
    - key: "Mystery Inheritance"
      value: "His race origins are a mystery, although he physically blend with normal people;"
    - key: "Mother Disappeared"
      value: "After attack on birthplace. Talon has little recollection, Father may know more; He has an unique heritage from his mother, that the father oath to protect (carries with him?). Could be Feylost, but forgotten about that; Having some ties and possible friends and rivals; Has/Gain a special trinket that give him some powers and guidance, where Ethos resides;"
allies:
  - name: "Alexis Pallton"
    role: "Father"
    portrait: "🪽"
    text: |
       Has a lot of respect to him, with his stories from war time. Having few memories of his mother, has grown pretty close to him, which is a lot to say about his father. A stern figure, stoic, Alexis isn't an affectionate father, but provides security with his experience and bulky figure.
  - name: "Marcel Battisti"
    portrait: "🪙"
    text: "Close friend from his father. An experienced merchant, that accompanies Alexis in travels, collecting treasures, making weapons, armors and other items. Talon see him as a mysterious figure, since not much about his past is know: He is an dwarf, has some ties to Lurker's Hall which brought him here, that's all."
  - name: "Sybil Nicholls"
    role: "Lover"
    portrait: "❤️"
    text: His first love. A friendly half-elf he met at Lurker's Hall. She became a Lurker as a Druid, and lives as a merchant, just managing, selling her herbs and some wood carvings.
enemies:
organizations:
  - name: "[[Lurker's Hall]]"
    portrait: "👤"
    text: "The famous hunter academy on [[Rindelbran]]. They are specialized in tracking: treasures, targets, game, weak points, etc. Not just rangers are formed there, but rogues, druids, etc. There's connection to other factions, where some missions can come to the people graduated there. After graduation, a Lurker can become a mercenary, soldier, investigator, thief, etc."
    position: "Graduating, on final quest for obtaining his Licensee."
motivation:
  - text: Scions of celebrity adventurers must deal with fame that’s not theirs, wealth they didn’t earn, and expectations they can never hope to meet. These hardships can have adverse effects, but those who cope with them can arrive at a decent attitude and a grounded worldview. Those who fail become bitter—or worse.
  - text: "I will never get out of my famous parent’s shadow, and adventuring is my attempt to prove myself."
```
