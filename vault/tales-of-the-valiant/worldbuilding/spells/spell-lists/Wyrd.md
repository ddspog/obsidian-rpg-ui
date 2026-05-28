---
.item: 
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
.metadata: 
cssclasses:
  - simple-dataview-lists
  - note-feature
---
# Wyrd
![[07. Spellcasting#^e6076b|clean]]
## Spell List
These spells are available to casters who draw power from the Wyrd source. 
###### Cantrips #css/h/section 
_Dancing Lights_ (Evocation) Make and control four lights. 
_Grave Touch_ (Necromancy) Necrotic to foe, prevent healing. 
_Thaumaturgy_ (Transmutation) Harmless display of power. 
_Vicious Mockery_ (Enchantment) Psychic to foe and disadvantage.  
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/Cantrips"
WHERE contains(magic_source, [[Wyrd]])
SORT file.link
```
###### 1ST CIRCLE #css/h/section 
_Bane_ (Enchantment) Foes subtract d4 from rolls. 
_Charm_ (Enchantment) Compel creature to trust you. 
_Command_ (Enchantment) Foe obeys one-word order. 
_Detect Evil and Good_ (Divination) Locate creature types nearby. 
_Detect Magic_ (Divination) Sense nearby magic. 
_Disguise Self_ (Illusion) Change your basic appearance. 
_Faerie Fire_ (Evocation) Light up foes for advantage. 
_Guiding Bolt_ (Evocation) Radiant harms and halos foe. 
_Hellish Rebuke_ (Evocation) Retaliate with fire. 
_Hideous Laughter_ (Enchantment) Foe laughs uncontrollably. 
_Inflict Wounds_ (Necromancy) Average necrotic to foe. 
_Protection from Evil and Good_ (Abjuration) Ward against creature types. 
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/1st-Circle"
WHERE econtains(magic_source, [[Wyrd]])
SORT file.link
```
###### 2ND CIRCLE #css/h/section 
![[wyrd-caster.webp|right|256]]_Blindness/Deafness_ (Necromancy) Blind or deafen foe. 
_Darkness_ (Evocation) 15-ft. radius magical darkness. 
_Detect Thoughts_ (Divination) Know a creature’s thoughts. 
_Enthrall_ (Enchantment) Group sees, hears only you. 
_Hold_ (Enchantment) Paralyze a Medium creature. 
_Invisibility_ (Illusion) Ally becomes invisible. 
_Magic Weapon_ (Transmutation) Enchant a weapon for 1 hour. 
_Mirror Image_ (Illusion) Copies of you deflect attacks. 
_Misty Step_ (Conjuration) Quick teleport at short range. 
_Ray of Enfeeblement_ (Necromancy) Sap a foe’s strength. 
_Rope Trick_ (Conjuration) Extradimensional hideaway. 
_See Invisibility_ (Divination) See invisible and ethereal. 
_Silence_ (Illusion) 20-ft. radius deafening quiet. 
_Spiritual Weapon_ (Evocation) Spectral weapon deals force. 
_Suggestion_ (Enchantment) Creature obeys your order. 
###### 3RD CIRCLE #css/h/section 
_Bestow Curse_ (Necromancy) Choose a bad effect for a foe. 
_Blink_ (Transmutation) Fast shift to Ethereal Plane and back. 
_Conjure Animals_ (Conjuration) Call Beasts to help. 
_Fear_ (Illusion) Frighten a group. 
_Hypnotic Pattern_ (Illusion) Charm foes in 30-ft. cube. 
_Major Image_ (Illusion) Make a complex illusion. 
_Nondetection_ (Abjuration) Hide target from divination. 
_Remove Curse_ (Abjuration) End curses affecting ally. 
_Revivify_ (Necromancy) Resurrect 1 minute dead. 
_Sending_ (Enchantment) Send a 25-word message anywhere. 
_Spirit Guardians_ (Conjuration) Spirits damage foes around you. 
_Stinking Cloud_ (Conjuration) 20-ft. cloud nauseates, obscures. 
_Vampiric Touch_ (Necromancy) Harm another to heal yourself. 
###### 4TH CIRCLE #css/h/section 
_Banishment_ (Abjuration) Send target to another plane for 1 min. 
_Black Tentacles_ (Conjuration) Tentacles bludgeon, restrain.
_Compulsion_ (Enchantment) Charm foes to move as you will it. 
_Confusion_ (Enchantment) Targets act at random. 
_Conjure Minor Elementals_ (Conjuration) Call Elementals to help. 
_Dimension Door_ (Conjuration) Teleport 500 ft. for two. 
_Faithful Hound_ (Conjuration) Invisible sentry barks and bites. 
_Greater Invisibility_ (Illusion) Better _invisibility_. 
_Mass Faerie Fire_ (Evocation) Better _faerie fire._ 
_Phantasmal Killer_ (Illusion) Frighten, psychic to foe. 
###### 5TH CIRCLE #css/h/section 
_Cloudkill_ (Conjuration) 20-ft. cloud deals poison. 
_Conjure Elemental_ (Conjuration) Call an Elemental to help. 
_Dispel Evil and Good_ (Abjuration) Send creature types home. 
_Dominate_ (Enchantment) Control a Medium creature. 
_Greater Hold_ (Enchantment) Paralyze any creature. 
_Seeming_ (Illusion) _Disguise self_ for a group. 
_Telekinesis_ (Transmutation) Move targets with your mind. 
_Telepathic Bond_ (Divination) Connect allies’ thoughts. 
_Wall of Force_ (Evocation) Shape force wall to block passage. 
###### 6TH CIRCLE #css/h/section 
_Circle of Death_ (Necromancy) Necrotic in 60-ft. radius. 
_Disintegrate_ (Transmutation) Force, utter destruction at 0 HP. 
_Eyebite_ (Transmutation) Panic, sicken, or sleep foes. 
_Harm_ (Necromancy) Necrotic that won’t quite kill. 
_Irresistible Dance_ (Enchantment) Foe dances uncontrollably. 
_Mass Suggestion_ (Enchantment) Group obeys your order. 
_True Seeing_ (Divination) Ally sees things truly. 
###### 7TH CIRCLE #css/h/section 
_Etherealness_ (Transmutation) Travel to, in Ethereal Plane. 
_Finger of Death_ (Necromancy) Major necrotic, zombify Humanoid. 
_Forcecage_ (Evocation) Imprison foes for 1 hour. 
_Plane Shift_ (Conjuration) Take allies or banish foe to plane. 
###### 8TH CIRCLE #css/h/section 
_Demiplane_ (Conjuration) Door to a small dimension. 
_Greater Dominate_ (Enchantment) Control any creature. 
_Maze_ (Conjuration) Send target to demiplane maze. 
_Power Word Stun_ (Enchantment) Stun a foe up to 150 HP. 
###### 9TH CIRCLE #css/h/section 
_Gate_ (Conjuration) Link to another plane. 
_Power Word Kill_ (Enchantment) Kill a foe up to 100 HP. 
_Weird_ (Illusion) Better _phantasmal killer_. 
_Wish_ (Conjuration) Wish for anything.
## Ritual List
These rituals are available to casters who draw power from the Wyrd source. 
###### 1ST CIRCLE #css/h/section 
_Find Familiar_ (Conjuration) Call a Beast to serve you. 
_Illusory Script_ (Illusion) Write hidden messages. 
_Unseen Servant_ (Conjuration) Make an invisible helper. 
*Prehensile Hair ᴴ* (Transmutation) Form a familiar with your hair.
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/1st-Circle Ritual"
WHERE contains(magic_source, [[Wyrd]])
SORT file.link
```
###### 2ND CIRCLE #css/h/section 
_Augury_ (Divination) Get an omen about your plans. 
_Locate_ (Divination) Find a creature or object. 
_Magic Mouth_ (Illusion) Object speaks your message. 
###### 3RD CIRCLE #css/h/section 
_Clairvoyance_ (Divination) View or hear up to 1 mile away. 
_Magic Circle_ (Abjuration) Ward against creature types. 
_Phantom Steed_ (Illusion) Make a fast steed for 1 hour. 
_Speak with Dead_ (Necromancy) Ask a corpse five questions. 
###### 4TH CIRCLE #css/h/section 
_Hallucinatory Terrain_ (Illusion) Terrain appears as you will it. 
_Secret Chest_ (Abjuration) Hide chest in Ethereal Plane. 
###### 5TH CIRCLE #css/h/section 
_Contact Other Plane_ (Divination) Ask an entity five questions. 
_Dream_ (Illusion) Visit targets’ dreams. 
_Geas_ (Enchantment) Compel target to obey you. 
_Planar Binding_ (Abjuration) Bind planar creature to service. 
###### 6TH CIRCLE #css/h/section 
_Magic Jar_ (Necromancy) Possess a Humanoid’s body. 
_Planar Ally_ (Conjuration) Call for extraplanar aid. 
###### 7TH CIRCLE #css/h/section 
_Magnificent Mansion_ (Conjuration) An extradimensional dwelling. 
_Mirage Arcane_ (Illusion) Better _hallucinatory terrain_.
###### 8TH CIRCLE #css/h/section 
_Antipathy/Sympathy_ (Enchantment) Attract or repel creatures.
###### 9TH CIRCLE #css/h/section 
_Astral Projection_ (Necromancy) Group travel to Astral Plane.
_Imprisonment_ (Abjuration) Create a unique prison.  