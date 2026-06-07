---
banner: "[[monster-vault-1.webp]]"
banner-height: 600
banner-y: 65
content-start: 425
source: From **Tales of the Valiant** "Monster Vault" by **Kobold Press**.
---
# Appendix, Creatures by Terrain
*Complete transcription of the "**Tales of the Valiant** Monster Vault" book by **Kobold Press**.*
```rpg list.any
name: [Any, CR]
paginate: auto
entries:
  - [Commoner, 0]
  - ["Bandit, Cultist, Guard, Kobold, Noble", 1/8]
  - ["Acolyte, Elf (Drow), Skeleton, Star Crow", 1/4]
  - ["Scout, Thug", 1/2]
  - ["Mage Apprentice, Spy, Vampire (Thrall)", 1]
  - ["Bandit Captain, Berserker, Cultist (Fanatic), Mechanist, Nimbostratus Spirit, Priest", 2]
  - ["Knight, Kobold (Swiftblade), Veteran", 3]
  - ["Bard, Chol (Col), Fey Guardian, Gladiator", 5]
  - [Mage, 6]
  - [Master Alchemist, 7]
  - [Assassin, 8]
  - ["Chol, Uulgol", 9]
  - [Sphinx (Gynosphinx),  11]
  - ["Archmage, Chol (Icthol)", 12]
  - [Living Colossus, 15]
  - ["Chol (Trillipol), Sphinx (Androsphinx)", 17]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Any/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.arctic
name: [Arctic, CR]
paginate: auto
entries:
  - [Owl, 0]
  - [Mephit (Ice), 1/2]
  - ["Dragon (White, Wyrmling), Tiger (Saber-Toothed)", 2]
  - [Winter Wolf, 3]
  - [Lycanthrope (Werebear), 5]
  - ["Dragon (White, Young), Mammoth", 6]
  - [Giant (Frost), 8]
  - [Remorhaz, 11]
  - ["Dragon (White, Adult)", 13]
  - ["Dragon (White, Ancient)", 17]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Arctic/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.badlands
name: [Badlands, CR]
paginate: auto
entries:
  - [Lizard, 0]
  - [Snake (Poisonous), 1/8]
  - ["Lizard (Giant), Snake (Giant Poisonous)", 1/4]
  - ["Robot (Drone), Worg", 1/2]
  - [Wyrdling, 1]
  - ["Snake (Swarm of Poisonous Snakes), Will-o'-Wisp", 2]
  - [Robot (Warden), 3]
  - ["Lamia, Selang", 4]
  - ["Drake (Scorch)", 6]
  - [Selang (Void Piper), 7]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Badlands/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.coastal
name: [Coastal, CR]
paginate: auto
entries:
  - ["Crab, Lizard", 0]
  - ["Merfolk, Snake (Poisonous)", 1/8]
  - ["Lizard (Giant), Snake (Giant Poisonous)", 1/4]
  - [Shuagin, 01/2]
  - ["Eagle (Giant), Frog (Giant Poisonous), Harpy I", 1]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Coastal/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.desert
name: [Desert, CR]
paginate: auto
entries:
  - ["Cat, Hyena, Insect (Poisonous), Jackal, Lizard, Spider, Vulture", 0]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Desert/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.farmland
name: [Farmland, CR]
paginate: auto
entries:
  - ["Badger, Bat, Cat, Deer, Frog, Goat, Hawk, Lizard, Owl, Rat, Raven, Weasel", 0]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Farmland/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.forest
name: [Forest, CR]
paginate: auto
entries:
  - ["Awakened Shrub, Badger, Cat, Deer, Frog, Fungi (Shrieker), Hawk, Hyena, Jackal, Lizard, Owi, Rat, Raven, Spider, Weasel", 0]
  - ["Baboon, Hawk (Blood), Mastiff, Snake (Flying), Snake (Poisonous), Stirge, Wild Warrior", 1/8]
  - ["Badger (Giant), Bat (Giant), Bat (Swarm of Bats), Blink Dog, Boar, Dragonette (Pseudodragon), Frog (Giant), Goblin, Lizard (Giant), Rat (Giant), Rat (Swarm of Rats), Raven (Swarm of Ravens), Snake (Constrictor), Snake (Giant Poisonous), Spider (Giant Wolf), Sprite, Weasel (Giant), Wolf", 1/4]
  - ["Ape, Bear (Black), Dinosaur (Velociraptor), Goblin (Hobgoblin), Insect (Giant Wasp), Insect (Swarm of Insects), Lizardfolk, Mycolid (Commoner), Orc, Satyr, Scout, Sporeborn (Skullbloom), Wood Herald, Worg", 1/2]
  - ["Dryad, Flinderbeast, Frog (Giant Poisonous), Goblin (Bugbear), Goblin (Goblin Captain), Hyena (Giant), Spider (Giant), Tiger, Wolf (Dire)", 1]
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Forest/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.grassland
name: [Grassland, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Grassland/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.hills
name: [Hills, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Hills/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.mountain
name: [Mountain, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Mountain/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.planar
name: [Planar, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Planar/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.swamp
name: [Swamp, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Swamp/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.underground
name: [Underground, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Underground/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.underwater
name: [Underwater, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Underwater/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```
```rpg list.urban
name: [Urban, CR]
paginate: auto
entries:
  - call: "@[[worldbuilding/bestiary/]].filter(habitat like /Urban/).group(cr).block(0)"
    format: [ "${links}", "${cr}" ]
```