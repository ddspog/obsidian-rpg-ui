---
cssclasses:
  - note-spell
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Sleep

```rpg spell
circle: 1st-Circle
source:
  - "[[Arcane]]"
  - "[[Wyrd]]"
school: Enchantment
casting: 1 action
range: 90 ft.
components:
  - V
  - S
  - M (a pinch of fine sand, rose petals, or a cricket)
duration: 1 minute
style:
  - Dream
summary: Lull foes into sleep.
image: "![[sleep.webp|384]]"
roll:
  form: save
  circle: 1
  range: 90 ft.
  damage:
    roll: 5d8
    type: sleep pool
  notes: creatures fall unconscious in ascending HP order until pool exhausted
  upcast:
    2: { damage: { roll: 7d8, type: "sleep pool" } }
    3: { damage: { roll: 9d8, type: "sleep pool" } }
    4: { damage: { roll: 11d8, type: "sleep pool" } }
    5: { damage: { roll: 13d8, type: "sleep pool" } }

---
This spell sends creatures into a magical slumber. Roll 8d8; the result is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points (ignoring unconscious creatures). <br/> <br/>

Starting with the creature that has the lowest current hit points, each creature affected by this spell falls unconscious until the spell ends, the sleeper takes damage, or someone uses an action to shake or slap the sleeper awake. Subtract each creature’s hit points from the total before moving on to the creature with the next lowest hit points. A creature’s hit points must be equal to or less than the remaining total for that creature to be affected. <br/> <br/>

Undead and creatures immune to being [[charmed]] aren’t affected by this spell. <br/> <br/>

**_At Higher Circles._** When you cast this spell using a spell slot of 2nd circle or higher, roll an additional 2d8 for each slot above 1st.
```
