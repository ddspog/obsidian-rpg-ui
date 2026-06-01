# Spell-list block — Arcane pilot (full)

Full Arcane source rendered with `rpg list.*`: official spells/rituals as fixed lines per circle, plus a live call per circle that pulls every Arcane file. `.highlight()` flags **homebrew** rows — any spell whose `source:` frontmatter isn't an official source (set per-system in plugin settings; e.g. add `Tales of the Valiant` for this system). Spell circles merge into one paginated view; rituals into another. Real `Arcane.md` untouched. Folders only exist for cantrips / 1st / 2nd / 3rd / 1st-ritual — calls on circles without folders simply add nothing yet.

## Spell List

```rpg list.arcane-cantrips
name: Cantrips
paginate: auto
entries:
  - "_Acid Splash_ (Conjuration) Acid bursts over foes."
  - "_Dancing Lights_ (Evocation) Make and control four lights."
  - "_Fire Bolt_ (Evocation) Fire harms foe, ignites objects."
  - "_Grave Touch_ (Necromancy) Necrotic harm, prevent healing."
  - "_Light_ (Evocation) Object emits bright light."
  - "_Mending_ (Transmutation) Minor repairs to an object."
  - "_Poison Spray_ (Conjuration) Poison foe at 10 ft."
  - "_Prestidigitation_ (Transmutation) Harmless magical effect."
  - "_Ray of Frost_ (Evocation) Cold harms and slows foe."
  - "_Shocking Grasp_ (Evocation) Lightning harms and slows."
  - "_Vicious Mockery_ (Enchantment) Psychic harm and disadvantage."
  - "_Lightning Lure ᴷ_ (Evocation) Attract and shock someone."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/cantrips/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-1st
name: 1st Circle
entries:
  - "_Burning Hands_ (Evocation) Fire harms foes, ignites objects."
  - "_Charm_ (Enchantment) Compel creature to trust you."
  - "_Color Spray_ (Illusion) 15-ft. cone of light blinds foes."
  - "_Comprehend Languages_ (Divination) Understand literal meanings."
  - "_Detect Magic_ (Divination) _Sense nearby magic._"
  - "_Disguise Self_ (Illusion) Change your basic appearance."
  - "_Expeditious Retreat_ (Transmutation) Dash as a bonus action."
  - "_False Life_ (Necromancy) Gain temporary hit points."
  - "_Feather Fall_ (Transmutation) Targets fall slowly."
  - "_Floating Disk_ (Conjuration) Floating platform carries 500 lbs."
  - "_Fog Cloud_ (Conjuration) Fog obscures an area."
  - "_Grease_ (Conjuration) Create slippery terrain."
  - "_Hideous Laughter_ (Enchantment) Foe laughs uncontrollably."
  - "_Longstrider_ (Transmutation) Boost speed and jump distance."
  - "_Mage Armor_ (Abjuration) Protect an unarmored ally."
  - "_Magic Missile_ (Evocation) Guaranteed force damage."
  - "_Pendulum_ (Enchantment) Alter target’s probabilities."
  - "_Shield_ (Abjuration) Repel an incoming attack."
  - "_Silent Image_ (Illusion) Make a small visual illusion."
  - "_Thunderwave_ (Evocation) Push and damage foes."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-2nd
name: 2nd Circle
entries:
  - "_Acid Arrow_ (Evocation) Ranged acid attack."
  - "_Blindness/Deafness_ (Necromancy) Blind or deafen foe."
  - "_Blur_ (Illusion) Blur self to give disadvantage."
  - "_Continual Flame_ (Evocation) Heatless, long-lasting flame."
  - "_Darkness_ (Evocation) 15-ft. radius magical darkness."
  - "_Darkvision_ (Transmutation) Allies can see in the dark."
  - "_Detect Thoughts_ (Divination) Know a creature’s thoughts."
  - "_Elemental Blade_ (Evocation) Deal melee elemental damage."
  - "_Enlarge/Reduce_ (Transmutation) Alter a target’s size."
  - "_Flaming Sphere_ (Evocation) Move fire to harm and ignite."
  - "_Gear Barrage_ (Conjuration) Cone of gears deals slashing."
  - "_Gust of Wind_ (Evocation) Wind pushes and disperses."
  - "_Heat Metal_ (Transmutation) Make metal too hot to use."
  - "_Hold_ (Enchantment) Paralyze a Medium creature."
  - "_Invisibility_ (Illusion) Ally becomes invisible."
  - "_Knock_ (Transmutation) Open a locked object."
  - "_Levitate_ (Transmutation) Target hovers at your command."
  - "_Magic Weapon_ (Transmutation) Enchant a weapon for 1 hour."
  - "_Mirror Image_ (Illusion) Copies of you deflect attacks."
  - "_Misty Step_ (Conjuration) Quick teleport at short range."
  - "_Ray of Enfeeblement_ (Necromancy) Sap a foe’s strength."
  - "_Rope Trick_ (Conjuration) Extradimensional hideaway."
  - "_Scorching Ray_ (Evocation) Launch three fire rays."
  - "_See Invisibility_ (Divination) See invisible and ethereal."
  - "_Shatter_ (Evocation) 10-ft. radius thunder."
  - "_Spider Climb_ (Transmutation) Walk on walls and ceilings."
  - "_Suggestion_ (Enchantment) Creature obeys your order."
  - "_Web_ (Conjuration) 20-ft. cube of sticky web."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/2nd-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-3rd
name: 3rd Circle
entries:
  - "_Blink_ (Transmutation) Fast shift to ethereal and back."
  - "_Counterspell_ (Abjuration) Interrupt target’s spell."
  - "_Dispel Magic_ (Abjuration) Break an ongoing spell."
  - "_Fear_ (Illusion) Frighten a group."
  - "_Fireball_ (Evocation) Explode fire in 20-ft. radius."
  - "_Fly_ (Transmutation) Ally gets 60 ft. flying speed."
  - "_Gaseous Form_ (Transmutation) Ally becomes a slow cloud."
  - "_Haste_ (Transmutation) Ally speed × 2, +2 AC, more fast boosts."
  - "_Hypnotic Pattern_ (Illusion) Charm foes in 30-ft. cube."
  - "_Lightning Bolt_ (Evocation) Deal lightning in a line."
  - "_Major Image_ (Illusion) Make a complex illusion."
  - "_Nondetection_ (Abjuration) Hide target from divination."
  - "_Protection from Energy_ (Abjuration) Ally has damage type resistance."
  - "_Sending_ (Enchantment) Send a 25-word message anywhere."
  - "_Slow_ (Transmutation) Foes move and act slowly."
  - "_Stinking Cloud_ (Conjuration) 20-ft. cloud nauseates, obscures."
  - "_Tongues_ (Divination) Target understands all language."
  - "_Vampiric Touch_ (Necromancy) Harm another to heal yourself."
  - "_Water Breathing_ (Transmutation) Allies breathe underwater."
  - "_Wind Wall_ (Evocation) Shape a wall of strong wind."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/3rd-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-4th
name: 4th Circle
entries:
  - "_Arcane Eye_ (Divination) Floating eye to spy through."
  - "_Banishment_ (Abjuration) Send target to another plane for 1 min."
  - "_Compulsion_ (Enchantment) Charm foes to move as you will."
  - "_Confusion_ (Enchantment) Targets act at random."
  - "_Conjure Minor Elementals_ (Conjuration) Call Elementals to help."
  - "_Dimension Door_ (Conjuration) Teleport 500 ft. for two."
  - "_Elemental Shield_ (Evocation) Resist an element, deal it when hit."
  - "_Freedom of Movement_ (Abjuration) Ally can’t be slowed or hindered."
  - "_Greater Invisibility_ (Illusion) Better _invisibility_."
  - "_Ice Storm_ (Evocation) Bludgeoning and cold hail."
  - "_Phantasmal Killer_ (Illusion) Frighten, psychic to foe."
  - "_Polymorph_ (Transmutation) Turn creature into a Beast."
  - "_Resilient Sphere_ (Evocation) Target in sphere can’t be hurt."
  - "_Wall of Fire_ (Evocation) Shape fire wall that deals fire."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/4th-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-5th
name: 5th Circle
entries:
  - "_Animate Objects_ (Transmutation) Objects become Constructs for 1 min."
  - "_Arcane Hand_ (Evocation) Giant fist fights for you."
  - "_Cloudkill_ (Conjuration) 20-ft. cloud deals poison."
  - "_Cone of Cold_ (Evocation) 60-ft. cone of cold."
  - "_Conjure Elemental_ (Conjuration) Call an Elemental to help."
  - "_Dominate_ (Enchantment) Control a Medium creature."
  - "_Greater Hold_ (Enchantment) Paralyze any creature."
  - "_Legend Lore_ (Divination) Instantly know about a legend."
  - "_Mislead_ (Illusion) Make decoy, become invisible."
  - "_Modify Memory_ (Enchantment) Change memory of an event."
  - "_Passwall_ (Transmutation) Make an opening on a surface."
  - "_Seeming_ (Illusion) _Disguise self_ for a group."
  - "_Telekinesis_ (Transmutation) Move targets with your mind."
  - "_Telepathic Bond_ (Divination) Connect allies’ thoughts."
  - "_Wall of Force_ (Evocation) Shape force wall to block passage."
  - "_Wall of Stone_ (Evocation) Shape a thick stone wall."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/5th-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-6th
name: 6th Circle
entries:
  - "_Blade Barrier_ (Evocation) Make a wall of deadly blades."
  - "_Chain Lightning_ (Evocation) Lightning to targets in series."
  - "_Circle of Death_ (Necromancy) Necrotic in 60-ft. radius."
  - "_Disintegrate_ (Transmutation) Force, utter destruction at 0 HP."
  - "_Freezing Sphere_ (Evocation) Cold sphere, use now or later."
  - "_Globe of Invulnerability_ (Abjuration) Block spells in 10-ft. radius of you."
  - "_Irresistible Dance_ (Enchantment) Foe dances uncontrollably."
  - "_Mass Suggestion_ (Enchantment) Group obeys your order."
  - "_Programmed Illusion_ (Illusion) Complex illusion acts on cue."
  - "_True Seeing_ (Divination) Ally sees things truly."
  - "_Wall of Ice_ (Evocation) Shape ice wall that deals cold."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/6th-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-7th
name: 7th Circle
entries:
  - "_Arcane Sword_ (Evocation) Sword fights for you."
  - "_Delayed Blast Fireball_ (Evocation) _Fireball_, after a delay."
  - "_Etherealness_ (Transmutation) Travel to, in Ethereal Plane."
  - "_Finger of Death_ (Necromancy) Major necrotic, zombify Humanoid."
  - "_Fire Storm_ (Evocation) Ten 10-ft. cubes of fire."
  - "_Forcecage_ (Evocation) Imprison foes for 1 hour."
  - "_Prismatic Spray_ (Evocation) Rainbow rays deal random effects."
  - "_Project Image_ (Illusion) Perceive through illusion of you."
  - "_Reverse Gravity_ (Transmutation) Down is up in 50-ft. radius."
  - "_Sequester_ (Transmutation) Hide target in stasis."
  - "_Teleport_ (Conjuration) Send allies anywhere you know."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/7th-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-8th
name: 8th Circle
entries:
  - "_Antimagic Field_ (Abjuration) No magic works in 10-ft. radius of you."
  - "_Demiplane_ (Conjuration) Door to a small dimension."
  - "_Feeblemind_ (Enchantment) Deal psychic; foe’s INT, CHA = 1."
  - "_Glibness_ (Transmutation) Your CHA check, save roll is 15."
  - "_Greater Dominate_ (Enchantment) Control any creature."
  - "_Incendiary Cloud_ (Conjuration) 20-ft. radius fire cloud for 1 min."
  - "_Maze_ (Conjuration) Send target to demiplane maze."
  - "_Mind Blank_ (Abjuration) Block all mental effects."
  - "_Power Word Stun_ (Enchantment) Stun a foe up to 150 HP."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/8th-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-9th
name: 9th Circle
entries:
  - "_Gate_ (Conjuration) Link to another plane."
  - "_Meteor Swarm_ (Evocation) Rain massive harm in huge area."
  - "_Power Word Kill_ (Enchantment) Kill a foe up to 100 HP."
  - "_Prismatic Wall_ (Abjuration) Rainbow wall deals layers of harm."
  - "_Time Stop_ (Transmutation) Take 1d4 + 1 turns in a row."
  - "_True Polymorph_ (Transmutation) Turn target into anything."
  - "_Weird_ (Illusion) Better _phantasmal killer_."
  - "_Wish_ (Conjuration) Wish for anything."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/9th-circle/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

## Ritual List

```rpg list.arcane-ritual-1st
name: 1st Circle
paginate: auto
entries:
  - "_Alarm_ (Abjuration) Set an alarm for intruders."
  - "_Create Familiar_ (Transmutation) Make a Beast to serve you."
  - "_Illusory Script_ (Illusion) Write hidden messages."
  - "_Unseen Servant_ (Conjuration) Make an invisible helper."
  - "*Distort Value ᴰ* (Illusion) Alter perception of an object value."
  - "*Gift of Alacrity ᴰ* (Divination) Enhance initiative."
  - "*Snare ᴰ* (Abjuration) Prepare a rope trap."
  - "*Fixit ᴴ* (Transmutation) Maintain a broken item whole for a time."
  - "*Flipperform ᴴ* (Transmutation) Morph a willing creature to swim."
  - "*Exhume ᴴ* (Necromancy) Form a pile of humanoid bones."
  - "*Memorize ᴴ* (Enchantment) For a year memorize something without fail."
  - "*Rumor ᴴ* (Enchantment) Spread a 10-word rumor."
  - "*Transient Bulwark ᴴ* (Abjuration) Defend against a first attack."
  - "*Remembrance ᴴ* (Divination) Pick a short message to remember at a certain time."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/1st-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-2nd
name: 2nd Circle
entries:
  - "_Arcane Lock_ (Abjuration) Lock a door, chest, etc."
  - "_Arcanist’s Magic Aura_ (Illusion) Ally deceives divinations."
  - "_Locate_ (Divination) Find a target."
  - "_Magic Mouth_ (Illusion) Object speaks your message."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/2nd-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-3rd
name: 3rd Circle
entries:
  - "_Animate Dead_ (Necromancy) Make a skeleton or zombie."
  - "_Clairvoyance_ (Divination) View or hear up to 1 mile away."
  - "_Glyph of Warding_ (Abjuration) Leave an invisible trap."
  - "_Magic Circle_ (Abjuration) Ward against creature types."
  - "_Tiny Hut_ (Evocation) Dome blocks passage to inside."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/3rd-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-4th
name: 4th Circle
entries:
  - "_Fabricate_ (Transmutation) Make items from raw materials."
  - "_Hallucinatory Terrain_ (Illusion) Terrain appears as you will it."
  - "_Private Sanctum_ (Abjuration) Ensure an area’s privacy."
  - "_Secret Chest_ (Abjuration) Hide chest in Ethereal Plane."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/4th-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-5th
name: 5th Circle
entries:
  - "_Contact Other Plane_ (Divination) Ask an entity five questions."
  - "_Creation_ (Illusion) Make an object from shadow."
  - "_Dream_ (Illusion) Visit targets’ dreams."
  - "_Geas_ (Enchantment) Compel target to obey you."
  - "_Planar Binding_ (Abjuration) Bind planar creature to service."
  - "_Scrying_ (Divination) Superior spying method."
  - "_Teleportation Circle_ (Conjuration) Teleport to fixed locations."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/5th-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-6th
name: 6th Circle
entries:
  - "_Contingency_ (Evocation) Set a spell for just in case."
  - "_Create Undead_ (Necromancy) Make ghouls or worse Undead."
  - "_Guards and Wards_ (Abjuration) Many effects to guard a building."
  - "_Instant Summons_ (Conjuration) Mark an item to summon later."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/6th-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-7th
name: 7th Circle
entries:
  - "_Magnificent Mansion_ (Conjuration) An extradimensional dwelling."
  - "_Mirage Arcane_ (Illusion) Better _hallucinatory terrain_."
  - "_Simulacrum_ (Illusion) Inferior copy of someone."
  - "_Symbol_ (Abjuration) Powerful glyph, many effects."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/7th-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-8th
name: 8th Circle
entries:
  - "_Antipathy/Sympathy_ (Enchantment) Repel or attract creatures."
  - "_Clone_ (Necromancy) Backup body for a creature."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/8th-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```

```rpg list.arcane-ritual-9th
name: 9th Circle
entries:
  - "_Astral Projection_ (Necromancy) Group travel to Astral Plane."
  - "_Foresight_ (Divination) Ally sees immediate future."
  - "_Imprisonment_ (Abjuration) Create a unique prison."
  - call: "@[[tales-of-the-valiant/worldbuilding/spells/9th-circle-ritual/]].filter(source like /Arcane/).highlight().block(0)"
    format: "*[[${name}]]* (${school}) ${summary}"
```
