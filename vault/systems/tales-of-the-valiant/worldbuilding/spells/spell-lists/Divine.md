---
.item: 
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**.
.metadata: 
cssclasses:
  - simple-dataview-lists
  - note-feature
---
# Divine
![[07. Spellcasting#^d4d209|clean]]
## Spell List
These spells are available to casters who draw power from the Divine source. 
###### Cantrips #css/h/section 
_Mending_ (Transmutation) Minor repairs to an object. 
_Resistance_ (Abjuration) Ally adds d4 to save. 
_Sacred Flame_ (Evocation) Foe has no cover from radiant. 
_Spare the Dying_ (Necromancy) Stabilize a dying creature.
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/Cantrips"
WHERE contains(magic_source, [[Divine]])
SORT file.link
```
###### 1ST CIRCLE #css/h/section 
_Command_ (Enchantment) Creature obeys one-word order. 
_Detect Evil and Good_ (Divination) Locate creature types nearby. 
_Divine Favor_ (Evocation) Your weapon deals extra radiant. 
_Guiding Bolt_ (Evocation) Radiant harms and halos foe. 
_Healing Word_ (Necromancy) Minor heal at 60 ft. 
_Heroism_ (Enchantment) Ally is immune to fear, gains temporary HP. 
_Inflict Wounds_ (Necromancy) Average necrotic to foe. 
_Protection from Evil and Good_ (Abjuration) Ward against creature types. 
_Shield of Faith_ (Abjuration) Creature gets +2 AC. 
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/1st-Circle"
WHERE contains(magic_source, [[Divine]])
SORT file.link
```
###### 2ND CIRCLE #css/h/section 
![[divine-caster.webp|right|256]]_Aid_ (Abjuration) Raises current and maximum HP. 
_Blindness/Deafness_ (Necromancy) Blind or deafen foe. 
_Branding Smite_ (Evocation) Better _divine favor_. 
_Calm Emotions_ (Enchantment) Soothe riled-up Humanoids. 
_Gentle Repose_ (Necromancy) Ward corpse from decay, undeath. 
_Hold_ (Enchantment) Paralyze a Medium creature. 
_Protection from Poison_ (Abjuration) Stop, resist poison for ally. 
_Ray of Enfeeblement_ (Necromancy) Sap a foe’s strength. 
_See Invisibility_ (Divination) See invisible and ethereal. 
_Silence_ (Illusion) 20-ft. radius deafening quiet. 
_Spiritual Weapon_ (Evocation) Spectral weapon deals force. 
_Suggestion_ (Enchantment) Creature obeys your order. 
_Warding Bond_ (Abjuration) Halve, share pain with ally. 
_Zone of Truth_ (Enchantment) Targets can’t lie. 
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/2nd-Circle"
WHERE contains(magic_source, [[Divine]])
SORT file.link
```
###### 3RD CIRCLE #css/h/section 
_Beacon of Hope_ (Abjuration) Give advantage, maximize heals. 
_Bestow Curse_ (Necromancy) Choose a bad effect for a foe. 
_Create Food and Water_ (Conjuration) 45 lbs. food, 30 gallons water. 
_Daylight_ (Evocation) Create a sphere of daylight. 
_Mass Healing Word_ (Necromancy) Minor heal to many at 60 ft. 
_Protection from Energy_ (Abjuration) Ally has damage type resistance.
_Remove Curse_ (Abjuration) End curses affecting ally. 
_Revivify_ (Necromancy) Resurrect 1 minute dead.
_Sending_ (Enchantment) Send a 25‑word message anywhere. 
_Spirit Guardians_ (Conjuration) Spirits damage foes around you. 
_Tongues_ (Divination) Target understands all language. 
_Vampiric Touch_ (Necromancy) Harm another to heal yourself. 
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/3rd-Circle"
WHERE contains(magic_source, [[Divine]])
SORT file.link
```
###### 4TH CIRCLE #css/h/section 
_Banishment_ (Abjuration) Send target to another plane for 1 min. 
_Blight_ (Necromancy) Necrotic to living creature. 
_Compulsion_ (Enchantment) Charm foes to move as you will it. 
_Confusion_ (Enchantment) Targets act at random. 
_Control Water_ (Transmutation) Make water move as you will it. 
_Death Ward_ (Abjuration) Ally has 1 HP when it would have 0 HP. 
_Faithful Hound_ (Conjuration) Invisible sentry barks and bites. 
_Freedom of Movement_ (Abjuration) Ally can’t be slowed or hindered. 
_Guardian of Faith_ (Conjuration) Sentry deals radiant to nearby foes. 
###### 5TH CIRCLE #css/h/section 
_Antilife Shell_ (Abjuration) 10-ft. field blocks the living. 
_Contagion_ (Necromancy) Sicken foe with disease. 
_Dispel Evil and Good_ (Abjuration) Send creature types home. 
_Flame Strike_ (Evocation) 10-ft. radius column of fire, radiant. 
_Greater Hold_ (Enchantment) Paralyze any creature. 
_Greater Restoration_ (Abjuration) Better _restoration_. 
_Legend Lore_ (Divination) Instantly know about a legend. 
_Mass Cure Wounds_ (Necromancy) Average heal to allies. 
###### 6TH CIRCLE #css/h/section 
_Circle of Death_ (Necromancy) Necrotic in 60-ft. radius. 
_Flesh to Stone_ (Transmutation) Slowly petrify creature. 
_Harm_ (Necromancy) Necrotic that won’t quite kill. 
_Heal_ (Necromancy) Major heal to creature. 
_Sunbeam_ (Evocation) Line of blinding radiant. 
_True Seeing_ (Divination) Ally sees things truly. 
_Word of Recall_ (Conjuration) Teleport group to chosen place. 
###### 7TH CIRCLE #css/h/section 
_Divine Word_ (Evocation) Banish, harm extraplanar foes. 
_Finger of Death_ (Necromancy) Major necrotic, zombify Humanoid. 
_Plane Shift_ (Conjuration) Take allies or banish foe to plane. 
_Sequester_ (Transmutation) Hide target in stasis. 
###### 8TH CIRCLE #css/h/section 
_Glibness_ (Transmutation) Your CHA check, save roll is 15. 
_Holy Aura_ (Abjuration) Allies light up, boost defenses. 
_Power Word Stun_ (Enchantment) Stun a creature up to 150 HP. 
_Sunburst_ (Evocation) 60-ft. radius blinding radiant. 
###### 9TH CIRCLE #css/h/section 
_Mass Heal_ (Necromancy) Heal 700 HP across allies. 
_Power Word Kill_ (Enchantment) Kill a foe up to 100 HP. 
_Power Word Recover_ (Enchantment) Fully heal an ally. 
_Storm of Vengeance_ (Conjuration) Increasing harm for 10 rounds. 
## Ritual List
These rituals are available to casters who draw power from the Divine source. 
###### 1ST CIRCLE #css/h/section 
_Purify Food and Drink_ (Transmutation) Make food, drink safe to eat.
*Ceremony ᴰ* (Abjuration) Perform religious ceremony.
*Fixit ᴴ* (Transmutation) Maintain a broken item whole for a time.
*Burnt Offering ᴴ* (Abjuration) Gain a armor buff sacrificing a creature.
*Consecrated Armor ᴴ* (Abjuration) Enhance your armor with blessed oil.
*Exhume ᴴ* (Necromancy) Form a pile of humanoid bones.
*Memorize ᴴ* (Enchantment) For a year memorize something without fail.
*Mouthpiece of Heaven ᴴ* (Transmutation) Enhance someone speech.
```dataview
LIST WITHOUT ID "_" + file.link + "_" + " (" + school + ") " + summary
FROM "r12. Worldbuilding/Spells/1st-Circle Ritual"
WHERE contains(magic_source, [[Divine]])
SORT file.link
```
###### 2ND CIRCLE #css/h/section 
_Augury_ (Divination) Get an omen about your plans. 
_Find Steed_ (Conjuration) Call, bond with a mount. 
_Locate_ (Divination) Find a target. 
_Prayer of Healing_ (Evocation) Moderate heal to allies. 
###### 3RD CIRCLE #css/h/section 
_Animate Dead_ (Necromancy) Make a skeleton or zombie. 
_Clairvoyance_ (Divination) View or hear up to 1 mile away. 
_Magic Circle_ (Abjuration) Ward against creature types. 
_Speak with Dead_ (Necromancy) Ask a corpse five questions. 
###### 4TH CIRCLE #css/h/section 
_Divination_ (Divination) Question the future or present. 
_Private Sanctum_ (Abjuration) Ensure an area’s privacy. 
###### 5TH CIRCLE #css/h/section 
_Geas_ (Enchantment) Compel target to obey you. 
_Hallow_ (Abjuration) Ward from creature types, more effects. 
_Planar Binding_ (Abjuration) Bind planar creature to service. 
_Raise Dead_ (Necromancy) Resurrect 10 days dead. 
_Scrying_ (Divination) Superior spying method. 
###### 6TH CIRCLE #css/h/section 
_Create Undead_ (Necromancy) Make ghouls or worse Undead. 
_Forbiddance_ (Abjuration) Ward area against magical travel. 
_Heroes’ Feast_ (Conjuration) Feast gives eaters benefits. 
_Planar Ally_ (Conjuration) Call for extraplanar aid. 
###### 7TH CIRCLE #css/h/section
_Regenerate_ (Transmutation) Heal creature slowly, completely.
_Resurrection_ (Necromancy) Resurrect 100 years dead.
###### 8TH CIRCLE #css/h/section 
_Antipathy/Sympathy_ (Enchantment) Attract or repel creatures. 
_Control Weather_ (Transmutation) Change weather within 5 miles. 
###### 9TH CIRCLE #css/h/section 
_Foresight_ (Divination) Ally sees immediate future. 
_True Resurrection_ (Necromancy) Resurrect 200 years dead. 