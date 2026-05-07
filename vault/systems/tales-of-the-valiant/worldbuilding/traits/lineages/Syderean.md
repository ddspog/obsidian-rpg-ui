---
.metadata: 
cssclasses:
  - note-feature
---
# Syderean
![[syderean.webp|right|384]] Sydereans (sigh-DEER-ee-ans) are mystical beings sired by creatures or powers from a different plane of existence. Sometimes called starborn or plane-touched, their origins are as varied and mysterious as the cosmic forces that shaped them. 

Though sydereans may be conceived by the physical union of a mortal with an outsider—such as a celestial or fiend—such pairings are rare and steeped in portents or conspiracy. More often, sydereans are born to an unsuspecting mortal family perhaps as the result of magical upheaval, an ancient dormant trait within the family’s bloodline, or a reincarnated soul returned by some unknown design. There are even instances of fully grown humanoids suddenly transformed into a syderean in a flash of light or a burst of smoke. 

All sydereans live between two worlds: that of their mortal peers and a world connected to their indwelling magic. Sydereans may be shaped by celestials, born of fiends, or derived from less understood entities. 

Regardless of parentage, sydereans aren't bound to the cosmic laws that govern their sires. They are the masters of their own destinies, free to embrace, reject, or ignore the cosmic struggles of their immortal kin.
  
Sydereans can be found among any humanoid culture, but often gravitate toward large cities, where they can skip the scrutiny of a village life. Sydereans welcomed by mortal peers often find success as clergy, leaders, or arcane scholars. The less fortunate might avoid civilization entirely, seeking solitude, embracing banditry, or adopting lives dedicated to travel and adventure.
```rpg feature.details
name: Syderean Lineage Traits
text: |
  ![[syderean-fiendish.webp|right|384]] Your syderean character has the following hereditary traits.

  **_Age._** Sydereans reach adulthood by the age of 20. On average, they live about 150 years.

  **_Size._** Your size is Medium. Sydereans stand between 5 and 7 feet tall and average 160 pounds.  

  **_Speed._** Your base walking speed is 30 feet. 

  **_Far Sight._** You have [[Darkvision]] to a range of 60 feet and can see in magical darkness to a range of 30 feet.

  **_Otherworldly Form._** You have resistance to necrotic damage and the amount of time you can survive without air, food, water, or sleep is double that of a typical character.

  **_Natural Adaptation._** You have inherited one set of the following unique traits, determined by the nature of the forces that shaped you. 
passive:
  name: Otherworldly Form
  text: The amount of time you can survive without air, food, water, or sleep is double that of a typical character.
traits:
  Speed: "30 ft."
  Senses: 
    - "[[Darvision]] 60ft."
    - "[[Far Sight]] 30ft."
  Resistance:
    - Necrotic Damage
pick: 1
```
```rpg feature.choice
parent: Syderean Lineage Traits
name: Blessed Guise
text: |
  **_Celestial._** You possess notable physical characteristics that mark your connection to realms of good or order. You might have luminous eyes, metallic-hued skin, or possess the ability to stay perfectly still for hours. You also gain the following:
  - **Blessed Guise.** Once per long rest, you can use a bonus action to assume an otherworldly guise for 1 minute. When you do so, you sprout spectral wings and gain a flying speed equal to your walking speed for the duration of your transformation. While transformed, once on each of your turns when you deal damage with an attack or spell, you can choose to convert the damage type (or types) to radiant damage. 
bonus:
  text: Once per long rest, you can use a bonus action to assume an otherworldly guise for 1 minute. When you do so, you sprout spectral wings and gain a flying speed equal to your walking speed for the duration of your transformation. While transformed, once on each of your turns when you deal damage with an attack or spell, you can choose to convert the damage type (or types) to radiant damage.
traits:
  Natural Adaptation: Celestial, Blessed Guise
```
```rpg feature.choice
parent: Syderean Lineage Traits
name: Dreadful Guise
text: |
  **_Fiendish_**. You possess notable physical characteristics that mark your connection to realms of evil or chaos. You might bear bony horns that jut from your skull, emit a perpetual odor of smoke, or have a barbed tail. You also gain one of the following: 
  - **Dreadful Guise.** Once per long rest, you can use a bonus action to assume an otherworldly guise for 1 minute. While the transformation lasts, creatures of your choice that come within 10 feet of you for the first time on a turn or start their turn there must succeed on a CHA save (DC equals 10 + your PB) or become [[Frightened]] of you until the end of your next turn. Once a creature succeeds on this save, they can’t be affected by this feature again for 24 hours. While transformed, once on each of your turns when you deal damage with an attack or spell, you can choose to convert the damage type (or types) to necrotic or fire damage (your choice).
bonus:
  text: Once per long rest, you can use a bonus action to assume an otherworldly guise for 1 minute. While the transformation lasts, creatures of your choice that come within 10 feet of you for the first time on a turn or start their turn there must succeed on a CHA save (DC equals 10 + your PB) or become [[Frightened]] of you until the end of your next turn. Once a creature succeeds on this save, they can’t be affected by this feature again for 24 hours. While transformed, once on each of your turns when you deal damage with an attack or spell, you can choose to convert the damage type (or types) to necrotic or fire damage (your choice).
traits:
  Natural Adaptation: Fiendish, Dreadful Guise
```
```rpg feature.choice
parent: Syderean Lineage Traits
name: Winged
text: |
  - **Winged.** Bat-like wings jut from your shoulder blades, which are *hard to hide* in public. You have a flying speed of 30 feet while you aren’t wearing [[Heavy Armor]]. The wings give you advantage to [[Stealth]] checks for hiding in [[Dim Light]] or [[Darkness]]. Also, once per long rest, you can use a bonus action to reclaim strength in your wings enabling you to fly (and hover) even with heavy armor for 1 minute.
bonus:
  text: You can use a bonus action to reclaim strength in your wings enabling you to fly (and hover) even with heavy armor for 1 minute.
  max: 1
  recovery: long rest
passive:
  text: Bat-like wings jut from your shoulder blades, which are *hard to hide* in public. You have a flying speed of 30 feet while you aren’t wearing [[Heavy Armor]]. The wings give you advantage to [[Stealth]] checks for hiding in [[Dim Light]] or [[Darkness]]. 
traits:
  Natural Adaptation: Fiendish, Winged
```
**Source**: Adjusted from **Tales of the Valiant** "Player's Guide" book by **Kobold Press**.