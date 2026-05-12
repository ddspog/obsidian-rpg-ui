---
cssclasses:
  - note-spell
source: *From **Tales of the Valiant** "Player's Guide" book by **Kobold Press***
---
# Bane

```rpg spell
circle: 1st-Circle
source:
  - "[[Divine]]"
  - "[[Wyrd]]"
school: Enchantment
casting: 1 action
range: 30 feet
components:
  - V
  - S
  - M (a drop of blood)
duration: Concentration, up to 1 minute
summary: Foes subtract d4 from rolls. 
text: |-
  Up to three creatures of your choice that you can see within range must succeed on a CHA save or become cursed. <br/><br/>

  When a cursed target makes an attack roll or a save before the spell ends, the target must roll a d4 and subtract the number rolled from the attack roll or save. <br/><br/>

  **_At Higher Circles._** When you cast this spell using a spell slot of 2nd circle or higher, you can target one additional creature for each slot above 1st.
image: "![[bane.webp|384]]"
roll:
  form: save
  circle: 1
  range: 30 ft.
  save:
    ability: CHA
    on_success: "negates curse"
  damage:
    roll: 1d4
    type: penalty
  notes: cursed targets subtract 1d4 from attack/save; +1 target per upcast
  upcast:
    2: { notes: "+1 target (4 total); +1 per circle above" }
    3: { notes: "+2 targets (5 total); +1 per circle above" }
    4: { notes: "+3 targets (6 total); +1 per circle above" }
    5: { notes: "+4 targets (7 total); +1 per circle above" }
```
